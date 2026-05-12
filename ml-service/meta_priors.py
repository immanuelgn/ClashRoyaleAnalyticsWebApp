from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
META_DECKS_PATH = ROOT / "data" / "meta_decks_seed.json"


def load_meta_decks() -> List[dict]:
  if not META_DECKS_PATH.exists():
    return []
  try:
    return json.loads(META_DECKS_PATH.read_text(encoding="utf-8"))
  except Exception:
    return []


def _jaccard(a: set[int], b: set[int]) -> float:
  if not a or not b:
    return 0.0
  inter = len(a.intersection(b))
  union = len(a.union(b))
  return float(inter / union) if union else 0.0


def compute_meta_features(deck_ids: List[int], meta_decks: List[dict]) -> Dict[str, float]:
  deck_set = set(int(x) for x in deck_ids)
  if len(deck_set) != 8 or not meta_decks:
    return {
      "meta_max_similarity": 0.0,
      "meta_top3_similarity": 0.0,
      "meta_weighted_win_rate": 0.0,
      "meta_weighted_usage": 0.0,
      "meta_weighted_rating": 0.0,
    }

  scored = []
  for row in meta_decks:
    raw_cards = row.get("cards") or []
    meta_ids = set(int(x) for x in raw_cards if isinstance(x, int) or str(x).isdigit())
    if len(meta_ids) != 8:
      continue
    sim = _jaccard(deck_set, meta_ids)
    if sim <= 0:
      continue
    scored.append(
      {
        "sim": sim,
        "wr": float(row.get("winRatePct") or 0.0),
        "usage": float(row.get("usagePct") or 0.0),
        "rating": float(row.get("rating") or 0.0),
      }
    )

  if not scored:
    return {
      "meta_max_similarity": 0.0,
      "meta_top3_similarity": 0.0,
      "meta_weighted_win_rate": 0.0,
      "meta_weighted_usage": 0.0,
      "meta_weighted_rating": 0.0,
    }

  scored.sort(key=lambda x: x["sim"], reverse=True)
  top3 = scored[:3]
  sim_weights = sum(x["sim"] for x in top3) or 1.0
  wr = sum(x["sim"] * x["wr"] for x in top3) / sim_weights
  usage = sum(x["sim"] * x["usage"] for x in top3) / sim_weights
  rating = sum(x["sim"] * x["rating"] for x in top3) / sim_weights
  return {
    "meta_max_similarity": float(top3[0]["sim"]),
    "meta_top3_similarity": float(sum(x["sim"] for x in top3) / len(top3)),
    "meta_weighted_win_rate": float(wr),
    "meta_weighted_usage": float(usage),
    "meta_weighted_rating": float(rating),
  }
