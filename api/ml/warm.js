const { getMlServiceBase, getMlServiceHeaders } = require("../_lib/mlService");

function isAuthorized(req) {
  const configured = String(process.env.CRON_SECRET || "").trim();
  if (!configured) return true;
  const auth = String(req.headers.authorization || "").trim();
  return auth === `Bearer ${configured}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
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
    const health = await fetch(`${base}/health`, {
      method: "GET",
      headers: getMlServiceHeaders(),
    });

    let healthJson = null;
    try {
      healthJson = await health.json();
    } catch {
      healthJson = null;
    }

    // Optional deeper touch: read-only status call also keeps DB path warm.
    const statusRes = await fetch(`${base}/learning/status`, {
      method: "GET",
      headers: getMlServiceHeaders(),
    });

    let statusJson = null;
    try {
      statusJson = await statusRes.json();
    } catch {
      statusJson = null;
    }

    return res.status(200).json({
      ok: !!health.ok,
      source: "python-ml-service",
      healthStatus: health.status,
      statusStatus: statusRes.status,
      modelLoaded: !!healthJson?.modelLoaded,
      modelVersion: healthJson?.modelVersion || statusJson?.modelVersion || "unknown",
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: "Warmup call failed."
    });
  }
};

