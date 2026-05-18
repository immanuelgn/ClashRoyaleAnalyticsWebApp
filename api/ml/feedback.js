const { getMlServiceBase, getMlServiceHeaders } = require("../_lib/mlService");
const { normalizeArchetypeInput } = require("../_lib/archetypes");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const base = getMlServiceBase();
  if (!base) {
    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: "ML service URL not configured."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds.map(Number) : [];
    const towerTroop = body.towerTroop || "tower_princess";
    const wildSlotMode = body.wildSlotMode === "hero" ? "hero" : (body.wildSlotMode === "evo" ? "evo" : null);
    const won = !!body.won;
    const crownsFor = Number.isFinite(Number(body.crownsFor)) ? Number(body.crownsFor) : null;
    const crownsAgainst = Number.isFinite(Number(body.crownsAgainst)) ? Number(body.crownsAgainst) : null;
    const opponentArchetype = normalizeArchetypeInput(body.opponentArchetype);
    const gameMode = body.gameMode ? String(body.gameMode).trim() : null;
    const trophies = Number.isFinite(Number(body.trophies)) ? Number(body.trophies) : null;
    const patchVersion = body.patchVersion ? String(body.patchVersion).trim() : null;

    if (new Set(cardIds).size !== 8) {
      return res.status(400).json({ ok: false, error: "Deck must contain 8 unique card IDs." });
    }

    const url = `${String(base).replace(/\/+$/, "")}/feedback`;
    const r = await fetch(url, {
      method: "POST",
      headers: getMlServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        cardIds,
        towerTroop,
        wildSlotMode,
        won,
        crownsFor,
        crownsAgainst,
        opponentArchetype,
        gameMode,
        trophies,
        patchVersion
      })
    });

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        source: "python-ml-service",
        message: `ML feedback write failed (${r.status}).`
      });
    }

    const data = await r.json();
    return res.status(200).json({ ok: !!data?.ok, source: "python-ml-service" });
  } catch {
    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: "Could not submit ML feedback."
    });
  }
};
