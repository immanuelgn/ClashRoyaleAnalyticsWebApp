module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const base = process.env.ML_SERVICE_URL;
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

    if (new Set(cardIds).size !== 8) {
      return res.status(400).json({ ok: false, error: "Deck must contain 8 unique card IDs." });
    }

    const url = `${String(base).replace(/\/+$/, "")}/feedback`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardIds,
        towerTroop,
        won
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(200).json({
        ok: false,
        source: "python-ml-service",
        message: `ML feedback write failed (${r.status}). ${text || ""}`.trim()
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
