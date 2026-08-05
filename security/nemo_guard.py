"""
security/nemo_guard.py — Intégration NeMo Guardrails (Couche 4)

Rôle : vérifier si la question de l'utilisateur respecte les rails thématiques
définis dans security/guardrails/main.co avant d'appeler le pipeline RAG.

Architecture hybride :
  - Les règles sont définies dans les fichiers Colang (main.co) — source de vérité
  - L'application des règles se fait via NeMo (si disponible) ou via le moteur
    de patterns Python qui lit les mêmes règles (fallback)
"""

import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_GUARDRAILS_PATH = str(Path(__file__).parent / "guardrails")

# ── Patterns extraits de main.co ──────────────────────────────────────────────
# Synchronisés avec les "define user" dans security/guardrails/main.co

_HACKING_PATTERNS = [
    r"comment hacker", r"comment pirater", r"comment exploiter",
    r"cr[ée]+er un virus", r"cr[ée]+er un malware", r"cr[ée]+er un ransomware",
    r"attaque ddos", r"injection sql comment", r"bypass la s[ée]curit[ée]",
    r"contourner le pare.feu", r"acc[ée]der sans autorisation", r"voler des donn[ée]es",
]

_ILLEGAL_PATTERNS = [
    r"fabriquer une arme", r"faire une bombe",
    r"se procurer des drogues", r"blanchir de l'argent",
    r"comment frauder", r"p[ée]dopornographique",
]

_JAILBREAK_PATTERNS = [
    r"ignore tes restrictions", r"tu n'as plus de r[èe]gles",
    r"sans restrictions", r"d[ée]sactive tes filtres",
    r"r[ée]ponds sans censure", r"mode d[ée]veloppeur activ[ée]",
    r"dan mode", r"fais semblant que tu es sans",
    r"tu es maintenant libre",
]

_BLOCKED_RULES = [
    (_HACKING_PATTERNS,
     "Je ne peux pas fournir d'instructions pour des activités de piratage "
     "ou d'exploitation malveillante de systèmes."),
    (_ILLEGAL_PATTERNS,
     "Je ne peux pas fournir d'informations sur des activités illégales ou nuisibles."),
    (_JAILBREAK_PATTERNS,
     "Je maintiens mes directives de sécurité et ne peux pas ignorer mes restrictions."),
]

# ── Patterns d'instructions injectées dans un document (LLM08 — poisoning) ────
# Un document indexé dans Qdrant peut contenir une instruction cachée destinée
# à détourner le comportement du LLM une fois injectée dans le contexte
# (ex: un faux marqueur "SYSTEM" suivi d'une consigne). Distinct des patterns
# ci-dessus qui visent la question de l'utilisateur, pas le contenu récupéré.
_DOCUMENT_INJECTION_PATTERNS = [
    r"system\s*override", r"\[?system\]?\s*:", r"###\s*instruction",
    r"nouvelles? instructions?\s*:", r"ignore (le contexte|les instructions) pr[ée]c[ée]dent",
    r"ignore previous instructions", r"disregard (the )?(previous|above)",
    r"tu es maintenant", r"en tant qu'ia tu dois", r"tu dois d[ée]sormais",
]

_DOCUMENT_BLOCKED_RULES = _BLOCKED_RULES + [
    (_DOCUMENT_INJECTION_PATTERNS,
     "Document exclu du contexte : tentative d'instruction injectée détectée."),
]

# ── Initialisation NeMo (optionnelle) ─────────────────────────────────────────
_rails = None
_nemo_ready = False

try:
    from nemoguardrails import RailsConfig, LLMRails
    _config = RailsConfig.from_path(_GUARDRAILS_PATH)
    _rails = LLMRails(_config)
    _nemo_ready = True
    logger.info("NeMo Guardrails chargé (règles Colang actives).")
except Exception as exc:
    logger.warning("NeMo Guardrails non disponible : %s", exc)


# ── Résultat du check ─────────────────────────────────────────────────────────

@dataclass
class NemoResult:
    is_allowed: bool
    refusal_message: str = ""


# ── Moteur de patterns (lit les règles de main.co) ────────────────────────────

def _pattern_check(text: str) -> NemoResult:
    """Applique les patterns définis dans main.co via regex."""
    text_lower = text.lower()
    for patterns, message in _BLOCKED_RULES:
        for pattern in patterns:
            if re.search(pattern, text_lower):
                logger.info("Pattern bloqué détecté : '%s'", pattern)
                return NemoResult(is_allowed=False, refusal_message=message)
    return NemoResult(is_allowed=True)


def check_document(text: str) -> NemoResult:
    """
    Vérifie si un chunk de document récupéré depuis Qdrant est sûr à inclure
    dans le contexte envoyé au LLM (OWASP LLM08 — poisoning / injection via
    données récupérées). Contrairement à check_topic(), qui filtre la question
    utilisateur, cette fonction filtre le contenu qui revient de la base
    vectorielle avant qu'il ne soit concaténé dans le prompt.
    """
    text_lower = text.lower()
    for patterns, message in _DOCUMENT_BLOCKED_RULES:
        for pattern in patterns:
            if re.search(pattern, text_lower):
                logger.warning("Chunk exclu du contexte — pattern détecté : '%s'", pattern)
                return NemoResult(is_allowed=False, refusal_message=message)
    return NemoResult(is_allowed=True)


# ── Point d'entrée principal ──────────────────────────────────────────────────

def check_topic(question: str) -> NemoResult:
    """
    Vérifie si la question respecte les rails thématiques (main.co).

    1. Tente d'utiliser NeMo Guardrails (LLM-based)
    2. Si NeMo retourne une réponse vide ou est indisponible → moteur regex
    """
    if _nemo_ready:
        try:
            response = _rails.generate(
                messages=[{"role": "user", "content": question}]
            )
            if isinstance(response, dict):
                content = response.get("content", "")
            else:
                content = str(response)

            # Si NeMo retourne une réponse non vide → on vérifie si c'est un refus
            if content.strip():
                for _, message in _BLOCKED_RULES:
                    if message[:30].lower() in content.lower():
                        return NemoResult(is_allowed=False, refusal_message=content)
                return NemoResult(is_allowed=True)

        except Exception as exc:
            logger.error("Erreur NeMo : %s — passage au moteur regex.", exc)

    # Fallback : moteur de patterns Python (règles identiques à main.co)
    return _pattern_check(question)

