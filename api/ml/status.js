module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const base = process.env.ML_SERVICE_URL;
  if (!base) {
    return res.status(200).json({
      ok: false,
      source: "embedded-js-fallback",
      message: "ML service URL not configured."
    });
  }

  try {
    const url = `${String(base).replace(/\/+$/, "")}/learning/status`;
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        source: "python-ml-service",
        message: `ML service responded ${r.status}.`
      });
    }
    const data = await r.json();
    return res.status(200).json({
      ok: true,
      source: "python-ml-service",
      ...data
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      source: "python-ml-service",
      message: "Could not reach ML service."
    });
  }
};

