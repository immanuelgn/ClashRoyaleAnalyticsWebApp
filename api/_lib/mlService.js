const DEFAULT_ML_SERVICE_URL = "https://royalepro-ml.onrender.com";
const TRUE_PATTERN = /^(1|true|yes|on)$/i;

function getMlServiceBase() {
  const raw = process.env.ML_SERVICE_URL || DEFAULT_ML_SERVICE_URL;
  const trimmed = String(raw || "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function getMlServiceAuthToken() {
  return String(process.env.ML_SERVICE_AUTH_TOKEN || "").trim() || null;
}

function getMlServiceHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getMlServiceAuthToken();
  if (token) headers["x-ml-auth"] = token;
  return headers;
}

function isScoreProxyEnabled() {
  return TRUE_PATTERN.test(String(process.env.ML_ENABLE_SCORE_PROXY || "").trim());
}

module.exports = {
  getMlServiceBase,
  getMlServiceAuthToken,
  getMlServiceHeaders,
  isScoreProxyEnabled,
  DEFAULT_ML_SERVICE_URL
};
