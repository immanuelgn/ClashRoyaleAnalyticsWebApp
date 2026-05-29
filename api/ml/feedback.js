const { getMlServiceBase, getMlServiceHeaders } = require("../_lib/mlService");
const { normalizeArchetypeInput } = require("../_lib/archetypes");

async function postFeedbackOnce(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: getMlServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    let data = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    return { ok: r.ok, status: r.status, data, aborted: false };
  } catch (err) {
    return { ok: false, status: 0, data: null, aborted: err?.name === "AbortError" };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmMl(base, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/health`, {
      method: "GET",
      headers: getMlServiceHeaders(),
      signal: controller.signal
    });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

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
    const payload = {
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
    };

    const firstTry = await postFeedbackOnce(url, payload, 3500);
    if (firstTry.ok) {
      return res.status(200).json({ ok: true, source: "python-ml-service" });
    }

    if (firstTry.status === 401 || firstTry.status === 403) {
      return res.status(200).json({
        ok: false,
        source: "python-ml-service",
        message: `ML feedback write failed (${firstTry.status}).`,
        retryable: false
      });
    }

    await warmMl(String(base).replace(/\/+$/, ""), 1200);
    const secondTry = await postFeedbackOnce(url, payload, 7000);
    if (secondTry.ok) {
      return res.status(200).json({ ok: true, source: "python-ml-service" });
    }

    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: `Could not submit ML feedback (${secondTry.status || "network"}).`,
      retryable: true
    });
  } catch {
    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: "Could not submit ML feedback.",
      retryable: true
    });
  }
};
