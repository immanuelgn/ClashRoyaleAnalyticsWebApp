from __future__ import annotations

import json
import os
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Deque, Dict, List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db import (
    add_battle_feedback,
    get_learning_stats,
    get_online_calibration,
    init_db,
    log_analysis_event,
    normalize_opponent_archetype,
    update_online_calibration,
)
from feature_engineering import (
    build_feature_vector_from_ids,
    load_cards,
    map_cards_by_id,
    normalize_tower,
)

APP_ROOT = Path(__file__).resolve().parent
MODEL_PATH = APP_ROOT / "model.joblib"
META_PATH = APP_ROOT / "model_meta.json"


def _truthy(v: Optional[str]) -> bool:
    return str(v or "").strip().lower() in {"1", "true", "yes", "on"}


ML_SERVICE_AUTH_TOKEN = str(os.getenv("ML_SERVICE_AUTH_TOKEN", "")).strip()
ML_ENABLE_DOCS = _truthy(os.getenv("ML_ENABLE_DOCS"))
ML_ENABLE_SCORE_PROXY = _truthy(os.getenv("ML_ENABLE_SCORE_PROXY"))
ML_WRITE_RATE_LIMIT_PER_MIN = max(30, int(os.getenv("ML_WRITE_RATE_LIMIT_PER_MIN", "240")))

app = FastAPI(
    title="Clash Royale ML Service",
    version="1.0.0",
    docs_url="/docs" if ML_ENABLE_DOCS else None,
    redoc_url="/redoc" if ML_ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ML_ENABLE_DOCS else None,
)

CARDS = load_cards()
CARD_MAP = map_cards_by_id(CARDS)
MODEL = None
META = {"modelVersion": "untrained"}
_RATE_LOCK = threading.Lock()
_WRITE_HITS: Dict[str, Deque[float]] = defaultdict(deque)
_WRITE_WINDOW_SECONDS = 60.0
_WRITE_PATHS = {"/predict", "/feedback", "/learning/status"}


def _client_ip(request: Request) -> str:
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check_write_rate_limit(ip: str) -> bool:
    now = time.time()
    with _RATE_LOCK:
        bucket = _WRITE_HITS[ip]
        while bucket and (now - bucket[0]) > _WRITE_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= ML_WRITE_RATE_LIMIT_PER_MIN:
            return False
        bucket.append(now)
        return True


def _authorized_internal_request(request: Request) -> bool:
    if not ML_SERVICE_AUTH_TOKEN:
        return True
    sent = (request.headers.get("x-ml-auth") or "").strip()
    return sent == ML_SERVICE_AUTH_TOKEN


@app.middleware("http")
async def guard_internal_write_routes(request: Request, call_next):
    if request.url.path in _WRITE_PATHS:
        if not _authorized_internal_request(request):
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        if not _check_write_rate_limit(_client_ip(request)):
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})
    return await call_next(request)


class PredictRequest(BaseModel):
    cardIds: List[int]
    towerTroop: str = "tower_princess"
    wildSlotMode: Optional[str] = None
    opponentArchetype: Optional[str] = None
    scoreProxy: Optional[float] = None

class FeedbackRequest(BaseModel):
    cardIds: List[int]
    towerTroop: str = "tower_princess"
    wildSlotMode: Optional[str] = None
    won: bool
    crownsFor: Optional[int] = None
    crownsAgainst: Optional[int] = None
    opponentArchetype: Optional[str] = None
    gameMode: Optional[str] = None
    trophies: Optional[int] = None
    patchVersion: Optional[str] = None
    notes: Optional[str] = None


