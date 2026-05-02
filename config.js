// Runtime API base.
// Localhost: call local C# backend.
// Hosted: call same-origin /api (proxied by Vercel rewrites).
window.__CR_API_BASE__ = window.__CR_API_BASE__ || (
  location.hostname === "127.0.0.1" || location.hostname === "localhost"
    ? "http://127.0.0.1:7295"
    : "/api"
);
