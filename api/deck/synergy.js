const { analyzeDeck } = require("../_lib/deck");
const { getMlServiceBase, getMlServiceHeaders, isScoreProxyEnabled } = require("../_lib/mlService");
const { normalizeArchetypeInput } = require("../_lib/archetypes");

async function getMlPrediction(cardIds, towerTroop, wildSlotMode, scoreProxy, opponentArchetype) {
  const base = getMlServiceBase();
  if (!base) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `${base}/predict`;
    const body = {
      cardIds,
      towerTroop,
      wildSlotMode: wildSlotMode || null,
      opponentArchetype: normalizeArchetypeInput(opponentArchetype),
    };
    if (isScoreProxyEnabled()) body.scoreProxy = scoreProxy;

    const res = await fetch(url, {
      method: "POST",
      headers: getMlServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function calibrateDeckScore(rawScore, mlForecast) {
  const base = Number(rawScore || 0);
  if (!mlForecast || !Number.isFinite(Number(mlForecast.predictedWinRate))) {
    return Math.round(clamp(base, 0, 130) * 10) / 10;
  }
  const wr = clamp(Number(mlForecast.predictedWinRate || 50), 35, 80);
  const conf = clamp(Number(mlForecast.confidence || 70), 55, 95);
  const wrScore = 35 + ((wr - 35) / 45) * 95; // maps WR to ~35..130
  const confWeight = 0.40 + (((conf - 55) / 40) * 0.15); // 0.40..0.55
  const blended = (base * (1 - confWeight)) + (wrScore * confWeight);
  const ceiling = 85 + Math.max(0, wr - 50) * 1.6; // low WR cannot yield elite score
  const floor = 55 + Math.max(0, wr - 35) * 0.7;
  return Math.round(clamp(blended, floor, ceiling) * 10) / 10;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds.map(Number) : [];
    const towerTroop = body.towerTroop || "tower_princess";
    const wildSlotMode = body.wildSlotMode || null;
    const opponentArchetype = body.opponentArchetype || null;

    const result = analyzeDeck(cardIds, towerTroop, wildSlotMode, opponentArchetype);
    if (result.error) return res.status(400).json({ error: result.error });

    const ml = await getMlPrediction(cardIds, towerTroop, wildSlotMode, result.score, opponentArchetype);
    if (ml) {
      result.mlForecast = ml.mlForecast || result.mlForecast;
      result.mlSuggestions = ml.mlSuggestions || result.mlSuggestions;
      result.score = calibrateDeckScore(result.score, result.mlForecast);
      result.mlMeta = {
        source: "python-ml-service",
        modelVersion: ml.modelVersion || "unknown"
      };
    } else {
      result.mlMeta = {
        source: "embedded-js-fallback",
        modelVersion: "js-heuristic-v1"
      };
    }

    return res.status(200).json(result);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }
};


