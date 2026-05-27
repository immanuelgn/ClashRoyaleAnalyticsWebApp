const { analyzeDeck } = require("../_lib/deck");
const { getMlServiceBase, getMlServiceHeaders, isScoreProxyEnabled } = require("../_lib/mlService");
const { normalizeArchetypeInput } = require("../_lib/archetypes");

async function fetchMlPredictionOnce(base, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/predict`, {
      method: "POST",
      headers: getMlServiceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, aborted: false };
  } catch (err) {
    return { ok: false, status: 0, data: null, aborted: err?.name === "AbortError" };
  } finally {
    clearTimeout(timeout);
  }
}

async function warmMlService(base, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      headers: getMlServiceHeaders(),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function getMlPrediction(cardIds, towerTroop, wildSlotMode, scoreProxy, opponentArchetype) {
  const base = getMlServiceBase();
  if (!base) return { data: null, reason: "missing_base" };
  const body = {
    cardIds,
    towerTroop,
    wildSlotMode: wildSlotMode || null,
    opponentArchetype: normalizeArchetypeInput(opponentArchetype),
  };
  if (isScoreProxyEnabled()) body.scoreProxy = scoreProxy;

  // Render cold starts can exceed a short timeout; retry once with a longer window.
  const fastTry = await fetchMlPredictionOnce(base, body, 7000);
  if (fastTry.ok && fastTry.data && typeof fastTry.data === "object") {
    return { data: fastTry.data, reason: "ok_fast" };
  }
  if (fastTry.status === 401 || fastTry.status === 403) {
    return { data: null, reason: `auth_${fastTry.status}` };
  }
  if (fastTry.status >= 400 && fastTry.status < 500 && !fastTry.aborted) {
    return { data: null, reason: `client_${fastTry.status}` };
  }

  await warmMlService(base, 65000);
  const slowTry = await fetchMlPredictionOnce(base, body, 65000);
  if (slowTry.ok && slowTry.data && typeof slowTry.data === "object") {
    return { data: slowTry.data, reason: "ok_retry" };
  }
  const finalReason = slowTry.aborted
    ? "timeout_retry"
    : (slowTry.status ? `http_${slowTry.status}` : "network_error");
  return { data: null, reason: finalReason };
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

    const mlResult = await getMlPrediction(cardIds, towerTroop, wildSlotMode, result.score, opponentArchetype);
    if (mlResult.data) {
      const ml = mlResult.data;
      result.mlForecast = ml.mlForecast || result.mlForecast;
      result.mlSuggestions = ml.mlSuggestions || result.mlSuggestions;
      result.score = calibrateDeckScore(result.score, result.mlForecast);
      result.mlMeta = {
        source: "python-ml-service",
        modelVersion: ml.modelVersion || "unknown",
        route: mlResult.reason
      };
    } else {
      result.mlMeta = {
        source: "embedded-js-fallback",
        modelVersion: "js-heuristic-v1",
        reason: mlResult.reason || "unknown"
      };
    }

    return res.status(200).json(result);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }
};


