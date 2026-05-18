from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

from meta_priors import compute_meta_features, load_meta_decks

ROOT = Path(__file__).resolve().parents[1]
CARDS_PATH = ROOT / "data" / "cards.json"
META_DECKS = load_meta_decks()
CARD_DATA_OVERRIDES = {
    27000001: {"elixirCost": 5, "role": "Spawner"},  # Goblin Hut
    28000006: {"elixirCost": 1, "role": "Spell"},    # Mirror
    28000017: {"role": "Spell"},                     # Giant Snowball
}

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

LIGHT_SPELL_NAMES = {"zap", "the log", "log", "snowball", "giant snowball", "arrows", "barbarian barrel", "tornado"}
HEAVY_SPELL_NAMES = {"fireball", "poison", "rocket", "lightning"}
OTHER_SPELL_NAMES = {"rage", "freeze", "clone", "mirror", "earthquake", "royal delivery", "void", "goblin curse", "vines", "spirit empress", "graveyard"}
SPELL_WIN_CON_NAMES = {"goblin barrel", "graveyard"}
WIN_CONDITION_NAMES = {
    "hog rider", "giant", "golem", "balloon", "goblin barrel", "x-bow", "mortar",
    "miner", "ram rider", "battle ram", "goblin drill", "lava hound", "electro giant",
    "royal giant", "royal hogs", "graveyard", "wall breakers",
}

