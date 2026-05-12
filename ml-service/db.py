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
                  confidence DOUBLE PRECISION,
                  score_proxy DOUBLE PRECISION
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
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS online_calibration (
                  id INTEGER PRIMARY KEY,
                  bias DOUBLE PRECISION NOT NULL DEFAULT 0,
                  scale DOUBLE PRECISION NOT NULL DEFAULT 1,
                  seen_events BIGINT NOT NULL DEFAULT 0,
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                INSERT INTO online_calibration (id, bias, scale, seen_events)
                VALUES (1, 0, 1, 0)
                ON CONFLICT (id) DO NOTHING
                """
            )
        conn.commit()


def log_analysis_event(
    card_ids: List[int],
    tower_troop: str,
    predicted_win_rate: float,
    confidence: float,
    score_proxy: Optional[float] = None,
) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO analysis_events (card_ids_json, tower_troop, predicted_win_rate, confidence, score_proxy)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    json.dumps(card_ids),
                    tower_troop,
                    float(predicted_win_rate),
                    float(confidence),
                    None if score_proxy is None else float(score_proxy),
                ),
            )
        conn.commit()


def get_online_calibration() -> Dict:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT bias, scale, seen_events, updated_at
                FROM online_calibration
                WHERE id = 1
                """
            )
            row = cur.fetchone() or {}
    return {
        "bias": float(row.get("bias") or 0.0),
        "scale": float(row.get("scale") or 1.0),
        "seenEvents": int(row.get("seen_events") or 0),
        "updatedAt": row.get("updated_at"),
    }


def update_online_calibration(predicted_win_rate: float, score_proxy: float) -> Dict:
    score_proxy = max(0.0, min(130.0, float(score_proxy)))
    target_wr = 35.0 + (score_proxy / 130.0) * 45.0
    target_wr = max(35.0, min(80.0, target_wr))

    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT bias, scale, seen_events FROM online_calibration WHERE id = 1 FOR UPDATE"
            )
            row = cur.fetchone() or {"bias": 0.0, "scale": 1.0, "seen_events": 0}
            bias = float(row.get("bias") or 0.0)
            scale = float(row.get("scale") or 1.0)
            seen = int(row.get("seen_events") or 0)

            adjusted = max(35.0, min(80.0, predicted_win_rate * scale + bias))
            error = target_wr - adjusted
            lr = 0.03
            bias = max(-12.0, min(12.0, bias + lr * error))
            scale = max(0.75, min(1.35, scale + (lr * 0.0025) * error * ((predicted_win_rate - 57.5) / 22.5)))
            seen += 1

            cur.execute(
                """
                UPDATE online_calibration
                SET bias = %s, scale = %s, seen_events = %s, updated_at = NOW()
                WHERE id = 1
                """,
                (bias, scale, seen),
            )
        conn.commit()

    return {"bias": bias, "scale": scale, "seenEvents": seen}


def get_learning_stats() -> Dict:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM analysis_events")
            analysis_n = int((cur.fetchone() or {}).get("n") or 0)
            cur.execute("SELECT COUNT(*) AS n FROM battle_feedback")
            feedback_n = int((cur.fetchone() or {}).get("n") or 0)
            cur.execute(
                """
                SELECT id, created_at, predicted_win_rate, confidence, score_proxy
                FROM analysis_events
                ORDER BY id DESC
                LIMIT 5
                """
            )
            last_events = cur.fetchall() or []
    calib = get_online_calibration()
    return {
        "analysisEvents": analysis_n,
        "feedbackEvents": feedback_n,
        "calibration": calib,
        "lastEvents": last_events,
    }


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
