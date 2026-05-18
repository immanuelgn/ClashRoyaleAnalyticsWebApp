from __future__ import annotations

import itertools
import random
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor

from db import init_db, load_feedback_rows
from feature_engineering import FEATURE_ORDER, build_feature_dict, load_cards, normalize_tower, vectorize
from meta_priors import load_meta_decks

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model.joblib"
META_PATH = ROOT / "model_meta.json"

def infer_wild_mode(card_by_id: dict, deck_ids: list[int]) -> str:
    if len(deck_ids) < 2:
        return ""
    slot2 = card_by_id.get(int(deck_ids[1]))
    if not slot2:
        return ""
    name = str(slot2.get("name") or "").strip().lower().replace(".", "").replace("'", "").replace("&", "and").replace(" ", "-")
    rarity = str(slot2.get("rarity") or "").lower()
    hero_slugs = {
        "barbarian-barrel", "giant", "goblins", "ice-golem", "knight",
        "magic-archer", "mega-minion", "mini-pekka", "musketeer", "wizard", "balloon",
        "dark-prince", "bowler",
    }
    champion_slugs = {
        "archer-queen", "boss-bandit", "goblinstein", "golden-knight",
        "little-prince", "mighty-miner", "monk", "skeleton-king",
    }
    evo_slugs = {
        "archers", "baby-dragon", "barbarians", "bats", "battle-ram",
        "bomber", "cannon", "dart-goblin", "electro-dragon", "executioner",
        "firecracker", "furnace", "giant-snowball", "goblin-barrel", "goblin-cage",
        "goblin-drill", "goblin-giant", "hunter", "ice-spirit",
        "inferno-dragon", "knight", "lumberjack", "mega-knight",
        "minion-horde", "musketeer", "mortar", "pekka", "royal-ghost", "royal-giant",
        "royal-hogs", "royal-recruits", "skeleton-army", "skeleton-barrel", "skeletons",
        "tesla", "valkyrie", "wall-breakers", "witch", "wizard", "zap",
    }
    has_hero = name in hero_slugs or rarity == "champion" or name in champion_slugs
    has_evo = name in evo_slugs and name != "the-log"
    if has_evo and has_hero:
        return random.choice(["evo", "hero"])
    if has_hero:
        return "hero"
    if has_evo:
        return "evo"
    return ""


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
    score += min(7.0, feats.get("meta_max_similarity", 0) * 12.0)
    score += min(4.0, feats.get("meta_top3_similarity", 0) * 8.0)
    score += max(-3.0, min(4.0, (feats.get("meta_weighted_win_rate", 0) - 50.0) * 0.45))
    score += max(-2.0, min(3.5, feats.get("meta_weighted_usage", 0) * 0.55))
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
        wild_mode = infer_wild_mode(card_by_id, deck)
        deck_cards = [card_by_id[i] for i in deck]
        feats = build_feature_dict(deck_cards, tower, deck, wild_mode)
        X.append(vectorize(feats, FEATURE_ORDER))
        y.append(pseudo_label(feats))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def build_meta_anchor_training_set(variations_per_deck: int = 22):
    cards = load_cards()
    card_by_id = {int(c["id"]): c for c in cards}
    card_ids = list(card_by_id.keys())
    meta_rows = load_meta_decks()
    towers = ["tower_princess", "royal_chef", "cannoneer", "dagger_duchess"]

    X = []
    y = []
    for row in meta_rows:
        ids = [int(i) for i in (row.get("cards") or [])]
        if len(set(ids)) != 8 or any(i not in card_by_id for i in ids):
            continue
        base_wr = float(row.get("winRatePct") or 52.0)
        base_target = float(max(40.0, min(80.0, 35.0 + ((base_wr - 45.0) * 2.2))))
        base_tower = random.choice(towers)
        base_wild_mode = infer_wild_mode(card_by_id, ids)
        base_cards = [card_by_id[i] for i in ids]
        base_feats = build_feature_dict(base_cards, base_tower, ids, base_wild_mode)
        X.append(vectorize(base_feats, FEATURE_ORDER))
        y.append(base_target)

        for _ in range(variations_per_deck):
            deck = list(ids)
            slot = random.randint(0, 7)
            outgoing = card_by_id[deck[slot]]
            outgoing_cost = float(outgoing.get("elixirCost") or 0)
            candidates = [cid for cid in card_ids if cid not in deck and abs(float(card_by_id[cid].get("elixirCost") or 0) - outgoing_cost) <= 2.0]
            if not candidates:
                continue
            deck[slot] = random.choice(candidates)
            tower = random.choice(towers)
            wild_mode = infer_wild_mode(card_by_id, deck)
            next_cards = [card_by_id[i] for i in deck]
            feats = build_feature_dict(next_cards, tower, deck, wild_mode)
            X.append(vectorize(feats, FEATURE_ORDER))
            similarity = float(feats.get("meta_max_similarity") or 0.0)
            penalty = max(0.8, 4.4 - (similarity * 4.0))
            y.append(float(max(35.0, min(80.0, base_target - penalty + random.uniform(-0.9, 0.9)))))

    if not X:
        return np.array([], dtype=np.float32), np.array([], dtype=np.float32)
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
        wild_mode = infer_wild_mode(card_by_id, ids)
        feats = build_feature_dict(deck, normalize_tower(r["tower_troop"]), ids, wild_mode)
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
    X_meta, y_meta = build_meta_anchor_training_set()
    X_fb, y_fb = build_feedback_training_set()
    chunks_x = [X_syn]
    chunks_y = [y_syn]
    if len(y_meta) > 0:
        chunks_x.append(X_meta)
        chunks_y.append(y_meta)
    if len(y_fb) > 0:
        chunks_x.append(X_fb)
        chunks_y.append(y_fb)
    X = np.concatenate(chunks_x, axis=0)
    y = np.concatenate(chunks_y, axis=0)

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
        "modelVersion": "rf-v3-meta-prior-ability-mode",
        "featureOrder": FEATURE_ORDER,
        "trainSamples": int(len(y)),
        "metaAnchorSamples": int(len(y_meta)),
        "feedbackSamples": int(len(y_fb)),
        "target": "predicted_win_rate_percent",
    }
    META_PATH.write_text(__import__("json").dumps(meta, indent=2), encoding="utf-8")
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
