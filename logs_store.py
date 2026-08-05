"""
logs_store.py — Stockage persistant des requêtes API (SQLite)

Alimente les endpoints /logs et /dashboard/stats avec de vraies données
(remplace les constantes fictives qui existaient côté frontend). Une seule
table, pas de framework de migration — le volume attendu (usage démo/interne
sur une seule machine) ne le justifie pas.
"""

import sqlite3
import time
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "data" / "request_logs.db"
DB_PATH.parent.mkdir(exist_ok=True)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS request_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                username TEXT,
                method TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                layer TEXT,
                category TEXT,
                detail TEXT,
                pii_types TEXT,
                duration_ms INTEGER
            )
            """
        )
        conn.commit()


init_db()


def log_request(
    username: Optional[str],
    method: str,
    endpoint: str,
    status_code: int,
    layer: Optional[str] = None,
    category: Optional[str] = None,
    detail: Optional[str] = None,
    pii_types: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO request_logs
                (timestamp, username, method, endpoint, status_code, layer, category, detail, pii_types, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (time.time(), username, method, endpoint, status_code, layer, category, detail, pii_types, duration_ms),
        )
        conn.commit()


def get_logs(limit: int = 200, status_filter: Optional[str] = None) -> list[dict]:
    """status_filter: '2xx', '4xx', '5xx' ou None (tout)."""
    query = "SELECT * FROM request_logs"
    params: list = []
    if status_filter == "2xx":
        query += " WHERE status_code < 300"
    elif status_filter == "4xx":
        query += " WHERE status_code >= 400 AND status_code < 500"
    elif status_filter == "5xx":
        query += " WHERE status_code >= 500"
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with _get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def get_stats() -> dict:
    with _get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) c FROM request_logs WHERE endpoint = '/query'"
        ).fetchone()["c"]
        blocked = conn.execute(
            "SELECT COUNT(*) c FROM request_logs WHERE endpoint = '/query' AND status_code >= 400"
        ).fetchone()["c"]
        avg_duration = conn.execute(
            "SELECT AVG(duration_ms) a FROM request_logs WHERE endpoint = '/query' AND status_code = 200"
        ).fetchone()["a"]
        by_category = conn.execute(
            "SELECT category, COUNT(*) c FROM request_logs "
            "WHERE endpoint = '/query' AND category IS NOT NULL GROUP BY category"
        ).fetchall()
        by_layer = conn.execute(
            "SELECT layer, COUNT(*) c FROM request_logs "
            "WHERE endpoint = '/query' AND layer IS NOT NULL GROUP BY layer"
        ).fetchall()
        pii_count = conn.execute(
            "SELECT COUNT(*) c FROM request_logs WHERE endpoint = '/query' AND pii_types IS NOT NULL AND pii_types != ''"
        ).fetchone()["c"]
        trend_rows = conn.execute(
            """
            SELECT date(timestamp, 'unixepoch') day,
                   COUNT(*) total,
                   SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) blocked
            FROM request_logs
            WHERE endpoint = '/query'
            GROUP BY day
            ORDER BY day DESC
            LIMIT 7
            """
        ).fetchall()
        recent = conn.execute(
            "SELECT * FROM request_logs ORDER BY id DESC LIMIT 8"
        ).fetchall()

    return {
        "total_requests": total,
        "blocked_requests": blocked,
        "protection_rate": round(blocked / total * 100, 1) if total else 0.0,
        "avg_response_ms": round(avg_duration) if avg_duration else 0,
        "pii_anonymized_count": pii_count,
        "by_category": {r["category"]: r["c"] for r in by_category},
        "by_layer": {r["layer"]: r["c"] for r in by_layer},
        "activity_trend": [dict(r) for r in reversed(trend_rows)],
        "recent": [dict(r) for r in recent],
    }
