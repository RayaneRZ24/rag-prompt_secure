"""
data/documents_demo.py — Corpus de démonstration pour le RAG (Qdrant)

Contenu source des documents indexés dans la collection `documents_securises`.
Existait uniquement comme vecteurs dans Qdrant jusqu'ici (jamais committé nulle
part) — ce fichier sert de source de vérité reproductible : si Qdrant est
réinitialisé, relancer `python data/documents_demo.py` recharge le corpus.

Usage : python data/documents_demo.py
Prérequis : Qdrant et Ollama (embeddings) démarrés.
"""

DOCUMENTS = [
    # ── Corpus initial ──────────────────────────────────────────────────────
    {
        "source": "politique_securite_dataprotect",
        "content": "La politique de securite de DataProtect exige que toutes les donnees clients soient chiffrees en AES-256.",
    },
    {
        "source": "politique_securite_dataprotect",
        "content": "Les acces aux systemes sensibles sont proteges par une authentification multi-facteurs obligatoire.",
    },
    {
        "source": "politique_securite_dataprotect",
        "content": "Les mots de passe doivent contenir au minimum 12 caracteres avec majuscules, chiffres et symboles.",
    },
    {
        "source": "politique_securite_dataprotect",
        "content": "DataProtect est une entreprise marocaine specialisee en cybersecurite et protection des donnees personnelles.",
    },
    {
        "source": "politique_securite_dataprotect",
        "content": "En cas de violation de donnees, le responsable securite doit etre notifie dans les 24 heures.",
    },

    # ── Ajouts — sujets distincts, pas de redondance avec le corpus initial ──
    {
        "source": "droits_rgpd_utilisateurs",
        "content": "Toute personne concernee dispose d'un droit d'acces, de rectification et d'effacement de ses donnees personnelles. Les demandes doivent etre adressees au delegue a la protection des donnees (DPO) et traitees sous un delai maximal d'un mois. Le droit a la portabilite permet de recuperer ses donnees dans un format structure et lisible par machine.",
    },
    {
        "source": "continuite_activite_sauvegardes",
        "content": "Les sauvegardes des systemes critiques sont effectuees quotidiennement et chiffrees avant stockage hors site. Le plan de reprise d'activite fixe un objectif de temps de reprise (RTO) de 4 heures pour les services essentiels. Des tests de restauration sont realises trimestriellement pour valider l'integrite des sauvegardes.",
    },
    {
        "source": "gestion_acces_privileges",
        "content": "L'attribution des droits d'acces suit le principe du moindre privilege : chaque utilisateur ne dispose que des permissions strictement necessaires a ses fonctions. Les droits d'acces sont revus tous les trimestres, et les comptes sont desactives immediatement au depart d'un collaborateur. Les acces administrateur sont systematiquement journalises.",
    },
    {
        "source": "sensibilisation_formation_securite",
        "content": "Tous les collaborateurs suivent une formation obligatoire de sensibilisation a la cybersecurite lors de leur integration, renouvelee chaque annee. Des simulations de phishing sont organisees regulierement pour evaluer la vigilance des equipes. La charte informatique interne encadre l'usage des outils numeriques et des donnees de l'entreprise.",
    },
]


if __name__ == "__main__":
    from langchain_core.documents import Document
    from rag.indexer import index_documents

    docs = [Document(page_content=d["content"], metadata={"source": d["source"]}) for d in DOCUMENTS]
    count = index_documents(docs)
    print(f"{count} chunks indexes dans Qdrant (sur {len(docs)} documents source).")
