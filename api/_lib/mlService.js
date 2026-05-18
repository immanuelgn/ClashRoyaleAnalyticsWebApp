const DEFAULT_ML_SERVICE_URL = "https://royalepro-ml.onrender.com";

function getMlServiceBase() {
  const raw = process.env.ML_SERVICE_URL || DEFAULT_ML_SERVICE_URL;
  const trimmed = String(raw || "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

module.exports = {
  getMlServiceBase,
  DEFAULT_ML_SERVICE_URL
};
