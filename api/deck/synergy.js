const { analyzeDeck } = require("../_lib/deck");

async function getMlPrediction(cardIds, towerTroop) {
  const base = process.env.ML_SERVICE_URL;
  if (!base) return null;
  try {
    const url = `${String(base).replace(/\/+$/, "")}/predict`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIds, towerTroop })
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

    const result = analyzeDeck(cardIds, towerTroop);
    if (result.error) return res.status(400).json({ error: result.error });

    const ml = await getMlPrediction(cardIds, towerTroop);
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


