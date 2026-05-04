from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

APP_ROOT = Path(__file__).resolve().parent
DB_PATH = APP_ROOT / "ml_data.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              card_ids_json TEXT NOT NULL,
              tower_troop TEXT NOT NULL,
              predicted_win_rate REAL,
              confidence REAL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS battle_feedback (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              card_ids_json TEXT NOT NULL,
              tower_troop TEXT NOT NULL,
              won INTEGER NOT NULL,
              crowns_for INTEGER,
              crowns_against INTEGER,
              notes TEXT
            )
            """
        )


def log_analysis_event(card_ids: List[int], tower_troop: str, predicted_win_rate: float, confidence: float) -> None:
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO analysis_events (card_ids_json, tower_troop, predicted_win_rate, confidence)
            VALUES (?, ?, ?, ?)
            """,
            (json.dumps(card_ids), tower_troop, float(predicted_win_rate), float(confidence)),
        )


def add_battle_feedback(
    card_ids: List[int],
    tower_troop: str,
    won: bool,
    crowns_for: Optional[int],
    crowns_against: Optional[int],
    notes: Optional[str],
) -> None:
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO battle_feedback (card_ids_json, tower_troop, won, crowns_for, crowns_against, notes)
            VALUES (?, ?, ?, ?, ?, ?)
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


def load_feedback_rows() -> List[Dict]:
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT card_ids_json, tower_troop, won, crowns_for, crowns_against
            FROM battle_feedback
            ORDER BY id DESC
            LIMIT 50000
            """
        ).fetchall()
    out: List[Dict] = []
    for r in rows:
        try:
            ids = json.loads(r["card_ids_json"])
        except Exception:
            continue
        out.append(
            {
                "card_ids": ids,
                "tower_troop": r["tower_troop"],
                "won": int(r["won"]),
                "crowns_for": r["crowns_for"],
                "crowns_against": r["crowns_against"],
            }
        )
    return out

