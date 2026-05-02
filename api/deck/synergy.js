const { analyzeDeck } = require("../_lib/deck");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds.map(Number) : [];
    const result = analyzeDeck(cardIds, body.towerTroop || "tower_princess");
    if (result.error) return res.status(400).json({ error: result.error });
    return res.status(200).json(result);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }
};