def _fallback_predict(feats: dict) -> float:
    # Safe fallback if model is missing.
    score = 50.0
    score += min(feats.get("win_con_count", 0), 2) * 6.0
    score += min(feats.get("air_counters", 0), 4) * 1.8
    score += min(feats.get("building_count", 0), 1) * 3.2
    score += -abs(feats.get("avg_elixir", 3.6) - 3.6) * 2.0
    if feats.get("tower_tower_princess", 0) > 0:
        score += 1.8 if feats.get("avg_elixir", 3.6) <= 3.3 and feats.get("win_con_count", 0) >= 1 else 0.2
    if feats.get("tower_royal_chef", 0) > 0:
        score += 1.0 if feats.get("tank_count", 0) >= 2 and feats.get("avg_elixir", 0) >= 3.7 else -1.8
    # Integrate Evo/Hero/Champion ability signal into fallback predictions.
    score += min(6.0, max(0.0, float(feats.get("evo_ability_value", 0.0)) * 0.8))
    score += min(7.0, max(0.0, float(feats.get("hero_champ_ability_value", 0.0)) * 0.8))
    score += min(2.0, max(0.0, float(feats.get("hero_champ_ability_cost_sum", 0.0)) * 0.35))
    score += max(-2.0, min(2.0, float(feats.get("matchup_counter_index", 0.0)) * 1.8))
    return float(max(35.0, min(80.0, score)))


def _model_feature_order() -> Optional[List[str]]:
    order = META.get("featureOrder")
    if isinstance(order, list) and len(order) > 0:
        return [str(x) for x in order]
    return None


def predict_win_rate(
    card_ids: List[int],
    tower_troop: str,
    wild_slot_mode: Optional[str] = None,
    opponent_archetype: Optional[str] = None,
):
    vec, feats, deck_cards = build_feature_vector_from_ids(
        card_ids,
        tower_troop,
        CARD_MAP,
        wild_slot_mode=wild_slot_mode,
        opponent_archetype=normalize_opponent_archetype(opponent_archetype),
        feature_order=_model_feature_order(),
    )
    if MODEL is None:
        pred = _fallback_predict(feats)
    else:
        pred = float(MODEL.predict(np.array([vec], dtype=np.float32))[0])
    # Apply matchup adjustment directly so archetype context influences output
    # even before the next full model retrain lands in production.
    pred += max(-2.2, min(2.2, float(feats.get("matchup_counter_index", 0.0)) * 1.8))
    calib = get_online_calibration()
    pred = float(max(35.0, min(80.0, pred * float(calib.get("scale", 1.0)) + float(calib.get("bias", 0.0)))))
    return pred, feats, deck_cards


