"""
rag/indexer.py — Indexation de documents dans Qdrant

Rôle : prendre des documents texte, les découper en chunks,
les convertir en vecteurs (embeddings) et les stocker dans Qdrant.
Ce fichier est utilisé une fois pour peupler la base vectorielle.
"""

import logging
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from config import OLLAMA_BASE_URL, QDRANT_COLLECTION, QDRANT_HOST, QDRANT_PORT
from security.nemo_guard import check_document

logger = logging.getLogger(__name__)

# ── Constantes d'indexation ───────────────────────────────────────────────────
CHUNK_SIZE    = 512   # taille max d'un chunk en caractères
CHUNK_OVERLAP = 64    # chevauchement entre chunks pour ne pas couper le contexte
EMBEDDING_DIM = 768   # dimension des vecteurs nomic-embed-text


def _get_embeddings() -> OllamaEmbeddings:
    """Retourne le modèle d'embedding configuré."""
    return OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=OLLAMA_BASE_URL,
    )


def _ensure_collection(client: QdrantClient) -> None:
    """Crée la collection Qdrant si elle n'existe pas encore."""
    existing = [c.name for c in client.get_collections().collections]
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        logger.info("Collection '%s' créée dans Qdrant.", QDRANT_COLLECTION)
    else:
        logger.info("Collection '%s' déjà existante.", QDRANT_COLLECTION)


def index_documents(documents: List[Document]) -> int:
    """
    Indexe une liste de documents LangChain dans Qdrant.

    Étapes :
      1. Découpe les documents en chunks
      2. Génère les embeddings via nomic-embed-text (Ollama)
      3. Stocke les vecteurs dans Qdrant

    Retourne le nombre de chunks indexés.
    """
    # Étape 1 — Découpage en chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(documents)
    logger.info("%d chunks générés depuis %d documents.", len(chunks), len(documents))

    # Étape 1bis — Filtre anti-poisoning (LLM04/LLM08) : un chunk avec une
    # instruction injectée (ex: "SYSTEM OVERRIDE") est rejeté ici, à l'entrée
    # dans Qdrant — complète le filtre déjà en place à la récupération
    # (rag/pipeline.py) qui ne couvrait que la sortie, pas l'entrée.
    safe_chunks = []
    for chunk in chunks:
        check = check_document(chunk.page_content)
        if check.is_allowed:
            safe_chunks.append(chunk)
        else:
            logger.warning(
                "Chunk rejeté à l'indexation (source=%s) : %s",
                chunk.metadata.get("source", "inconnu"), check.refusal_message,
            )
    if len(safe_chunks) < len(chunks):
        logger.warning(
            "%d chunk(s) rejeté(s) à l'indexation sur %d pour contenu suspect (LLM04/LLM08).",
            len(chunks) - len(safe_chunks), len(chunks),
        )
    chunks = safe_chunks

    if not chunks:
        logger.warning("Aucun chunk sûr à indexer après filtrage.")
        return 0

    # Étape 2 & 3 — Embedding + stockage dans Qdrant
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    _ensure_collection(client)

    embeddings = _get_embeddings()
    QdrantVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        url=f"http://{QDRANT_HOST}:{QDRANT_PORT}",
        collection_name=QDRANT_COLLECTION,
    )

    logger.info("%d chunks indexés dans la collection '%s'.", len(chunks), QDRANT_COLLECTION)
    return len(chunks)


def index_texts(texts: List[str], source: str = "manuel") -> int:
    """
    Raccourci pour indexer une liste de textes bruts (sans métadonnées).
    Utile pour les tests rapides.
    """
    docs = [Document(page_content=t, metadata={"source": source}) for t in texts]
    return index_documents(docs)
