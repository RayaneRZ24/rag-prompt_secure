# SecureRAG-DP

Assistant IA de type RAG (Retrieval-Augmented Generation), défendu en profondeur contre 6 risques du **OWASP LLM Top 10 2025**. Projet réalisé dans le cadre d'un stage de 4ème année Data Science/IA (EMSI Casablanca) chez **DataProtect**, cybersécurité.

100% local : aucun appel à une API IA externe (LLM, embeddings et modération tournent tous via [Ollama](https://ollama.com)).

## Périmètre OWASP couvert

| Risque | Description |
|---|---|
| **LLM01** | Prompt Injection |
| **LLM02** | Sensitive Information Disclosure |
| **LLM04** | Data & Model Poisoning |
| **LLM05** | Improper Output Handling |
| **LLM07** | System Prompt Leakage |
| **LLM08** | Vector & Embedding Weaknesses |

LLM03/06/09/10 sont explicitement hors périmètre.

## Architecture — 5 couches de défense en profondeur

```
Requête → 1. FastAPI (auth/quotas) → 2. Protection entrée → 3. Orchestration
        → 4. Qdrant → 5. Protection sortie → Réponse
```

1. **FastAPI** — JWT + rate limiting + journalisation réelle (SQLite)
2. **Protection entrée** — PromptGuard2 (LlamaFirewall) + Llama Guard 3 (1B) + Presidio (PII)
3. **Orchestration** — LangChain + NeMo Guardrails (rail de sujet) + filtre anti-empoisonnement des chunks (LLM04/08) + génération
4. **Qdrant** — base vectorielle (ne bloque jamais elle-même une requête)
5. **Protection sortie** — Llama Guard 3 + Presidio + détection de fuite du prompt système (LLM07) + détection de code/contenu dangereux (LLM05) + détection de fuite d'identifiants (LLM02)

Les couches 2, 3 et 5 peuvent chacune interrompre une requête ou une réponse ; les couches 1 et 4 ne font qu'authentifier/fournir des données.

## Stack technique

| Domaine | Outils |
|---|---|
| API & Orchestration | FastAPI, LangChain, NeMo Guardrails |
| Données & Modèles | Qdrant, Ollama (Llama 3.1 8B), Llama Guard 3 (1B) |
| Sécurité | Microsoft Presidio, LlamaFirewall (PromptGuard2) |
| Frontend | React 19, Tailwind CSS v4, Vite |
| Monitoring | SQLite (logs réels), dashboard de supervision |

## Installation

**Prérequis** : Python 3.11, Node.js, [Ollama](https://ollama.com), Qdrant (via Docker).

```bash
# Backend
pip install -r requirements.txt
python -m spacy download fr_core_news_lg

# Modèles Ollama
ollama pull llama3.1:8b
ollama pull llama-guard3:1b
ollama pull nomic-embed-text

# Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Configuration
cp .env.example .env   # puis remplir les valeurs (voir commentaires dans le fichier)

# Frontend
cd frontend && npm install
```

**Lancement**

```bash
# Backend (racine du projet)
uvicorn main:app --reload

# Frontend
cd frontend && npm run dev
```

## Validation

- **Garak** (scanner de vulnérabilités NVIDIA) contre l'API protégée : **0% de taux de réussite d'attaque** sur 7 sondes (LLM01/02/05/07), contre ~60% sur le LLM nu sans protection.
- **Centre de test interne** (interface web) : 12 cas d'attaque/légitimes couvrant les 6 catégories OWASP ciblées, testés en direct contre l'API réelle.

## Limites assumées

- **CodeShield** (analyse statique de code) indisponible sur Windows — bug de résolution de chemin dans le package `codeshield`. Remplacé par une détection regex des patterns de code les plus dangereux.
- **AlignmentCheck** éliminé — dépend d'une API externe (Together AI), incompatible avec l'objectif 100% local.
- **Llama Guard 3 en version 1B**, pas 8B — contrainte VRAM (GPU 4 Go).
- Détections de fuite basées sur des patterns/heuristiques (prompt système, identifiants) plutôt que sur une compréhension sémantique complète — documenté comme compromis pragmatique, pas une garantie absolue.
