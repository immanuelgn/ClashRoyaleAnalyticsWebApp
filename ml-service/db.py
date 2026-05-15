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
                  deck_fingerprint TEXT,
                  tower_troop TEXT NOT NULL,
                  predicted_win_rate DOUBLE PRECISION,
                  confidence DOUBLE PRECISION,
                  score_proxy DOUBLE PRECISION,
                  model_version TEXT,
                  source TEXT,
                  meta_similarity DOUBLE PRECISION,
                  meta_weighted_win_rate DOUBLE PRECISION
                )
                """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS battle_feedback (
                  id BIGSERIAL PRIMARY KEY,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  card_ids_json JSONB NOT NULL,
                  deck_fingerprint TEXT,
                  tower_troop TEXT NOT NULL,
                  won INTEGER NOT NULL,
                  crowns_for INTEGER,
                  crowns_against INTEGER,
                  opponent_archetype TEXT,
                  game_mode TEXT,
                  trophies INTEGER,
                  patch_version TEXT,
                  notes TEXT
                )
                """
            )

            cur.execute("ALTER TABLE analysis_events ADD COLUMN IF NOT EXISTS deck_fingerprint TEXT")
            cur.execute("ALTER TABLE analysis_events ADD COLUMN IF NOT EXISTS model_version TEXT")
            cur.execute("ALTER TABLE analysis_events ADD COLUMN IF NOT EXISTS source TEXT")
            cur.execute("ALTER TABLE analysis_events ADD COLUMN IF NOT EXISTS meta_similarity DOUBLE PRECISION")
            cur.execute("ALTER TABLE analysis_events ADD COLUMN IF NOT EXISTS meta_weighted_win_rate DOUBLE PRECISION")

            cur.execute("ALTER TABLE battle_feedback ADD COLUMN IF NOT EXISTS deck_fingerprint TEXT")
            cur.execute("ALTER TABLE battle_feedback ADD COLUMN IF NOT EXISTS opponent_archetype TEXT")
            cur.execute("ALTER TABLE battle_feedback ADD COLUMN IF NOT EXISTS game_mode TEXT")
            cur.execute("ALTER TABLE battle_feedback ADD COLUMN IF NOT EXISTS trophies INTEGER")
            cur.execute("ALTER TABLE battle_feedback ADD COLUMN IF NOT EXISTS patch_version TEXT")

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
                CREATE OR REPLACE FUNCTION compute_deck_fingerprint(ids JSONB)
                RETURNS TEXT
                LANGUAGE sql
                IMMUTABLE
                AS $$
                  SELECT md5(
                    COALESCE(
                      (
                        SELECT string_agg(v, ',' ORDER BY v::BIGINT)
                        FROM jsonb_array_elements_text(ids) t(v)
                      ),
                      ''
                    )
                  )
                $$;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE FUNCTION is_valid_unique_deck(ids JSONB)
                RETURNS BOOLEAN
                LANGUAGE sql
                IMMUTABLE
                AS $$
                  SELECT
                    jsonb_typeof(ids) = 'array'
                    AND jsonb_array_length(ids) = 8
                    AND (
                      SELECT bool_and(v ~ '^[0-9]+$')
                      FROM jsonb_array_elements_text(ids) t(v)
                    )
                    AND (
                      SELECT count(*) = count(DISTINCT v)
                      FROM jsonb_array_elements_text(ids) t(v)
                    )
                $$;
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE FUNCTION trg_set_deck_fingerprint()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                  NEW.deck_fingerprint := compute_deck_fingerprint(NEW.card_ids_json);
                  RETURN NEW;
                END;
                $$;
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger
                    WHERE tgname = 'analysis_events_set_deck_fingerprint'
                  ) THEN
                    CREATE TRIGGER analysis_events_set_deck_fingerprint
                    BEFORE INSERT OR UPDATE OF card_ids_json
                    ON analysis_events
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_set_deck_fingerprint();
                  END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger
                    WHERE tgname = 'battle_feedback_set_deck_fingerprint'
                  ) THEN
                    CREATE TRIGGER battle_feedback_set_deck_fingerprint
                    BEFORE INSERT OR UPDATE OF card_ids_json
                    ON battle_feedback
                    FOR EACH ROW
                    EXECUTE FUNCTION trg_set_deck_fingerprint();
                  END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                UPDATE analysis_events
                SET deck_fingerprint = compute_deck_fingerprint(card_ids_json)
                WHERE deck_fingerprint IS NULL
                """
            )
            cur.execute(
                """
                UPDATE battle_feedback
                SET deck_fingerprint = compute_deck_fingerprint(card_ids_json)
                WHERE deck_fingerprint IS NULL
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'analysis_events_card_ids_valid_ck'
                  ) THEN
                    ALTER TABLE analysis_events
                    ADD CONSTRAINT analysis_events_card_ids_valid_ck
                    CHECK (is_valid_unique_deck(card_ids_json)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'analysis_events_pred_wr_range_ck'
                  ) THEN
                    ALTER TABLE analysis_events
                    ADD CONSTRAINT analysis_events_pred_wr_range_ck
                    CHECK (predicted_win_rate IS NULL OR (predicted_win_rate >= 0 AND predicted_win_rate <= 100)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'analysis_events_conf_range_ck'
                  ) THEN
                    ALTER TABLE analysis_events
                    ADD CONSTRAINT analysis_events_conf_range_ck
                    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'analysis_events_score_proxy_range_ck'
                  ) THEN
                    ALTER TABLE analysis_events
                    ADD CONSTRAINT analysis_events_score_proxy_range_ck
                    CHECK (score_proxy IS NULL OR (score_proxy >= 0 AND score_proxy <= 130)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'battle_feedback_card_ids_valid_ck'
                  ) THEN
                    ALTER TABLE battle_feedback
                    ADD CONSTRAINT battle_feedback_card_ids_valid_ck
                    CHECK (is_valid_unique_deck(card_ids_json)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'battle_feedback_won_binary_ck'
                  ) THEN
                    ALTER TABLE battle_feedback
                    ADD CONSTRAINT battle_feedback_won_binary_ck
                    CHECK (won IN (0, 1)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'battle_feedback_crowns_for_ck'
                  ) THEN
                    ALTER TABLE battle_feedback
                    ADD CONSTRAINT battle_feedback_crowns_for_ck
                    CHECK (crowns_for IS NULL OR (crowns_for >= 0 AND crowns_for <= 3)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'battle_feedback_crowns_against_ck'
                  ) THEN
                    ALTER TABLE battle_feedback
                    ADD CONSTRAINT battle_feedback_crowns_against_ck
                    CHECK (crowns_against IS NULL OR (crowns_against >= 0 AND crowns_against <= 3)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )
            cur.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'battle_feedback_trophies_ck'
                  ) THEN
                    ALTER TABLE battle_feedback
                    ADD CONSTRAINT battle_feedback_trophies_ck
                    CHECK (trophies IS NULL OR (trophies >= 0 AND trophies <= 10000)) NOT VALID;
                  END IF;
                END
                $$;
                """
            )

            cur.execute("CREATE INDEX IF NOT EXISTS analysis_events_created_at_idx ON analysis_events (created_at DESC)")
            cur.execute("CREATE INDEX IF NOT EXISTS analysis_events_tower_created_idx ON analysis_events (tower_troop, created_at DESC)")
            cur.execute("CREATE INDEX IF NOT EXISTS analysis_events_deck_fingerprint_idx ON analysis_events (deck_fingerprint)")
            cur.execute("CREATE INDEX IF NOT EXISTS analysis_events_model_version_idx ON analysis_events (model_version)")

            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_created_at_idx ON battle_feedback (created_at DESC)")
            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_won_created_idx ON battle_feedback (won, created_at DESC)")
            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_deck_fingerprint_idx ON battle_feedback (deck_fingerprint)")
            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_patch_mode_idx ON battle_feedback (patch_version, game_mode)")
            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_opp_arch_idx ON battle_feedback (opponent_archetype)")
            cur.execute("CREATE INDEX IF NOT EXISTS battle_feedback_trophies_idx ON battle_feedback (trophies)")

            cur.execute(
                """
                CREATE OR REPLACE VIEW ml_feedback_daily AS
                SELECT
                  date_trunc('day', created_at) AS day,
                  count(*) AS games,
                  round(avg(won)::numeric, 4) AS win_rate,
                  count(DISTINCT deck_fingerprint) AS unique_decks
                FROM battle_feedback
                GROUP BY 1
                ORDER BY 1 DESC
                """
            )

            cur.execute(
                """
                CREATE OR REPLACE VIEW ml_deck_outcomes AS
                SELECT
                  deck_fingerprint,
                  tower_troop,
                  count(*) AS games,
                  round(avg(won)::numeric, 4) AS win_rate,
                  round(avg(COALESCE(crowns_for, 0) - COALESCE(crowns_against, 0))::numeric, 3) AS avg_crown_delta,
                  max(created_at) AS last_seen_at
                FROM battle_feedback
                WHERE deck_fingerprint IS NOT NULL
                GROUP BY 1, 2
                ORDER BY games DESC
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
    model_version: Optional[str] = None,
    source: Optional[str] = None,
    meta_similarity: Optional[float] = None,
    meta_weighted_win_rate: Optional[float] = None,
) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO analysis_events (
                  card_ids_json, tower_troop, predicted_win_rate, confidence, score_proxy,
                  model_version, source, meta_similarity, meta_weighted_win_rate
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    json.dumps(card_ids),
                    tower_troop,
                    float(predicted_win_rate),
                    float(confidence),
                    None if score_proxy is None else float(score_proxy),
                    (model_version or "").strip() or None,
                    (source or "").strip() or None,
                    None if meta_similarity is None else float(meta_similarity),
                    None if meta_weighted_win_rate is None else float(meta_weighted_win_rate),
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
                SELECT COUNT(DISTINCT deck_fingerprint) AS n
                FROM battle_feedback
                WHERE deck_fingerprint IS NOT NULL
                """
            )
            unique_feedback_decks = int((cur.fetchone() or {}).get("n") or 0)

            cur.execute(
                """
                SELECT id, created_at, predicted_win_rate, confidence, score_proxy, model_version, source
                FROM analysis_events
                ORDER BY id DESC
                LIMIT 5
                """
            )
            last_events = cur.fetchall() or []

            cur.execute(
                """
                SELECT id, created_at, won, tower_troop, opponent_archetype, trophies
                FROM battle_feedback
                ORDER BY id DESC
                LIMIT 5
                """
            )
            last_feedback = cur.fetchall() or []

    calib = get_online_calibration()
    return {
        "analysisEvents": analysis_n,
        "feedbackEvents": feedback_n,
        "uniqueFeedbackDecks": unique_feedback_decks,
        "calibration": calib,
        "lastEvents": last_events,
        "lastFeedback": last_feedback,
    }


def add_battle_feedback(
    card_ids: List[int],
    tower_troop: str,
    won: bool,
    crowns_for: Optional[int],
    crowns_against: Optional[int],
    opponent_archetype: Optional[str],
    game_mode: Optional[str],
    trophies: Optional[int],
    patch_version: Optional[str],
    notes: Optional[str],
) -> None:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO battle_feedback (
                  card_ids_json, tower_troop, won, crowns_for, crowns_against,
                  opponent_archetype, game_mode, trophies, patch_version, notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    json.dumps(card_ids),
                    tower_troop,
                    1 if won else 0,
                    crowns_for,
                    crowns_against,
                    (opponent_archetype or "").strip() or None,
                    (game_mode or "").strip() or None,
                    trophies,
                    (patch_version or "").strip() or None,
                    notes or "",
                ),
            )
        conn.commit()


def load_feedback_rows() -> List[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT card_ids_json, tower_troop, won, crowns_for, crowns_against, opponent_archetype, game_mode, trophies, patch_version
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
                "opponent_archetype": r.get("opponent_archetype"),
                "game_mode": r.get("game_mode"),
                "trophies": r.get("trophies"),
                "patch_version": r.get("patch_version"),
            }
        )
    return out
