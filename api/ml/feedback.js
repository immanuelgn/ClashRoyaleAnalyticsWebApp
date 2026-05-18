const { getMlServiceBase, getMlServiceHeaders } = require("../_lib/mlService");

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
    const won = !!body.won;
    const crownsFor = Number.isFinite(Number(body.crownsFor)) ? Number(body.crownsFor) : null;
    const crownsAgainst = Number.isFinite(Number(body.crownsAgainst)) ? Number(body.crownsAgainst) : null;
    const opponentArchetype = normalizeOpponentArchetype(body.opponentArchetype);
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

function normalizeOpponentArchetype(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "");
  const map = new Map([
    ["cycle", "cycle"],
    ["hog cycle", "cycle"],
    ["beatdown", "beatdown"],
    ["air beatdown", "air_beatdown"],
    ["air_beatdown", "air_beatdown"],
    ["lava", "air_beatdown"],
    ["lava loon", "air_beatdown"],
    ["lavaloon", "air_beatdown"],
    ["bait", "bait"],
    ["log bait", "bait"],
    ["control", "control"],
    ["siege", "siege"],
    ["bridge spam", "bridge_spam"],
    ["bridge_spam", "bridge_spam"],
    ["bridgespam", "bridge_spam"],
    ["offmeta", "custom_offmeta"],
    ["custom", "custom_offmeta"],
    ["custom_offmeta", "custom_offmeta"],
  ]);
  if (map.has(compact)) return map.get(compact);
  const underscored = compact.replace(/\s+/g, "_");
  if (map.has(underscored)) return map.get(underscored);
  return "custom_offmeta";
}
