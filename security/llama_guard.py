"""
security/llama_guard.py — Modération de contenu via Llama Guard 3 (Couches 2 & 5)

Rôle : classifie un texte (question utilisateur ou réponse du LLM) comme
sûr ou dangereux selon la taxonomie Meta (S1-S14 : violence, armes, haine,
automutilation, contenu sexuel...). Complète PromptGuard (input_guard.py),
qui détecte les tentatives d'injection/jailbreak mais pas le contenu
dangereux en tant que tel — les deux couvrent des cas différents.

Utilise llama-guard3:1b via Ollama. La version 8B nécessite 8-16 Go de VRAM,
hors de portée du matériel cible (GTX 1650 Ti, 4 Go, déjà occupée par
Llama 3.1 8B). La version 1B est un vrai modèle Meta entraîné pour ce cas
d'usage (edge/on-device), pas un contournement — moins précise que la 8B
mais réellement fonctionnelle sur ce matériel (testé le 2026-08-05).
"""

import logging
from dataclasses import dataclass

import requests

from config import OLLAMA_BASE_URL

logger = logging.getLogger(__name__)

_MODEL = "llama-guard3:1b"

# S7 ("Atteinte à la vie privée") est explicitement exclu du blocage : c'est
# la responsabilité de Presidio dans ce projet (anonymisation, pas rejet —
# décision de conception actée). Constaté en test le 2026-08-05 : même un
# texte déjà anonymisé par Presidio (ex: "<EMAIL_ADDRESS>") continue de
# déclencher S7 chez Llama Guard 3 1B, ce qui contredit le choix délibéré
# de laisser passer une PII anonymisée plutôt que de bloquer la requête.
_EXCLUDED_CATEGORIES = {"S7"}

# Libellés lisibles pour la taxonomie Meta (Llama Guard 3)
_CATEGORIES = {
    "S1": "Crimes violents",
    "S2": "Crimes non-violents",
    "S3": "Crimes sexuels",
    "S4": "Exploitation d'enfants",
    "S5": "Diffamation",
    "S6": "Conseils spécialisés dangereux",
    "S7": "Atteinte à la vie privée",
    "S8": "Propriété intellectuelle",
    "S9": "Armes de destruction massive",
    "S10": "Haine",
    "S11": "Automutilation",
    "S12": "Contenu sexuel",
    "S13": "Élections",
    "S14": "Abus d'interpréteur de code",
}


@dataclass
class ContentSafetyResult:
    is_safe: bool
    category: str = ""
    reason: str = ""


def check_content(text: str) -> ContentSafetyResult:
    """
    Envoie le texte à Llama Guard 3 (1B) via Ollama et retourne sa
    classification. Utilise /api/chat avec le template intégré au modèle
    Ollama — pas besoin de reconstruire manuellement le format d'invite
    Llama Guard (vérifié le 2026-08-05, format "safe" / "unsafe\\nS<n>").
    """
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": _MODEL,
                "messages": [{"role": "user", "content": text}],
                "stream": False,
                "keep_alive": "10m",
            },
            timeout=60,
        )
        resp.raise_for_status()
        raw = resp.json()["message"]["content"].strip()
    except Exception as exc:
        # Fail-open assumé : si Llama Guard est indisponible, on ne bloque
        # pas la requête — PromptGuard/Presidio/NeMo restent actifs en
        # amont et en aval, cette couche est un complément, pas le seul
        # rempart. Cohérent avec le comportement des autres scanners du
        # projet (LlamaFirewall tombe en fallback regex, pas en blocage total).
        logger.error("Erreur Llama Guard 3 : %s", exc)
        return ContentSafetyResult(is_safe=True)

    lines = raw.splitlines()
    verdict = lines[0].strip().lower() if lines else ""

    if verdict != "unsafe":
        return ContentSafetyResult(is_safe=True)

    category_code = lines[1].strip() if len(lines) > 1 else ""

    if category_code in _EXCLUDED_CATEGORIES:
        logger.info(
            "Llama Guard 3 : catégorie %s détectée mais exclue du blocage (déjà gérée par Presidio).",
            category_code,
        )
        return ContentSafetyResult(is_safe=True)

    category_label = _CATEGORIES.get(category_code, category_code)
    return ContentSafetyResult(
        is_safe=False,
        category=category_code,
        reason=f"Contenu dangereux détecté par Llama Guard 3 (catégorie {category_code} — {category_label})",
    )
