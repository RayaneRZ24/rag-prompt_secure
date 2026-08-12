import time
from datetime import timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.concurrency import run_in_threadpool

from auth import authenticate_user, create_access_token, get_current_user
from config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, RATE_LIMIT_DEFAULT, RATE_LIMIT_QUERY
from logs_store import get_logs, get_stats, log_request
from security.input_guard import inspect_input
from security.llama_guard import check_content
from security.nemo_guard import check_document, check_topic
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

# ── CORS (frontend React sur port 5173) ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Journalisation des requêtes (alimente /logs et /dashboard/stats) ──────────
# Les routes renseignent request.state.{username,layer,category,detail,pii_types}
# avant de répondre (succès ou HTTPException) ; ce middleware englobe toute la
# requête (dépendances + route + gestion d'exception FastAPI) donc ces valeurs
# sont encore lisibles une fois call_next() revenu, qu'il y ait eu blocage ou non.
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.time()
    request.state.username = None
    request.state.layer = None
    request.state.category = None
    request.state.detail = None
    request.state.pii_types = None

    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        status_code = 500
        raise
    finally:
        log_request(
            username=getattr(request.state, "username", None),
            method=request.method,
            endpoint=request.url.path,
            status_code=status_code,
            layer=getattr(request.state, "layer", None),
            category=getattr(request.state, "category", None),
            detail=getattr(request.state, "detail", None),
            pii_types=getattr(request.state, "pii_types", None),
            duration_ms=int((time.time() - start) * 1000),
        )

    return response


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    source: str = "rag_pipeline"


class DocumentCheckRequest(BaseModel):
    content: str


class DocumentCheckResponse(BaseModel):
    is_allowed: bool
    reason: str = ""


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
    request.state.username = form_data.username
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        request.state.detail = "Identifiant ou mot de passe incorrect"
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
    request.state.username = current_user["username"]

    # ── Couche 2 : inspection de l'entrée ────────────────────────────────────
    # LlamaFirewall utilise asyncio.run() en interne — incompatible avec un
    # appel synchrone direct depuis une route async (boucle déjà active).
    # Isolé dans un thread comme rag_query ci-dessous, où aucune boucle
    # asyncio n'est déjà en cours.
    guard = await run_in_threadpool(inspect_input, body.question)

    if guard.pii_detected:
        request.state.pii_types = ", ".join(guard.pii_detected)

    if not guard.is_safe:
        request.state.layer = "Couche 2 — PromptGuard"
        request.state.category = "LLM01"
        request.state.detail = guard.reason
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requête bloquée par le système de sécurité : {guard.reason}",
        )

    # ── Couche 2 (suite) : modération de contenu Llama Guard 3 ───────────────
    # Complète PromptGuard : détecte le contenu dangereux (violence, armes,
    # haine...) plutôt que les tentatives d'injection/jailbreak.
    content_check = await run_in_threadpool(check_content, guard.sanitized_text)
    if not content_check.is_safe:
        request.state.layer = "Couche 2 — Llama Guard 3"
        request.state.category = "Contenu dangereux"
        request.state.detail = content_check.reason
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requête bloquée par le système de sécurité : {content_check.reason}",
        )

    # ── Couche 3 : NeMo Guardrails (vérification du sujet, orchestration) ────
    # Même contrainte : generate() de NeMo n'est pas compatible boucle async active.
    nemo = await run_in_threadpool(check_topic, guard.sanitized_text)
    if not nemo.is_allowed:
        request.state.layer = "Couche 3 — NeMo Guardrails"
        request.state.category = "LLM01"
        request.state.detail = nemo.refusal_message
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=nemo.refusal_message,
        )

    # ── Couche 3 : pipeline RAG ───────────────────────────────────────────────
    # Le pipeline LangChain/Ollama est synchrone et peut prendre plusieurs
    # secondes sur le matériel cible. Le sortir de la boucle async évite de
    # bloquer /health et toutes les autres requêtes pendant la génération.
    result = await run_in_threadpool(rag_query, guard.sanitized_text)

    # ── Couche 5 : inspection de la sortie ───────────────────────────────────
    # str() nécessaire car result.answer peut être un TextAccessor (LangChain)
    # Même contrainte asyncio.run() que la couche 2 — isolé dans un thread.
    # anonymize_pii=False en mode général : pas de RGPD/documents internes en
    # jeu, seul le mode sécurité expose un vrai risque LLM02 (voir output_guard.py).
    out = await run_in_threadpool(inspect_output, str(result.answer), result.is_security)
    if not out.is_safe:
        request.state.layer = "Couche 5 — Filtre de sortie"
        request.state.category = "LLM07" if "prompt système" in out.reason.lower() else "LLM05"
        request.state.detail = out.reason
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Réponse bloquée par le système de sécurité : {out.reason}",
        )

    # ── Couche 5 (suite) : modération de contenu Llama Guard 3 sur la sortie ─
    out_content_check = await run_in_threadpool(check_content, out.sanitized_response)
    if not out_content_check.is_safe:
        request.state.layer = "Couche 5 — Llama Guard 3"
        request.state.category = "Contenu dangereux"
        request.state.detail = out_content_check.reason
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Réponse bloquée par le système de sécurité : {out_content_check.reason}",
        )

    return QueryResponse(
        answer=out.sanitized_response,
        source=", ".join(result.sources) if result.sources else "rag_pipeline",
    )


@app.get("/logs", tags=["Monitoring"])
async def logs(
    status_filter: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    """Retourne les requêtes récentes enregistrées (filtrable par 2xx/4xx/5xx)."""
    return {"logs": get_logs(limit=limit, status_filter=status_filter)}


@app.get("/dashboard/stats", tags=["Monitoring"])
async def dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Statistiques agrégées réelles pour le tableau de bord."""
    return get_stats()


@app.post("/tests/check-document", response_model=DocumentCheckResponse, tags=["Monitoring"])
async def check_document_endpoint(
    body: DocumentCheckRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Expose check_document() (LLM04/LLM08 — filtre anti-empoisonnement) pour
    le Security Test Center. N'écrit rien dans Qdrant — teste directement le
    même classifieur utilisé à l'indexation (rag/indexer.py) et à la
    récupération (rag/pipeline.py), sans toucher à la vraie base documentaire.
    """
    result = await run_in_threadpool(check_document, body.content)
    return DocumentCheckResponse(is_allowed=result.is_allowed, reason=result.refusal_message)
