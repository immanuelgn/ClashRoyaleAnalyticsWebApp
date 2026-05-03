const fs = require("fs");
const path = require("path");

const CARDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "cards.json"), "utf8")
);

const EVO_CARD_SLUGS = new Set([
  "archers", "baby-dragon", "barbarian-barrel", "barbarians", "bats", "battle-ram",
  "bomber", "cannon", "cannon-cart", "dart-goblin", "electro-dragon", "executioner",
  "firecracker", "furnace", "giant", "giant-snowball", "goblin-barrel", "goblin-cage",
  "goblin-drill", "goblin-giant", "goblins", "hunter", "ice-golem", "ice-spirit",
  "inferno-dragon", "knight", "lumberjack", "magic-archer", "mega-knight", "mega-minion",
  "mini-pekka", "mortar", "musketeer", "pekka", "royal-ghost", "royal-giant",
  "royal-hogs", "royal-recruits", "skeleton-army", "skeleton-barrel", "skeletons",
  "tesla", "valkyrie", "wall-breakers", "witch", "wizard", "zap"
]);

const HERO_CARD_SLUGS = new Set([
  "barbarian-barrel", "giant", "goblins", "ice-golem", "knight",
  "magic-archer", "mega-minion", "mini-pekka", "musketeer", "wizard", "balloon"
]);

const EVO_FORCE_OFF_SLUGS = new Set(["the-log"]);

function slugify(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "-");
}

function normalizeTowerTroop(towerTroop) {
  const key = (towerTroop || "tower_princess")
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  if (["tower_princess", "cannoneer", "dagger_duchess", "royal_chef"].includes(key)) return key;
  return "tower_princess";
}

function withFlags(card) {
  const slug = slugify(card.name);
  const isChampion = (card.rarity || "").toLowerCase() === "champion";
  const isHero = HERO_CARD_SLUGS.has(slug) || isChampion;
  const isEvolution = EVO_CARD_SLUGS.has(slug) && !EVO_FORCE_OFF_SLUGS.has(slug);
  const allowedSlots = ["normal"];
  if (isEvolution) allowedSlots.push("evo");
  if (isHero || isChampion) allowedSlots.push("hero");
  if (isEvolution || isHero || isChampion) allowedSlots.push("wild");

  return {
    ...card,
    iconUrls: { medium: `https://royaleapi.github.io/cr-api-assets/cards/${slug}.png` },
    isEvolution,
    isHero,
    isChampion,
    allowedSlots
  };
}

function getMetadata(card) {
  const name = (card.name || "").toLowerCase();
  const role = (card.role || "Support").toLowerCase();
  const attackType = (card.attackType || "Ground").toLowerCase();
  const isWinCondition = role === "wincondition" || /hog|giant|golem|balloon|barrel|x-bow|mortar|miner/.test(name);
  const isBuilding = /cannon|tesla|tower|tombstone|x-bow|mortar|hut|furnace|collector|cage|spawner/.test(name);
  const isLightSpell = /zap|log|snowball|arrows|barbarian barrel|tornado/.test(name);
  const isHeavySpell = /fireball|poison|rocket|lightning/.test(name);
  const isCycleCard = (card.elixirCost || 0) <= 2 || role === "cycle";
  const canHitAir = attackType === "both" || attackType === "air" || /musketeer|archers|baby dragon|minions|bats|electro wizard|phoenix/.test(name);
  const isTank = (card.elixirCost || 0) >= 5 || /giant|golem|pekka|lava hound|electro giant|royal giant/.test(name);
  const isSplash = /wizard|baby dragon|valkyrie|bowler|bomb|executioner|firecracker|witch|poison|fireball|arrows|zap|snowball|rocket|lightning/.test(name);
  const isReset = /zap|electro wizard|electro spirit|zappies/.test(name);

  return { isWinCondition, isBuilding, isLightSpell, isHeavySpell, isCycleCard, canHitAir, isTank, isSplash, isReset };
}

function detectArchetype(cards, metadata, avgElixir, winCons) {
  const names = cards.map(c => (c.name || "").toLowerCase());
  if (names.some(n => n.includes("x-bow"))) return { archetype: "Siege", confidence: 92 };
  if (names.some(n => n.includes("lava") || n.includes("balloon"))) return { archetype: "Air Beatdown", confidence: 85 };
  if (avgElixir >= 4.2 && winCons.length > 0) return { archetype: "Beatdown", confidence: 82 };
  if (avgElixir <= 3.2 && metadata.filter(m => m.isCycleCard).length >= 2) return { archetype: "Cycle", confidence: 84 };
  if (names.some(n => n.includes("battle ram") || n.includes("bandit"))) return { archetype: "Bridge Spam", confidence: 72 };
  return { archetype: "Control", confidence: 70 };
}

