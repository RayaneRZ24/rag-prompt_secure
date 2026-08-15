"""
tests/garak_rag_api_generator.py — Générateur Garak pour l'API RAG protégée

Contrairement au baseline "LLM nu" (garak_config.yaml, tests/run_garak.py), ce
générateur attaque l'API FastAPI protégée (JWT + 5 couches) au lieu d'Ollama
directement. Doit être copié dans garak/generators/ pour être chargeable par
le système de plugins de Garak — tests/run_garak_protected.py s'en charge
automatiquement à chaque lancement.

Gère ce que le RestGenerator natif de Garak ne gère pas pour notre cas :
  - authentification JWT via /login, avec renouvellement automatique
    (le token expire au bout de 30 min, un run Garak peut durer plus longtemps)
  - rate limit de l'API (10 requêtes/minute sur /query) — throttling côté client
  - un blocage de sécurité (400/403/500) est un résultat légitime ("attaque
    neutralisée") : on retourne une réponse vide plutôt que None. Retourner
    None fait que Garak SKIP le prompt (exclu du dénominateur de l'ASR),
    alors qu'une chaîne vide est évaluée normalement par les détecteurs et
    comptée comme "safe" (aucun contenu dangereux trouvé) — c'est ce qu'on
    veut : un blocage doit compter comme un succès de la défense, pas être
    exclu du calcul.
"""

import logging
import time
from typing import List, Union

import backoff
import requests

from garak import _config
from garak.attempt import Conversation, Message
from garak.exception import GeneratorBackoffTrigger, RateLimitHit
from garak.generators.base import Generator

_API_BASE = "http://localhost:8000"
_CREDENTIALS = {"username": "admin", "password": "dp2026"}
_MIN_INTERVAL_SECONDS = 6.5  # marge de sécurité sous la limite 10/min de l'API


class RagApiGenerator(Generator):
    """Attaque l'API RAG protégée (JWT + PromptGuard + NeMo + Llama Guard + Presidio)."""

    generator_family_name = "RagApiGenerator"
    supports_multiple_generations = False

    def __init__(self, name="rag-api", config_root=_config):
        super().__init__(name, config_root=config_root)
        self._token = None
        self._last_call_time = 0.0
        self._login()

    def _login(self):
        resp = requests.post(f"{_API_BASE}/login", data=_CREDENTIALS, timeout=60)
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        logging.info("RagApiGenerator: token JWT (re)obtenu.")

    def _throttle(self):
        elapsed = time.time() - self._last_call_time
        if elapsed < _MIN_INTERVAL_SECONDS:
            time.sleep(_MIN_INTERVAL_SECONDS - elapsed)
        self._last_call_time = time.time()

    @backoff.on_exception(
        backoff.fibo, (RateLimitHit, GeneratorBackoffTrigger), max_value=70
    )
    def _call_model(
        self, prompt: Conversation, generations_this_call: int = 1
    ) -> List[Union[Message, None]]:
        text = prompt.last_message().text
        self._throttle()

        try:
            resp = requests.post(
                f"{_API_BASE}/query",
                json={"question": text},
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=120,
            )
        except requests.exceptions.RequestException as exc:
            raise GeneratorBackoffTrigger(f"Erreur réseau : {exc}")

        if resp.status_code == 401:
            # Token expiré (>30 min) -> reconnexion puis un seul essai de plus
            self._login()
            resp = requests.post(
                f"{_API_BASE}/query",
                json={"question": text},
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=120,
            )

        if resp.status_code == 429:
            raise RateLimitHit(f"Rate limited : {resp.status_code}")

        if resp.status_code in (400, 403, 500):
            # Bloqué par une des couches de sécurité -> réponse vide plutôt
            # que None (voir docstring du module : None = skip = exclu du
            # calcul d'ASR, alors qu'on veut que ça compte comme "safe").
            return [Message("")]

        if resp.status_code != 200:
            raise GeneratorBackoffTrigger(
                f"Erreur serveur inattendue : {resp.status_code}"
            )

        answer = resp.json().get("answer", "")
        return [Message(answer)]


DEFAULT_CLASS = "RagApiGenerator"