def build_suggestions(
    card_ids: List[int],
    tower_troop: str,
    baseline: float,
    wild_slot_mode: Optional[str] = None,
    opponent_archetype: Optional[str] = None,
):
    deck_set = set(card_ids)
    candidates = [c for c in CARDS if int(c["id"]) not in deck_set][:90]
    _, base_feats, deck_cards = build_feature_vector_from_ids(
        card_ids,
        tower_troop,
        CARD_MAP,
        wild_slot_mode=wild_slot_mode,
        opponent_archetype=normalize_opponent_archetype(opponent_archetype),
        feature_order=_model_feature_order(),
    )
    base_avg = float(base_feats.get("avg_elixir", 3.6))
    base_building = int(base_feats.get("building_count", 0))
    base_air = int(base_feats.get("air_counters", 0))
    base_light_spell = int(base_feats.get("light_spell_count", 0))
    base_heavy_spell = int(base_feats.get("heavy_spell_count", 0))
    base_win_con = int(base_feats.get("win_con_count", 0))
    base_meta_sim = float(base_feats.get("meta_max_similarity", 0.0))

    def role_group(card: dict) -> str:
        role = str(card.get("role", "")).lower()
        name = " ".join(str(card.get("name", "")).lower().replace(".", "").split())
        is_spell_name = name in {
            "zap", "the log", "log", "snowball", "arrows", "barbarian barrel", "tornado",
            "fireball", "poison", "rocket", "lightning", "rage", "freeze", "clone", "mirror",
            "earthquake", "goblin barrel", "graveyard"
        }
        is_defense_name = any(
            k in name
            for k in [
                "cannon",
                "tesla",
                "tower",
                "tombstone",
                "x-bow",
                "mortar",
                "hut",
                "furnace",
                "collector",
                "goblin cage",
                "bomb tower",
                "inferno tower",
            ]
        )
        if role == "wincondition":
            return "wincon"
        if is_spell_name:
            return "spell"
        if role == "spell" and not is_spell_name:
            return "support"
        if role in {"defense", "building", "spawner"} or is_defense_name:
            return "defense"
        if (card.get("elixirCost") or 0) <= 2:
            return "cycle"
        return "support"

    deck_map = {int(c["id"]): c for c in deck_cards}
    suggestions = []
    for slot in range(8):
        outgoing_id = card_ids[slot]
        outgoing = deck_map.get(outgoing_id) or CARD_MAP.get(outgoing_id)
        outgoing_name = outgoing["name"] if outgoing else str(outgoing_id)
        outgoing_group = role_group(outgoing or {})
        outgoing_elixir = float((outgoing or {}).get("elixirCost") or 0)
        for cand in candidates:
            incoming_id = int(cand["id"])
            incoming_group = role_group(cand)
            incoming_elixir = float(cand.get("elixirCost") or 0)
            if outgoing_group != incoming_group:
                continue
            if abs(incoming_elixir - outgoing_elixir) > 2.0:
                continue
            next_ids = list(card_ids)
            next_ids[slot] = incoming_id
            if len(set(next_ids)) != 8:
                continue
            wr, next_feats, _ = predict_win_rate(
                next_ids,
                tower_troop,
                wild_slot_mode=wild_slot_mode,
                opponent_archetype=opponent_archetype,
            )
            if abs(float(next_feats.get("avg_elixir", base_avg)) - base_avg) > 0.55:
                continue
            next_building = int(next_feats.get("building_count", 0))
            next_air = int(next_feats.get("air_counters", 0))
            next_light_spell = int(next_feats.get("light_spell_count", 0))
            next_heavy_spell = int(next_feats.get("heavy_spell_count", 0))
            next_win_con = int(next_feats.get("win_con_count", 0))
            next_meta_sim = float(next_feats.get("meta_max_similarity", 0.0))
            if base_building >= 1 and next_building < base_building:
                continue
            if base_air >= 3 and next_air < max(2, base_air - 1):
                continue
            if base_light_spell >= 1 and next_light_spell == 0:
                continue
            if base_heavy_spell >= 1 and next_heavy_spell == 0:
                continue
            if base_win_con >= 1 and next_win_con == 0:
                continue
            if baseline >= 60 and base_meta_sim >= 0.70 and next_meta_sim + 0.08 < base_meta_sim:
                continue
            delta = round(wr - baseline, 1)
            min_delta = 2.2 if baseline >= 62 else (1.4 if baseline >= 56 else 1.0)
            if delta < min_delta:
                continue
            suggestions.append(
                {
                    "slot": slot + 1,
                    "outgoing": outgoing_name,
                    "incoming": cand["name"],
                    "predictedWinRate": round(wr, 1),
                    "deltaWinRate": delta,
                }
            )
    suggestions.sort(key=lambda x: x["deltaWinRate"], reverse=True)
    return suggestions[:3]


@app.on_event("startup")
def load_model():
    global MODEL, META
    init_db()
    if MODEL_PATH.exists():
        MODEL = joblib.load(MODEL_PATH)
    if META_PATH.exists():
        META = json.loads(META_PATH.read_text(encoding="utf-8"))


@app.get("/health")
def health():
    return {"ok": True, "modelLoaded": MODEL is not None, "modelVersion": META.get("modelVersion", "unknown")}


