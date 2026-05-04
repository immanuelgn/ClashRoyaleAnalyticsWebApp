from __future__ import annotations

import json
import os
from typing import Dict, List, Optional

import psycopg
from psycopg.rows import dict_row


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is required for ml-service.")
    return url


def _conn():
    return psycopg.connect(_database_url(), row_factory=dict_row)


def init_db() -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS analysis_events (
                  id BIGSERIAL PRIMARY KEY,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  card_ids_json JSONB NOT NULL,
                  tower_troop TEXT NOT NULL,
                  predicted_win_rate DOUBLE PRECISION,
                  confidence DOUBLE PRECISION
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS battle_feedback (
                  id BIGSERIAL PRIMARY KEY,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  card_ids_json JSONB NOT NULL,
                  tower_troop TEXT NOT NULL,
                  won INTEGER NOT NULL,
                  crowns_for INTEGER,
                  crowns_against INTEGER,
                  notes TEXT
                )
                """
            )
        conn.commit()


def log_analysis_event(card_ids: List[int], tower_troop: str, predicted_win_rate: float, confidence: float) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO analysis_events (card_ids_json, tower_troop, predicted_win_rate, confidence)
                VALUES (%s, %s, %s, %s)
                """,
                (json.dumps(card_ids), tower_troop, float(predicted_win_rate), float(confidence)),
            )
        conn.commit()


def add_battle_feedback(
    card_ids: List[int],
    tower_troop: str,
    won: bool,
    crowns_for: Optional[int],
    crowns_against: Optional[int],
    notes: Optional[str],
) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO battle_feedback (card_ids_json, tower_troop, won, crowns_for, crowns_against, notes)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    json.dumps(card_ids),
                    tower_troop,
                    1 if won else 0,
                    crowns_for,
                    crowns_against,
                    notes or "",
                ),
            )
        conn.commit()


def load_feedback_rows() -> List[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT card_ids_json, tower_troop, won, crowns_for, crowns_against
                FROM battle_feedback
                ORDER BY id DESC
                LIMIT 50000
                """
            )
            rows = cur.fetchall()
    out: List[Dict] = []
    for r in rows:
        raw_ids = r.get("card_ids_json")
        if isinstance(raw_ids, str):
            try:
                ids = json.loads(raw_ids)
            except Exception:
                continue
        else:
            ids = raw_ids
        if not isinstance(ids, list):
            continue
        out.append(
            {
                "card_ids": ids,
                "tower_troop": r.get("tower_troop"),
                "won": int(r.get("won") or 0),
                "crowns_for": r.get("crowns_for"),
                "crowns_against": r.get("crowns_against"),
            }
        )
    return out

