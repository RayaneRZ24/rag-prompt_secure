from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from auth import authenticate_user, create_access_token, get_current_user
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, RATE_LIMIT_DEFAULT, RATE_LIMIT_QUERY
from security.input_guard import inspect_input
from security.nemo_guard import check_topic
from security.output_guard import inspect_output
from rag.pipeline import query as rag_query

# ── Rate Limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT_DEFAULT])

# ── Application FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="RAG Sécurisé — API Gateway",
    description="Point d'entrée sécurisé du système RAG (DataProtect)",
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    source: str = "rag_pipeline"


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Vérifie que le service est opérationnel."""
    return {"status": "ok", "service": "rag-secure-gateway"}


@app.post("/login", response_model=Token, tags=["Authentification"])
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Authentification par identifiant/mot de passe.
    Retourne un JWT Bearer valable 30 minutes.
    """
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/query", response_model=QueryResponse, tags=["RAG"])
@limiter.limit(RATE_LIMIT_QUERY)
async def query(
    request: Request,
    body: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Endpoint principal : reçoit une question, la transmet au pipeline RAG.
    Requiert un JWT valide dans l'en-tête Authorization: Bearer <token>.
    (Le pipeline RAG sera branché ici dans la Couche 3.)
    """
    # ── Couche 2 : inspection de l'entrée ────────────────────────────────────
    guard = inspect_input(body.question)

    if not guard.is_safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requête bloquée par le système de sécurité : {guard.reason}",
        )

    # ── Couche 4 : NeMo Guardrails (vérification du sujet) ───────────────────
    nemo = check_topic(guard.sanitized_text)
    if not nemo.is_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=nemo.refusal_message,
        )

    # ── Couche 3 : pipeline RAG ───────────────────────────────────────────────
    result = rag_query(guard.sanitized_text)

    # ── Couche 5 : inspection de la sortie ───────────────────────────────────
    out = inspect_output(result.answer)
    if not out.is_safe:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Réponse bloquée par le système de sécurité : {out.reason}",
        )

    return QueryResponse(
        answer=out.sanitized_response,
        source=", ".join(result.sources) if result.sources else "rag_pipeline",
    )
