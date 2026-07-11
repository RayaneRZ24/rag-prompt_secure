import os
from datetime import timedelta

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
# Le hash ci-dessous correspond au mot de passe "dataprotect2025"
# Généré avec : from passlib.context import CryptContext; CryptContext(["bcrypt"]).hash("...")
FAKE_USERS_DB: dict = {
    "admin": {
        "username": "admin",
        "hashed_password": "$2b$12$L9jZaj7hbeiqBU0qKF9Ws.ngFSu0D4ZLIXYI0.7JxUNh9gMNTE.Xu",
    }
}

# ── Qdrant ────────────────────────────────────────────────────────────────────
QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION: str = "documents_securises"

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str    = os.getenv("OLLAMA_MODEL", "mistral:latest")
