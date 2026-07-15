import logging
import os
from dataclasses import dataclass, field
from typing import List, Tuple

from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

# ── Patch de compatibilité huggingface_hub >= 0.20 ───────────────────────────
# HfFolder a été supprimé dans les versions récentes.
# LlamaFirewall l'utilise encore pour récupérer le token au moment du download.
import huggingface_hub as _hf
if not hasattr(_hf, "HfFolder"):
    _hf_token_env = os.environ.get("HF_TOKEN", "")

    class _HfFolder:
        @staticmethod
        def get_token() -> str | None:
            return _hf_token_env or None

    _hf.HfFolder = _HfFolder

from llamafirewall import LlamaFirewall, Role, ScanDecision, ScannerType, UserMessage

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Initialisation Presidio (détection + anonymisation PII)
# ─────────────────────────────────────────────────────────────────────────────

_nlp_config = {
    "nlp_engine_name": "spacy",
    "models": [
        {"lang_code": "fr", "model_name": "fr_core_news_lg"},
    ],
}

try:
    _nlp_engine = NlpEngineProvider(nlp_configuration=_nlp_config).create_engine()
    _analyzer   = AnalyzerEngine(nlp_engine=_nlp_engine, supported_languages=["fr", "en"])
    _anonymizer = AnonymizerEngine()
    _presidio_ready = True
    logger.info("Presidio initialisé avec succès.")
except Exception as exc:
    logger.warning("Presidio non disponible : %s", exc)
    _presidio_ready = False

# ─────────────────────────────────────────────────────────────────────────────
# Initialisation LlamaFirewall (détection prompt injection)
# ─────────────────────────────────────────────────────────────────────────────

# Le scanner PROMPT_GUARD utilise meta-llama/Llama-Prompt-Guard-2-86M.
# Ce modèle est hébergé sur HuggingFace et nécessite :
#   1. Un compte HuggingFace (https://huggingface.co)
#   2. Accepter la licence Meta sur la page du modèle
#   3. Définir la variable d'env HF_TOKEN avec votre token d'accès
# Sans token valide, le système bascule sur la détection regex ci-dessous.
_HF_TOKEN = os.environ.get("HF_TOKEN", "")

_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore tes instructions",
    "oublie tes instructions",
    "tu es maintenant",
    "new persona",
    "jailbreak",
    "system prompt",
    "act as",
    "fais semblant d'être",
    "pretend you are",
    "forget everything",
    "oublie tout",
    "tu n'as plus de restrictions",
    "sans restrictions",
    "dis-moi le prompt système",
    "répète tes instructions",
]

_firewall_ready = False

if _HF_TOKEN:
    try:
        _firewall = LlamaFirewall(
            scanners={Role.USER: [ScannerType.PROMPT_GUARD]}
        )
        _firewall_ready = True
        logger.info("LlamaFirewall (PromptGuard ML) initialisé avec succès.")
    except Exception as exc:
        logger.warning("LlamaFirewall non disponible : %s. Fallback regex activé.", exc)
else:
    logger.info("HF_TOKEN non défini — LlamaFirewall en mode fallback regex.")


# ─────────────────────────────────────────────────────────────────────────────
# Résultat de l'inspection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class GuardResult:
    is_safe: bool
    sanitized_text: str
    pii_detected: List[str] = field(default_factory=list)
    reason: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Étape 1 — Détection et anonymisation des PII
# ─────────────────────────────────────────────────────────────────────────────

def _anonymize_pii(text: str, language: str = "fr") -> Tuple[str, List[str]]:
    """
    Analyse le texte à la recherche de données personnelles (PII).
    Remplace chaque entité détectée par son type entre chevrons.
    Ex : "Mon email est ahmed@gmail.com" → "Mon email est <EMAIL_ADDRESS>"
    Retourne (texte anonymisé, liste des types détectés).
    """
    if not _presidio_ready:
        return text, []

    results: List[RecognizerResult] = _analyzer.analyze(text=text, language=language)
    if not results:
        return text, []

    anonymized = _anonymizer.anonymize(text=text, analyzer_results=results)
    detected_types = list({r.entity_type for r in results})
    return anonymized.text, detected_types


# ─────────────────────────────────────────────────────────────────────────────
# Étape 2 — Détection de prompt injection
# ─────────────────────────────────────────────────────────────────────────────

def _check_injection(text: str) -> Tuple[bool, str]:
    """
    Vérifie si le texte contient une tentative de manipulation du LLM.
    Utilise LlamaFirewall (PromptGuard-86M) si disponible,
    sinon un fallback par expressions régulières.
    Retourne (is_safe, raison si bloqué).
    """
    if _firewall_ready:
        try:
            result = _firewall.scan(UserMessage(content=text))
            if result.decision == ScanDecision.BLOCK:
                return False, f"Prompt injection détectée (score={result.score:.2f})"
            return True, ""
        except Exception as exc:
            logger.error("Erreur LlamaFirewall lors du scan : %s", exc)
            # En cas d'erreur du scanner, on passe au fallback

    # Fallback regex
    text_lower = text.lower()
    for pattern in _INJECTION_PATTERNS:
        if pattern in text_lower:
            return False, f"Tentative d'injection détectée (pattern : '{pattern}')"
    return True, ""


# ─────────────────────────────────────────────────────────────────────────────
# Point d'entrée principal — appelé par main.py
# ─────────────────────────────────────────────────────────────────────────────

def inspect_input(text: str) -> GuardResult:
    """
    Inspecte une question utilisateur avant qu'elle atteigne le pipeline RAG.

    Étape 1 : anonymise les données personnelles (Presidio)
    Étape 2 : détecte les tentatives de prompt injection (LlamaFirewall)

    Retourne un GuardResult avec :
      - is_safe       : False si la requête doit être bloquée
      - sanitized_text: texte nettoyé à transmettre au RAG
      - pii_detected  : types de PII trouvés
      - reason        : explication si bloqué
    """
    # Étape 1 — PII
    sanitized, pii_types = _anonymize_pii(text)

    # Étape 2 — Injection
    is_safe, reason = _check_injection(sanitized)

    return GuardResult(
        is_safe=is_safe,
        sanitized_text=sanitized,
        pii_detected=pii_types,
        reason=reason,
    )