@app.post("/predict")
def predict(req: PredictRequest):
    unique = list(dict.fromkeys(req.cardIds))
    if len(unique) != 8:
        raise HTTPException(status_code=400, detail="Deck must contain 8 unique card IDs.")
    try:
        baseline, feats, _ = predict_win_rate(unique, req.towerTroop, req.wildSlotMode, req.opponentArchetype)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    suggestions = build_suggestions(unique, req.towerTroop, baseline, req.wildSlotMode, req.opponentArchetype)
    confidence = max(55, min(95, int(64 + min(12, abs(baseline - 50) * 0.8))))
    drivers = []
    if feats["win_con_count"] == 0:
        drivers.append("No clear win condition reduces conversion reliability.")
    if feats["building_count"] == 0:
        drivers.append("No building/spawner anchor increases defensive volatility.")
    if feats["air_counters"] <= 2:
        drivers.append("Low anti-air coverage can hurt key matchups.")
    opp_arch = normalize_opponent_archetype(req.opponentArchetype)
    if opp_arch and opp_arch != "custom_offmeta":
        opp_text = opp_arch.replace("_", " ")
        matchup_idx = float(feats.get("matchup_counter_index", 0.0))
        if matchup_idx >= 0.35:
            drivers.append(f"Matchup lean looks favorable versus {opp_text}.")
        elif matchup_idx <= -0.35:
            drivers.append(f"Matchup lean looks risky versus {opp_text}; defend first and counter-push.")
        else:
            drivers.append(f"Matchup appears close versus {opp_text}; outcome is execution-sensitive.")
    if len(drivers) == 0:
        drivers.append("Deck profile has balanced structure across core dimensions.")

    if ML_ENABLE_SCORE_PROXY and req.scoreProxy is not None:
        update_online_calibration(baseline, req.scoreProxy)
    calib = get_online_calibration()

    response = {
        "modelVersion": META.get("modelVersion", "untrained"),
        "onlineLearning": {
            "enabled": True,
            "calibrationBias": round(float(calib.get("bias", 0.0)), 4),
            "calibrationScale": round(float(calib.get("scale", 1.0)), 4),
            "seenEvents": int(calib.get("seenEvents", 0)),
        },
        "mlForecast": {
            "predictedWinRate": round(baseline, 1),
            "confidence": confidence,
            "topDrivers": drivers[:3],
        },
        "metaSignals": {
            "maxSimilarity": round(float(feats.get("meta_max_similarity", 0.0)), 3),
            "top3Similarity": round(float(feats.get("meta_top3_similarity", 0.0)), 3),
            "weightedMetaWinRate": round(float(feats.get("meta_weighted_win_rate", 0.0)), 2),
            "weightedMetaUsage": round(float(feats.get("meta_weighted_usage", 0.0)), 2),
            "weightedMetaRating": round(float(feats.get("meta_weighted_rating", 0.0)), 2),
        },
        "mlSuggestions": suggestions,
    }
    log_analysis_event(
        unique,
        normalize_tower(req.towerTroop),
        req.wildSlotMode,
        response["mlForecast"]["predictedWinRate"],
        response["mlForecast"]["confidence"],
        req.scoreProxy,
        response.get("modelVersion"),
        "python-ml-service",
        response.get("metaSignals", {}).get("maxSimilarity"),
        response.get("metaSignals", {}).get("weightedMetaWinRate"),
    )
    return response


@app.post("/feedback")
def feedback(req: FeedbackRequest):
    unique = list(dict.fromkeys(req.cardIds))
    if len(unique) != 8:
        raise HTTPException(status_code=400, detail="Deck must contain 8 unique card IDs.")
    add_battle_feedback(
        unique,
        normalize_tower(req.towerTroop),
        req.wildSlotMode,
        bool(req.won),
        req.crownsFor,
        req.crownsAgainst,
        req.opponentArchetype,
        req.gameMode,
        req.trophies,
        req.patchVersion,
        req.notes,
    )
    return {"ok": True}


@app.get("/learning/status")
def learning_status():
    return {"ok": True, **get_learning_stats()}