EVO_CARD_SLUGS = {
    "archers", "baby-dragon", "barbarians", "bats", "battle-ram",
    "bomber", "cannon", "dart-goblin", "electro-dragon", "executioner",
    "firecracker", "furnace", "giant-snowball", "goblin-barrel", "goblin-cage",
    "goblin-drill", "goblin-giant", "hunter", "ice-spirit",
    "inferno-dragon", "knight", "lumberjack", "mega-knight",
    "minion-horde", "musketeer",
    "mortar", "pekka", "royal-ghost", "royal-giant",
    "royal-hogs", "royal-recruits", "skeleton-army", "skeleton-barrel", "skeletons",
    "tesla", "valkyrie", "wall-breakers", "witch", "wizard", "zap",
}
EVO_FORCE_OFF_SLUGS = {"the-log"}
HERO_CARD_SLUGS = {
    "barbarian-barrel", "giant", "goblins", "ice-golem", "knight",
    "magic-archer", "mega-minion", "mini-pekka", "musketeer", "wizard", "balloon",
    "dark-prince", "bowler",
}
CHAMPION_CARD_SLUGS = {
    "archer-queen", "boss-bandit", "goblinstein", "golden-knight",
    "little-prince", "mighty-miner", "monk", "skeleton-king",
}
EVO_ABILITY_IMPACT = {
    "barbarians": {"cycles": 1, "impact": ["tempo", "dps"]},
    "electro-dragon": {"cycles": 1, "impact": ["chain-control", "anti-swarm"]},
    "executioner": {"cycles": 1, "impact": ["close-control", "knockback"]},
    "goblin-cage": {"cycles": 1, "impact": ["pull-control", "defense"]},
    "goblin-giant": {"cycles": 1, "impact": ["counterpush", "pressure"]},
    "mega-knight": {"cycles": 1, "impact": ["knockback", "lane-pressure"]},
    "minion-horde": {"cycles": 1, "impact": ["survivability", "burst"]},
    "pekka": {"cycles": 1, "impact": ["sustain", "duel-power"]},
    "royal-giant": {"cycles": 1, "impact": ["siege-pressure", "knockback"]},
    "royal-recruits": {"cycles": 1, "impact": ["bridge-pressure", "shield-convert"]},
    "witch": {"cycles": 1, "impact": ["sustain", "swarm-value"]},
    "wizard": {"cycles": 1, "impact": ["shield-value", "splash-control"]},
    "archers": {"cycles": 2, "impact": ["range", "pierce"]},
    "baby-dragon": {"cycles": 2, "impact": ["aura-control", "tempo"]},
    "bats": {"cycles": 2, "impact": ["self-heal", "dps"]},
    "battle-ram": {"cycles": 2, "impact": ["chain-pressure", "knockback"]},
    "bomber": {"cycles": 2, "impact": ["bounce-splash", "swarm-clear"]},
    "dart-goblin": {"cycles": 2, "impact": ["poison-dot", "chip"]},
    "firecracker": {"cycles": 2, "impact": ["dot", "slow-control"]},
    "hunter": {"cycles": 2, "impact": ["grounding", "single-target-lock"]},
    "ice-spirit": {"cycles": 2, "impact": ["freeze-control", "cycle"]},
    "knight": {"cycles": 2, "impact": ["move-mitigation", "tankiness"]},
    "lumberjack": {"cycles": 2, "impact": ["rage-uptime", "death-value"]},
    "musketeer": {"cycles": 2, "impact": ["sniper-range", "pickoff"]},
    "royal-ghost": {"cycles": 2, "impact": ["invis-pressure", "spawn-value"]},
    "royal-hogs": {"cycles": 2, "impact": ["air-path", "landing-burst"]},
    "skeleton-army": {"cycles": 2, "impact": ["protection", "swarm-retention"]},
    "skeleton-barrel": {"cycles": 2, "impact": ["double-barrel", "split-pressure"]},
    "skeletons": {"cycles": 2, "impact": ["clone-growth", "cycle"]},
    "valkyrie": {"cycles": 2, "impact": ["pull-control", "splash"]},
    "wall-breakers": {"cycles": 2, "impact": ["repeat-pressure", "multi-hit"]},
    "cannon": {"cycles": 2, "impact": ["spawn-splash", "defense"]},
    "furnace": {"cycles": 2, "impact": ["spawn-rate", "lane-chip"]},
    "giant-snowball": {"cycles": 2, "impact": ["roll-control", "pull"]},
    "goblin-barrel": {"cycles": 2, "impact": ["mindgame", "pressure"]},
    "goblin-drill": {"cycles": 2, "impact": ["reburrow-cycle", "pressure"]},
    "mortar": {"cycles": 2, "impact": ["siege-plus-spawn", "pressure"]},
    "tesla": {"cycles": 2, "impact": ["stun-pulse", "defense"]},
    "zap": {"cycles": 2, "impact": ["double-reset", "stun-control"]},
}
HERO_ABILITY_IMPACT = {
    "mini-pekka": {"cost": 1, "impact": ["stat-spike", "duel-power"]},
    "wizard": {"cost": 1, "impact": ["evasion", "aoe-control"]},
    "barbarian-barrel": {"cost": 1, "impact": ["lane-pressure", "self-sustain"]},
    "goblins": {"cost": 1, "impact": ["reinforcement", "swarm-pressure"]},
    "magic-archer": {"cost": 2, "impact": ["reposition", "burst-pierce"]},
    "knight": {"cost": 2, "impact": ["taunt-control", "survivability"]},
    "giant": {"cost": 2, "impact": ["displacement", "impact-burst"]},
    "ice-golem": {"cost": 2, "impact": ["slow-control", "freeze-control"]},
    "mega-minion": {"cost": 2, "impact": ["teleport-pickoff", "aoe-burst"]},
    "balloon": {"cost": 2, "impact": ["assist-pressure", "defender-punish"]},
    "bowler": {"cost": 2, "impact": ["range-spike", "lane-control"]},
    "musketeer": {"cost": 3, "impact": ["turret-support", "dual-target-defense"]},
    "dark-prince": {"cost": 3, "impact": ["split-entity", "aoe-smash"]},
}
CHAMPION_ABILITY_IMPACT = {
    "golden-knight": {"cost": 1, "impact": ["chain-dash", "invuln-entry"]},
    "mighty-miner": {"cost": 1, "impact": ["lane-shift", "bomb-control"]},
    "archer-queen": {"cost": 1, "impact": ["cloak", "dps-spike"]},
    "monk": {"cost": 1, "impact": ["projectile-reflect", "damage-mitigation"]},
    "boss-bandit": {"cost": 1, "impact": ["invis-reset", "dash-reengage"]},
    "skeleton-king": {"cost": 2, "impact": ["soul-summon", "swarm-pressure"]},
    "little-prince": {"cost": 2, "impact": ["guardian-call", "entry-knockback"]},
    "goblinstein": {"cost": 2, "impact": ["beam-zone", "sustained-shock"]},
}

