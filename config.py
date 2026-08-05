import logging
import os
from datetime import timedelta

from dotenv import load_dotenv

# Charge le fichier .env à la racine du projet (s'il existe) dans os.environ
# AVANT que les modules de sécurité (input_guard.py notamment) ne lisent
# HF_TOKEN au chargement. Doit rester le premier import de config.py, car
# main.py importe config avant security.input_guard.
load_dotenv()

# Sans configuration explicite, les logger.info()/warning() des modules du
# projet (ex: statut ML vs fallback de LlamaFirewall) ne s'affichent jamais
# dans la console — uvicorn ne configure que ses propres loggers. On garde
# les libs tierces à WARNING (évite le bruit de langchain/httpx/presidio...)
# mais on remonte security.* et rag.* à INFO pour voir ces messages.
logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
for _pkg in ("security", "rag"):
    logging.getLogger(_pkg).setLevel(logging.INFO)

# ── JWT ──────────────────────────────────────────────────────────────────────
# En production, remplacer par une variable d'environnement
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "changez-moi-en-production-min32chars!!")
JWT_ALGORITHM: str = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

# ── Rate Limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_DEFAULT: str = "20/minute"   # limite globale par IP
RATE_LIMIT_QUERY: str   = "10/minute"   # limite sur la route /query

# ── Utilisateurs autorisés (démo — à remplacer par une vraie base) ───────────
# Format : { "username": "hashed_password" }
# Le hash ci-dessous correspond au mot de passe "dp2026"
# Généré avec : from passlib.context import CryptContext; CryptContext(["bcrypt"]).hash("...")
FAKE_USERS_DB: dict = {
    "admin": {
        "username": "admin",
        "hashed_password": "$2b$12$hS1G.3ZP03.wP5svVcJPpO51D42nGoA6VuiuluI7ZPu1bBYZTvqM.",
    }
}

# ── Qdrant ────────────────────────────────────────────────────────────────────
QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION: str = "documents_securises"

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str    = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
