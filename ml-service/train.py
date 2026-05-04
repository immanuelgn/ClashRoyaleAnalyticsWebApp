from __future__ import annotations

import itertools
import random
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor

from db import init_db, load_feedback_rows
from feature_engineering import FEATURE_ORDER, build_feature_dict, load_cards, normalize_tower, vectorize

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model.joblib"
META_PATH = ROOT / "model_meta.json"


def pseudo_label(feats: dict) -> float:
    score = 52.0
    score += min(feats["win_con_count"], 2) * 7.0
    score += min(feats["building_count"], 1) * 4.0
    score += min(feats["air_counters"], 4) * 2.2
    score += min(feats["splash_count"], 3) * 1.6
    score += min(feats["spell_count"], 3) * 1.7
    score += 2.0 if feats["light_spell_count"] > 0 else -2.0
    score += 2.2 if feats["heavy_spell_count"] > 0 else -2.2
    score += 1.2 if feats["reset_count"] > 0 else -1.0
    score += 0.8 if 2.8 <= feats["avg_elixir"] <= 4.2 else -1.5
    score += -abs(feats["avg_elixir"] - 3.6) * 2.0
    score += feats["tower_tower_princess"] * (1.6 if feats["avg_elixir"] <= 3.3 and feats["win_con_count"] >= 1 else 0.2)
    score += feats["tower_dagger_duchess"] * (1.5 if feats["cycle_cards"] >= 2 else -0.8)
    score += feats["tower_cannoneer"] * (1.3 if feats["air_counters"] >= 3 else -1.0)
    score += feats["tower_royal_chef"] * (1.2 if feats["tank_count"] >= 2 and feats["avg_elixir"] >= 3.7 else -1.8)
    score += random.uniform(-1.5, 1.5)
    return float(max(35.0, min(80.0, score)))


def build_training_set(sample_count: int = 5000):
    cards = load_cards()
    card_ids = [int(c["id"]) for c in cards]
    card_by_id = {int(c["id"]): c for c in cards}
    towers = ["tower_princess", "royal_chef", "cannoneer", "dagger_duchess"]

    X = []
    y = []
    for _ in range(sample_count):
        deck = random.sample(card_ids, 8)
        tower = random.choice(towers)
        deck_cards = [card_by_id[i] for i in deck]
        feats = build_feature_dict(deck_cards, tower)
        X.append(vectorize(feats, FEATURE_ORDER))
        y.append(pseudo_label(feats))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def build_feedback_training_set():
    cards = load_cards()
    card_by_id = {int(c["id"]): c for c in cards}
    rows = load_feedback_rows()
    X = []
    y = []
    for r in rows:
        ids = [int(i) for i in r["card_ids"]]
        deck = [card_by_id[i] for i in ids if i in card_by_id]
        if len(deck) != 8:
            continue
        feats = build_feature_dict(deck, normalize_tower(r["tower_troop"]))
        base = 58.0 if int(r["won"]) == 1 else 44.0
        cf = r.get("crowns_for")
        ca = r.get("crowns_against")
        if cf is not None and ca is not None:
            base += max(-4.0, min(4.0, float(cf - ca) * 1.3))
        target = float(max(35.0, min(80.0, base)))
        X.append(vectorize(feats, FEATURE_ORDER))
        y.append(target)
    if not X:
        return np.array([], dtype=np.float32), np.array([], dtype=np.float32)
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def main():
    random.seed(42)
    np.random.seed(42)
    init_db()
    X_syn, y_syn = build_training_set()
    X_fb, y_fb = build_feedback_training_set()
    if len(y_fb) > 0:
        X = np.concatenate([X_syn, X_fb], axis=0)
        y = np.concatenate([y_syn, y_fb], axis=0)
    else:
        X, y = X_syn, y_syn

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=14,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    joblib.dump(model, MODEL_PATH)
    meta = {
        "modelVersion": "rf-v1",
        "featureOrder": FEATURE_ORDER,
        "trainSamples": int(len(y)),
        "feedbackSamples": int(len(y_fb)),
        "target": "predicted_win_rate_percent",
    }
    META_PATH.write_text(__import__("json").dumps(meta, indent=2), encoding="utf-8")
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