def normalize_card_name(text: str) -> str:
    return " ".join(str(text or "").lower().replace(".", "").split())

def slugify(name: str) -> str:
    return (
        str(name or "")
        .strip()
        .lower()
        .replace(".", "")
        .replace("'", "")
        .replace("&", "and")
        .replace(" ", "-")
    )


def load_cards() -> List[dict]:
    with open(CARDS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    out = []
    for c in raw:
        cid = int(c.get("id") or 0)
        fix = CARD_DATA_OVERRIDES.get(cid)
        out.append({**c, **fix} if fix else c)
    return out


def normalize_tower(tower_troop: str | None) -> str:
    key = (tower_troop or "tower_princess").lower().replace("-", "_").replace(" ", "_")
    if key in {"tower_princess", "royal_chef", "cannoneer", "dagger_duchess"}:
        return key
    return "tower_princess"


def card_metadata(card: dict) -> dict:
    name = ((card.get("name") or "").lower())
    exact_name = normalize_card_name(card.get("name") or "")
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
    is_spell = exact_name in LIGHT_SPELL_NAMES or exact_name in HEAVY_SPELL_NAMES or exact_name in OTHER_SPELL_NAMES or role == "spell"
    win_con_by_name = exact_name in WIN_CONDITION_NAMES
    return {
        "is_win_condition": (exact_name in SPELL_WIN_CON_NAMES) if is_spell else (role == "wincondition" or win_con_by_name),
        "is_building": is_building,
        "is_light_spell": exact_name in LIGHT_SPELL_NAMES,
        "is_heavy_spell": exact_name in HEAVY_SPELL_NAMES,
        "is_other_spell": exact_name in OTHER_SPELL_NAMES,
        "is_spell": is_spell,
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

def is_evolution_card(card: dict) -> bool:
    slug = slugify(card.get("name") or "")
    return slug in EVO_CARD_SLUGS and slug not in EVO_FORCE_OFF_SLUGS

def is_hero_card(card: dict) -> bool:
    return slugify(card.get("name") or "") in HERO_CARD_SLUGS

def is_champion_card(card: dict) -> bool:
    slug = slugify(card.get("name") or "")
    rarity = str(card.get("rarity") or "").lower()
    return rarity == "champion" or slug in CHAMPION_CARD_SLUGS

def get_evo_ability_profile(card: dict) -> Dict | None:
    return EVO_ABILITY_IMPACT.get(slugify(card.get("name") or ""))

def get_hero_ability_profile(card: dict) -> Dict | None:
    slug = slugify(card.get("name") or "")
    return HERO_ABILITY_IMPACT.get(slug) or CHAMPION_ABILITY_IMPACT.get(slug)

def normalize_wild_slot_mode(mode: str | None) -> str:
    m = str(mode or "").strip().lower()
    if m in {"evo", "hero"}:
        return m
    return ""

def compute_evo_ability_value(cards: List[dict], wild_slot_mode: str) -> Tuple[float, int]:
    mode = normalize_wild_slot_mode(wild_slot_mode)
    total = 0.0
    active = 0
    slot_cards = [
        (cards[0] if len(cards) > 0 else None, "evo"),
        (cards[1] if len(cards) > 1 else None, "wild"),
    ]
    for card, slot in slot_cards:
        if not card:
            continue
        profile = get_evo_ability_profile(card)
        if not profile:
            continue
        if slot == "wild" and mode == "hero":
            continue
        base = 3 if int(profile.get("cycles") or 2) == 1 else 2
        impacts = profile.get("impact") or []
        control_bonus = 1 if any(("control" in k) or ("reset" in k) or ("pull" in k) or ("knockback" in k) for k in impacts) else 0
        total += float(base + control_bonus)
        active += 1
    return total, active

def compute_hero_champ_ability(cards: List[dict], wild_slot_mode: str) -> Tuple[float, float, int]:
    mode = normalize_wild_slot_mode(wild_slot_mode)
    total = 0.0
    cost_sum = 0.0
    active = 0
    slot_cards = [
        (cards[1] if len(cards) > 1 else None, "wild"),
        (cards[2] if len(cards) > 2 else None, "hero"),
    ]
    for card, slot in slot_cards:
        if not card:
            continue
        if slot == "wild" and mode != "hero":
            continue
        if not (is_hero_card(card) or is_champion_card(card)):
            continue
        profile = get_hero_ability_profile(card)
        if not profile:
            if is_champion_card(card):
                total += 2.0
                active += 1
            continue
        cost = float(profile.get("cost") or 2.0)
        impacts = profile.get("impact") or []
        base = 3 if cost <= 1 else (4 if cost == 2 else 5)
        control_bonus = 1 if any(("control" in k) or ("taunt" in k) or ("freeze" in k) or ("displacement" in k) or ("reposition" in k) for k in impacts) else 0
        total += float(base + control_bonus)
        cost_sum += cost
        active += 1
    return total, cost_sum, active


def build_feature_dict(
    cards: List[dict],
    tower_troop: str,
    deck_ids: List[int] | None = None,
    wild_slot_mode: str | None = None,
) -> Dict[str, float]:
    md = [card_metadata(c) for c in cards]
    avg_elixir = sum((c.get("elixirCost") or 0) for c in cards) / max(len(cards), 1)
    ids = deck_ids if deck_ids is not None else [int(c.get("id") or 0) for c in cards]
    meta = compute_meta_features(ids, META_DECKS)
    evo_value, evo_active_count = compute_evo_ability_value(cards, wild_slot_mode or "")
    hero_value, hero_cost_sum, hero_active_count = compute_hero_champ_ability(cards, wild_slot_mode or "")
    wild_mode = normalize_wild_slot_mode(wild_slot_mode)
    feats = {
        "avg_elixir": avg_elixir,
        "win_con_count": sum(1 for m in md if m["is_win_condition"]),
        "building_count": sum(1 for m in md if m["is_building"]),
        "light_spell_count": sum(1 for m in md if m["is_light_spell"]),
        "heavy_spell_count": sum(1 for m in md if m["is_heavy_spell"]),
        "spell_count": sum(1 for m in md if m["is_spell"]),
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
        "evo_ability_value": float(evo_value),
        "evo_ability_active_count": float(evo_active_count),
        "hero_champ_ability_value": float(hero_value),
        "hero_champ_ability_cost_sum": float(hero_cost_sum),
        "hero_champ_ability_active_count": float(hero_active_count),
        "wild_mode_is_evo": 1.0 if wild_mode == "evo" else 0.0,
        "wild_mode_is_hero": 1.0 if wild_mode == "hero" else 0.0,
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
    "evo_ability_value",
    "evo_ability_active_count",
    "hero_champ_ability_value",
    "hero_champ_ability_cost_sum",
    "hero_champ_ability_active_count",
    "wild_mode_is_evo",
    "wild_mode_is_hero",
]


def map_cards_by_id(cards: List[dict]) -> Dict[int, dict]:
    return {int(c["id"]): c for c in cards}


def deck_from_ids(ids: List[int], card_map: Dict[int, dict]) -> List[dict]:
    return [card_map[i] for i in ids if i in card_map]


def build_feature_vector_from_ids(
    ids: List[int],
    tower_troop: str,
    card_map: Dict[int, dict],
    wild_slot_mode: str | None = None,
    feature_order: List[str] | None = None,
) -> Tuple[List[float], Dict[str, float], List[dict]]:
    cards = deck_from_ids(ids, card_map)
    if len(cards) != 8:
        raise ValueError("Deck must contain 8 valid cards.")
    feats = build_feature_dict(cards, tower_troop, ids, wild_slot_mode)
    order = feature_order or FEATURE_ORDER
    return vectorize(feats, order), feats, cards