function buildMatchups(archetype) {
  if (archetype === "Beatdown") return { "Strong Against": "Cycle", "Weak Against": "Control" };
  if (archetype === "Air Beatdown") return { "Strong Against": "Ground Beatdown", "Weak Against": "Heavy Anti-Air Control" };
  if (archetype === "Cycle") return { "Strong Against": "Control", "Weak Against": "Beatdown" };
  if (archetype === "Siege") return { "Strong Against": "Slow Beatdown", "Weak Against": "Fast Pressure Cycle" };
  return { "Strong Against": "Beatdown", "Weak Against": "Cycle" };
}

function analyzeDeck(cardIds, towerTroop) {
  const unique = [...new Set(cardIds || [])];
  if (unique.length !== 8) {
    return { error: "Deck must contain 8 unique card IDs." };
  }

  const map = new Map(CARDS.map(c => [c.id, c]));
  const cards = unique.map(id => map.get(id)).filter(Boolean);
  if (cards.length !== 8) return { error: "Some selected card IDs were not found. Please submit 8 valid card IDs." };

  const avgElixir = cards.reduce((s, c) => s + (c.elixirCost || 0), 0) / cards.length;
  const metadata = cards.map(getMetadata);
  const winConditions = cards.filter((c, i) => metadata[i].isWinCondition).map(c => c.name);

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];
  const breakdown = {};
  const subScores = {};
  const towerImpact = {};

  let offense = 0;
  const winConCount = winConditions.length;
  if (winConCount === 1) {
    const supportForWinCon = cards.filter(c => ["Support", "WinCondition"].includes(c.role)).length;
    const clarity = supportForWinCon >= 3 ? 14 : 10;
    offense += clarity;
    breakdown["Win Condition Clarity"] = clarity;
    strengths.push("One primary win path identified.");
  } else if (winConCount === 2) {
    offense += 16;
    breakdown["Win Condition Clarity"] = 16;
    strengths.push("Two offensive paths available.");
  } else {
    offense += 4;
    breakdown["Win Condition Clarity"] = 4;
    weaknesses.push("No clear win condition detected.");
  }
  const supportCount = cards.filter(c => c.role === "Support" || c.role === "WinCondition").length;
  if (supportCount >= 2) { offense += 8; breakdown["Support Package"] = 8; }
  else { offense += 4; breakdown["Support Package"] = 4; weaknesses.push("Limited support for offense."); }

  let defense = 0;
  const airCounters = metadata.filter(m => m.canHitAir).length;
  if (airCounters >= 3) { defense += 12; breakdown["Air Defense"] = 12; strengths.push("Reliable anti-air coverage."); }
  else { defense += 5; breakdown["Air Defense"] = 5; weaknesses.push("Air defense may be unreliable."); }
  const buildingCount = metadata.filter(m => m.isBuilding).length;
  if (buildingCount >= 1) { defense += 10; breakdown["Building Coverage"] = 10; }
  else { defense += 4; breakdown["Building Coverage"] = 4; weaknesses.push("No defensive building/spawner detected."); }
  const splashCount = metadata.filter(m => m.isSplash).length;
  if (splashCount >= 2) { defense += 8; breakdown["Swarm Control"] = 8; } else { defense += 4; breakdown["Swarm Control"] = 4; }

  let spells = 0;
  const spellCount = cards.filter(c => c.role === "Spell").length;
  const lightSpellCount = metadata.filter(m => m.isLightSpell).length;
  const heavySpellCount = metadata.filter(m => m.isHeavySpell).length;
  if (spellCount >= 2) { spells += 8; breakdown["Spell Count"] = 8; } else { spells += 3; breakdown["Spell Count"] = 3; weaknesses.push("Deck may be under-spelled."); }
  if (lightSpellCount >= 1 && heavySpellCount >= 1) { spells += 10; breakdown["Spell Balance"] = 10; strengths.push("Healthy light + heavy spell pairing."); }
  else { spells += 4; breakdown["Spell Balance"] = 4; weaknesses.push("Spell package lacks balance."); }
  const resetCount = metadata.filter(m => m.isReset).length;
  if (resetCount > 0) { spells += 7; breakdown["Reset Access"] = 7; } else { spells += 3; breakdown["Reset Access"] = 3; }

  let cycle = 0;
  const cycleCardCount = metadata.filter(m => m.isCycleCard).length;
  if (avgElixir <= 3.2) { cycle += 12; breakdown["Cycle Speed"] = 12; }
  else if (avgElixir <= 3.8) { cycle += 9; breakdown["Cycle Speed"] = 9; }
  else { cycle += 5; breakdown["Cycle Speed"] = 5; }
  if (cycleCardCount >= 2) { cycle += 8; breakdown["Cheap Cycle Support"] = 8; }
  else { cycle += 4; breakdown["Cheap Cycle Support"] = 4; }

  let consistency = 0;
  const tankCount = metadata.filter(m => m.isTank).length;
  if (avgElixir >= 2.8 && avgElixir <= 4.3) { consistency += 10; breakdown["Elixir Balance"] = 10; }
  else { consistency += 5; breakdown["Elixir Balance"] = 5; weaknesses.push("Elixir profile is outside ideal range."); }
  if (tankCount >= 1 || winConCount >= 1) { consistency += 8; breakdown["Frontline Presence"] = 8; }
  else { consistency += 3; breakdown["Frontline Presence"] = 3; }
  if (new Set(cards.map(c => c.name.toLowerCase())).size === cards.length) { consistency += 7; breakdown["Card Uniqueness"] = 7; }
  else { breakdown["Card Uniqueness"] = 0; weaknesses.push("Duplicate cards detected."); }

  subScores.Offense = offense;
  subScores.Defense = defense;
  subScores.Spells = spells;
  subScores.Cycle = cycle;
  subScores.Consistency = consistency;

  let totalScore = offense + defense + spells + cycle + consistency;

  const tt = normalizeTowerTroop(towerTroop);
  const cheapCount = metadata.filter(m => m.isCycleCard).length;
  if (tt === "cannoneer") {
    if (airCounters >= 3) { totalScore += 2; towerImpact["Air Support Synergy"] = 2; }
    else { totalScore -= 2; towerImpact["Air Support Synergy"] = -2; weaknesses.push("Cannoneer build may struggle without enough anti-air support."); }
    if (splashCount >= 2) { totalScore += 2; towerImpact["Swarm Cover Synergy"] = 2; }
    else { totalScore -= 1; towerImpact["Swarm Cover Synergy"] = -1; }
  } else if (tt === "dagger_duchess") {
    if (cheapCount >= 2) { totalScore += 3; towerImpact["Cycle Tempo Synergy"] = 3; }
    else { totalScore -= 1; towerImpact["Cycle Tempo Synergy"] = -1; }
  } else if (tt === "royal_chef") {
    if (tankCount >= 2) { totalScore += 3; towerImpact["Frontline Synergy"] = 3; }
    else { totalScore -= 1; towerImpact["Frontline Synergy"] = -1; }
  } else {
    towerImpact.Baseline = 0;
  }
  if (totalScore < 0) totalScore = 0;

  const { archetype, confidence } = detectArchetype(cards, metadata, avgElixir, winConditions);

  if (winConCount === 0) recommendations.push("Add one clear win condition (e.g., Hog Rider, Giant, Balloon, Miner, X-Bow).");
  if (buildingCount === 0) recommendations.push("Consider adding a defensive building for stronger matchup spread.");
  if (lightSpellCount === 0) recommendations.push("Add a light spell (Log/Zap/Snowball/Arrows) for cheap control.");
  if (heavySpellCount === 0) recommendations.push("Add a heavy spell (Fireball/Poison/Rocket/Lightning) for reliable finishing and control.");
  if (avgElixir > 4.5) recommendations.push("Your deck is very heavy; consider 1-2 cheaper cycle cards.");
  if (avgElixir < 2.8) recommendations.push("Your deck is very light; consider adding a sturdier defensive core.");
  if (recommendations.length === 0) recommendations.push("Deck structure looks balanced. Next step: validate using battle-performance data.");

  const roleDistribution = {};
  for (const c of cards) roleDistribution[c.role] = (roleDistribution[c.role] || 0) + 1;

  return {
    score: totalScore,
    averageElixir: Math.round(avgElixir * 10) / 10,
    archetype,
    archetypeConfidence: confidence,
    winConditions,
    subScores,
    breakdown,
    strengths,
    weaknesses,
    recommendations,
    towerTroop: tt,
    towerImpact,
    roleDistribution,
    matchups: buildMatchups(archetype),
    cards: cards.map(withFlags)
  };
}

module.exports = { CARDS, withFlags, analyzeDeck };

