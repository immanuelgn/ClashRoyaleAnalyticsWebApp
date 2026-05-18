const { analyzeDeck } = require("../_lib/deck");
const { getMlServiceBase, getMlServiceHeaders, isScoreProxyEnabled } = require("../_lib/mlService");
const { normalizeArchetypeInput } = require("../_lib/archetypes");

async function getMlPrediction(cardIds, towerTroop, wildSlotMode, scoreProxy, opponentArchetype) {
  const base = getMlServiceBase();
  if (!base) return null;
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
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
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

    const result = analyzeDeck(cardIds, towerTroop, wildSlotMode);
    if (result.error) return res.status(400).json({ error: result.error });

    const ml = await getMlPrediction(cardIds, towerTroop, wildSlotMode, result.score, opponentArchetype);
    if (ml) {
      result.mlForecast = ml.mlForecast || result.mlForecast;
      result.mlSuggestions = ml.mlSuggestions || result.mlSuggestions;
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


