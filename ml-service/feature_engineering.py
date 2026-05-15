from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from meta_priors import compute_meta_features, load_meta_decks

ROOT = Path(__file__).resolve().parents[1]
CARDS_PATH = ROOT / "data" / "cards.json"
META_DECKS = load_meta_decks()

DEFENSIVE_BUILDING_IDS = {
    27000000,  # Cannon
    27000002,  # Mortar
    27000003,  # Inferno Tower
    27000004,  # Bomb Tower
    27000006,  # Tesla
    27000008,  # X-Bow
    27000009,  # Tombstone
    27000010,  # Barbarian Hut
    27000011,  # Furnace
    27000012,  # Goblin Cage
    27000013,  # Goblin Hut
    27000014,  # Elixir Collector
}


def load_cards() -> List[dict]:
    with open(CARDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_tower(tower_troop: str | None) -> str:
    key = (tower_troop or "tower_princess").lower().replace("-", "_").replace(" ", "_")
    if key in {"tower_princess", "royal_chef", "cannoneer", "dagger_duchess"}:
        return key
    return "tower_princess"


def card_metadata(card: dict) -> dict:
    name = ((card.get("name") or "").lower())
    role = (card.get("role") or "support").lower()
    attack_type = (card.get("attackType") or "ground").lower()
    card_id = int(card.get("id") or 0)
    is_building = (
        role in {"defense", "building", "spawner"}
        or card_id in DEFENSIVE_BUILDING_IDS
        or any(
            k in name
            for k in [
                "cannon",
                "tesla",
                "inferno tower",
                "bomb tower",
                "tombstone",
                "x-bow",
                "mortar",
                "hut",
                "furnace",
                "collector",
                "elixir collector",
                "goblin cage",
                "spawner",
                "building",
            ]
        )
    )
    return {
        "is_win_condition": role == "wincondition" or any(
            k in name for k in ["hog", "giant", "golem", "balloon", "barrel", "x-bow", "mortar", "miner", "ram rider", "battle ram", "goblin drill"]
        ),
        "is_building": is_building,
        "is_light_spell": any(k in name for k in ["zap", "log", "snowball", "arrows", "barbarian barrel", "tornado"]),
        "is_heavy_spell": any(k in name for k in ["fireball", "poison", "rocket", "lightning"]),
        "is_cycle": (card.get("elixirCost") or 0) <= 2 or role == "cycle",
        "can_hit_air": attack_type in {"both", "air"} or any(
            k in name
            for k in [
                "musketeer",
                "archers",
                "baby dragon",
                "minions",
                "bats",
                "electro wizard",
                "phoenix",
                "dart goblin",
                "spear goblins",
                "hunter",
                "wizard",
                "witch",
                "executioner",
                "magic archer",
                "electro dragon",
                "mega minion",
                "inferno dragon",
                "minion horde",
                "firecracker",
                "zappies",
                "little prince",
            ]
        ),
        "is_tank": (card.get("elixirCost") or 0) >= 5 or any(
            k in name for k in ["giant", "golem", "pekka", "lava hound", "electro giant", "royal giant"]
        ),
        "is_splash": any(
            k in name
            for k in ["wizard", "baby dragon", "valkyrie", "bowler", "bomb", "executioner", "firecracker", "witch", "poison", "fireball", "arrows", "zap", "snowball", "rocket", "lightning"]
        ),
        "is_reset": any(k in name for k in ["zap", "electro wizard", "electro spirit", "zappies"]),
    }


def build_feature_dict(cards: List[dict], tower_troop: str, deck_ids: List[int] | None = None) -> Dict[str, float]:
    md = [card_metadata(c) for c in cards]
    avg_elixir = sum((c.get("elixirCost") or 0) for c in cards) / max(len(cards), 1)
    ids = deck_ids if deck_ids is not None else [int(c.get("id") or 0) for c in cards]
    meta = compute_meta_features(ids, META_DECKS)
    feats = {
        "avg_elixir": avg_elixir,
        "win_con_count": sum(1 for m in md if m["is_win_condition"]),
        "building_count": sum(1 for m in md if m["is_building"]),
        "light_spell_count": sum(1 for m in md if m["is_light_spell"]),
        "heavy_spell_count": sum(1 for m in md if m["is_heavy_spell"]),
        "spell_count": sum(1 for c in cards if (c.get("role") or "").lower() == "spell"),
        "air_counters": sum(1 for m in md if m["can_hit_air"]),
        "splash_count": sum(1 for m in md if m["is_splash"]),
        "cycle_cards": sum(1 for m in md if m["is_cycle"]),
        "reset_count": sum(1 for m in md if m["is_reset"]),
        "tank_count": sum(1 for m in md if m["is_tank"]),
        "meta_max_similarity": float(meta["meta_max_similarity"]),
        "meta_top3_similarity": float(meta["meta_top3_similarity"]),
        "meta_weighted_win_rate": float(meta["meta_weighted_win_rate"]),
        "meta_weighted_usage": float(meta["meta_weighted_usage"]),
        "meta_weighted_rating": float(meta["meta_weighted_rating"]),
    }
    tower = normalize_tower(tower_troop)
    feats["tower_tower_princess"] = 1.0 if tower == "tower_princess" else 0.0
    feats["tower_royal_chef"] = 1.0 if tower == "royal_chef" else 0.0
    feats["tower_cannoneer"] = 1.0 if tower == "cannoneer" else 0.0
    feats["tower_dagger_duchess"] = 1.0 if tower == "dagger_duchess" else 0.0
    return feats


def vectorize(feats: Dict[str, float], feature_order: List[str]) -> List[float]:
    return [float(feats.get(k, 0.0)) for k in feature_order]


FEATURE_ORDER = [
    "avg_elixir",
    "win_con_count",
    "building_count",
    "light_spell_count",
    "heavy_spell_count",
    "spell_count",
    "air_counters",
    "splash_count",
    "cycle_cards",
    "reset_count",
    "tank_count",
    "tower_tower_princess",
    "tower_royal_chef",
    "tower_cannoneer",
    "tower_dagger_duchess",
    "meta_max_similarity",
    "meta_top3_similarity",
    "meta_weighted_win_rate",
    "meta_weighted_usage",
    "meta_weighted_rating",
]


def map_cards_by_id(cards: List[dict]) -> Dict[int, dict]:
    return {int(c["id"]): c for c in cards}


def deck_from_ids(ids: List[int], card_map: Dict[int, dict]) -> List[dict]:
    return [card_map[i] for i in ids if i in card_map]


def build_feature_vector_from_ids(ids: List[int], tower_troop: str, card_map: Dict[int, dict]) -> Tuple[List[float], Dict[str, float], List[dict]]:
    cards = deck_from_ids(ids, card_map)
    if len(cards) != 8:
        raise ValueError("Deck must contain 8 valid cards.")
    feats = build_feature_dict(cards, tower_troop, ids)
    return vectorize(feats, FEATURE_ORDER), feats, cards
