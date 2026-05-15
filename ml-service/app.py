from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from db import (
    add_battle_feedback,
    get_learning_stats,
    get_online_calibration,
    init_db,
    log_analysis_event,
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

app = FastAPI(title="Clash Royale ML Service", version="1.0.0")

CARDS = load_cards()
CARD_MAP = map_cards_by_id(CARDS)
MODEL = None
META = {"modelVersion": "untrained"}


class PredictRequest(BaseModel):
    cardIds: List[int]
    towerTroop: str = "tower_princess"
    scoreProxy: Optional[float] = None

class FeedbackRequest(BaseModel):
    cardIds: List[int]
    towerTroop: str = "tower_princess"
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
    return float(max(35.0, min(80.0, score)))


def predict_win_rate(card_ids: List[int], tower_troop: str):
    vec, feats, deck_cards = build_feature_vector_from_ids(card_ids, tower_troop, CARD_MAP)
    if MODEL is None:
        pred = _fallback_predict(feats)
    else:
        pred = float(MODEL.predict(np.array([vec], dtype=np.float32))[0])
    calib = get_online_calibration()
    pred = float(max(35.0, min(80.0, pred * float(calib.get("scale", 1.0)) + float(calib.get("bias", 0.0)))))
    return pred, feats, deck_cards


def build_suggestions(card_ids: List[int], tower_troop: str, baseline: float):
    deck_set = set(card_ids)
    candidates = [c for c in CARDS if int(c["id"]) not in deck_set][:90]
    _, base_feats, deck_cards = build_feature_vector_from_ids(card_ids, tower_troop, CARD_MAP)
    base_avg = float(base_feats.get("avg_elixir", 3.6))

    def role_group(card: dict) -> str:
        role = str(card.get("role", "")).lower()
        if role == "wincondition":
            return "wincon"
        if role == "spell":
            return "spell"
        if role in {"defense", "building", "spawner"}:
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
            wr, next_feats, _ = predict_win_rate(next_ids, tower_troop)
            if abs(float(next_feats.get("avg_elixir", base_avg)) - base_avg) > 0.55:
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
        baseline, feats, _ = predict_win_rate(unique, req.towerTroop)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    suggestions = build_suggestions(unique, req.towerTroop, baseline)
    confidence = max(55, min(95, int(64 + min(12, abs(baseline - 50) * 0.8))))
    drivers = []
    if feats["win_con_count"] == 0:
        drivers.append("No clear win condition reduces conversion reliability.")
    if feats["building_count"] == 0:
        drivers.append("No building/spawner anchor increases defensive volatility.")
    if feats["air_counters"] <= 2:
        drivers.append("Low anti-air coverage can hurt key matchups.")
    if len(drivers) == 0:
        drivers.append("Deck profile has balanced structure across core dimensions.")

    if req.scoreProxy is not None:
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
