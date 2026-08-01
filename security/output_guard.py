"""
security/output_guard.py — Inspection de la sortie du LLM (Couche 5)

Rôle : inspecter la réponse générée par Mistral AVANT de l'envoyer
à l'utilisateur. Deux vérifications :
  1. Presidio  → anonymise tout PII accidentellement présent dans la réponse
  2. LlamaFirewall HIDDEN_ASCII → détecte les caractères invisibles injectés
     dans la réponse (attaque ASCII smuggling — OWASP LLM05)
"""

import logging
import unicodedata
from dataclasses import dataclass

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

from llamafirewall import AssistantMessage, LlamaFirewall, Role, ScanDecision, ScannerType

logger = logging.getLogger(__name__)

# ── Presidio (réutilise la même config que input_guard) ──────────────────────

_nlp_config = {
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "fr", "model_name": "fr_core_news_lg"}],
}

try:
    _nlp_engine = NlpEngineProvider(nlp_configuration=_nlp_config).create_engine()
    _analyzer   = AnalyzerEngine(nlp_engine=_nlp_engine, supported_languages=["fr", "en"])
    _anonymizer = AnonymizerEngine()
    _presidio_ready = True
    logger.info("Presidio (output) initialisé avec succès.")
except Exception as exc:
    logger.warning("Presidio (output) non disponible : %s", exc)
    _presidio_ready = False

# ── LlamaFirewall — scanner de sortie (HIDDEN_ASCII) ─────────────────────────
# HIDDEN_ASCII ne nécessite pas de téléchargement de modèle.
# Il détecte les caractères Unicode invisibles utilisés pour cacher
# des instructions malveillantes dans une réponse apparemment normale.

try:
    _output_firewall = LlamaFirewall(
        scanners={Role.ASSISTANT: [ScannerType.HIDDEN_ASCII]}
    )
    _firewall_ready = True
    logger.info("LlamaFirewall (output / HIDDEN_ASCII) initialisé.")
except Exception as exc:
    logger.warning("LlamaFirewall output non disponible : %s", exc)
    _firewall_ready = False

# ── Patterns de contenu dangereux dans la sortie ─────────────────────────────
# Détecte si le LLM a quand même fourni des instructions dangereuses.

_DANGEROUS_OUTPUT_PATTERNS = [
    "voici comment pirater",
    "voici comment hacker",
    "étapes pour créer un virus",
    "instructions pour fabriquer",
    "pour contourner la sécurité",
    "exploit disponible",
]


# ── Résultat de l'inspection sortie ──────────────────────────────────────────

@dataclass
class OutputGuardResult:
    is_safe: bool
    sanitized_response: str
    reason: str = ""


# ── Étape 1 — Anonymisation des PII dans la réponse ──────────────────────────

def _anonymize_output_pii(text: str) -> str:
    """Anonymise les PII dans la réponse du LLM."""
    if not _presidio_ready:
        return text
    results = _analyzer.analyze(text=text, language="fr")
    if not results:
        return text
    return _anonymizer.anonymize(text=text, analyzer_results=results).text


# ── Étape 2a — Détection ASCII smuggling (LlamaFirewall) ─────────────────────

def _check_hidden_ascii(text: str) -> tuple[bool, str]:
    """
    Détecte les caractères Unicode invisibles dans la réponse.
    Ces caractères peuvent cacher des instructions malveillantes
    invisibles à l'œil humain (attaque ASCII smuggling).
    """
    if _firewall_ready:
        try:
            result = _output_firewall.scan(AssistantMessage(content=text))
            if result.decision == ScanDecision.BLOCK:
                return False, f"ASCII smuggling détecté dans la réponse (score={result.score:.2f})"
            return True, ""
        except Exception as exc:
            logger.error("Erreur LlamaFirewall output : %s", exc)

    # Fallback : vérification Unicode manuelle
    suspicious = [c for c in text if unicodedata.category(c) in ("Cf", "Cc") and c not in ("\n", "\t")]
    if suspicious:
        return False, f"Caractères invisibles suspects détectés dans la réponse ({len(suspicious)} trouvés)"
    return True, ""


# ── Étape 2b — Vérification du contenu dangereux ─────────────────────────────

def _check_dangerous_content(text: str) -> tuple[bool, str]:
    """Vérifie si la réponse du LLM contient malgré tout des instructions dangereuses."""
    text_lower = text.lower()
    for pattern in _DANGEROUS_OUTPUT_PATTERNS:
        if pattern in text_lower:
            return False, f"Contenu dangereux détecté dans la réponse (pattern : '{pattern}')"
    return True, ""


# ── Point d'entrée principal ──────────────────────────────────────────────────

def inspect_output(response: str) -> OutputGuardResult:
    """
    Inspecte la réponse du LLM avant envoi à l'utilisateur.

    Étape 1 : anonymise les PII dans la réponse (Presidio)
    Étape 2a : détecte les caractères invisibles (LlamaFirewall HIDDEN_ASCII)
    Étape 2b : détecte le contenu dangereux dans la réponse (patterns)

    Retourne un OutputGuardResult avec :
      - is_safe           : False si la réponse doit être bloquée
      - sanitized_response: réponse nettoyée à envoyer à l'utilisateur
      - reason            : explication si bloqué
    """
    # Étape 1 — PII dans la sortie
    sanitized = _anonymize_output_pii(response)

    # Étape 2a — ASCII smuggling
    is_safe, reason = _check_hidden_ascii(sanitized)
    if not is_safe:
        return OutputGuardResult(is_safe=False, sanitized_response=sanitized, reason=reason)

    # Étape 2b — Contenu dangereux
    is_safe, reason = _check_dangerous_content(sanitized)
    if not is_safe:
        return OutputGuardResult(is_safe=False, sanitized_response=sanitized, reason=reason)

    return OutputGuardResult(is_safe=True, sanitized_response=sanitized)
