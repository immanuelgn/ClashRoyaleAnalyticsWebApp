const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOCAL_CARDS_PATH = path.join(ROOT, "data", "cards.json");
const ROYALEAPI_CARDS_URL = "https://royaleapi.github.io/cr-api-data/json/cards.json";

function normalizeRarity(v) {
  return String(v || "").trim().toLowerCase();
}

async function main() {
  const local = JSON.parse(fs.readFileSync(LOCAL_CARDS_PATH, "utf8"));
  const res = await fetch(ROYALEAPI_CARDS_URL);
  if (!res.ok) throw new Error(`RoyaleAPI fetch failed: HTTP ${res.status}`);
  const remote = await res.json();

  const localById = new Map(local.map((c) => [Number(c.id), c]));
  const remoteById = new Map(remote.map((c) => [Number(c.id), c]));

  const commonIds = [...localById.keys()].filter((id) => remoteById.has(id));
  const mismatches = [];
  for (const id of commonIds) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const issues = [];
    if (String(l.name || "") !== String(r.name || "")) {
      issues.push(`name local=${l.name} remote=${r.name}`);
    }
    if (Number(l.elixirCost) !== Number(r.elixir)) {
      issues.push(`elixir local=${l.elixirCost} remote=${r.elixir}`);
    }
    if (normalizeRarity(l.rarity) !== normalizeRarity(r.rarity)) {
      issues.push(`rarity local=${l.rarity} remote=${r.rarity}`);
    }
    if (issues.length) mismatches.push({ id, card: l.name, issues });
  }

  const localOnly = [...localById.keys()].filter((id) => !remoteById.has(id));
  const remoteOnly = [...remoteById.keys()].filter((id) => !localById.has(id));

  const report = {
    localCount: local.length,
    remoteCount: remote.length,
    commonCount: commonIds.length,
    mismatchCount: mismatches.length,
    mismatchSample: mismatches.slice(0, 20),
    localOnlyCount: localOnly.length,
    remoteOnlyCount: remoteOnly.length,
    generatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

