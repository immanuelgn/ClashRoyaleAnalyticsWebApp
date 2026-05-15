const fs = require("fs");
const path = require("path");

const CARDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "cards.json"), "utf8")
);

const EVO_CARD_SLUGS = new Set([
  "archers", "baby-dragon", "barbarians", "bats", "battle-ram",
  "bomber", "cannon", "dart-goblin", "electro-dragon", "executioner",
  "firecracker", "furnace", "giant-snowball", "goblin-barrel", "goblin-cage",
  "goblin-drill", "goblin-giant", "hunter", "ice-spirit",
  "inferno-dragon", "knight", "lumberjack", "mega-knight",
  "musketeer",
  "mortar", "pekka", "royal-ghost", "royal-giant",
  "royal-hogs", "royal-recruits", "skeleton-army", "skeleton-barrel", "skeletons",
  "tesla", "valkyrie", "wall-breakers", "witch", "wizard", "zap"
]);

const HERO_CARD_SLUGS = new Set([
  "barbarian-barrel", "giant", "goblins", "ice-golem", "knight",
  "magic-archer", "mega-minion", "mini-pekka", "musketeer", "wizard", "balloon",
  "dark-prince", "bowler"
]);

const EVO_FORCE_OFF_SLUGS = new Set(["the-log"]);

const DEFENSIVE_BUILDING_IDS = new Set([
  27000000, // Cannon
  27000002, // Mortar
  27000003, // Inferno Tower
  27000004, // Bomb Tower
  27000006, // Tesla
  27000008, // X-Bow
  27000009, // Tombstone
  27000010, // Barbarian Hut
  27000011, // Furnace
  27000012, // Goblin Cage
  27000013, // Goblin Hut
  27000014 // Elixir Collector
]);

function normalizeName(text) {
  return String(text || "").toLowerCase().replace(/[^\w\s-]/g, " ");
}

function isDefensiveStructureCard(card, role, name) {
  const roleIsDefense = ["defense", "building", "spawner"].includes(role);
  if (roleIsDefense) return true;
  const id = Number(card?.id || 0);
  if (DEFENSIVE_BUILDING_IDS.has(id)) return true;
  return /cannon|tesla|inferno tower|bomb tower|tombstone|x[-\s]?bow|mortar|hut|furnace|collector|elixir collector|goblin cage|spawner|building/.test(name);
}

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
  const isHero = HERO_CARD_SLUGS.has(slug);
  const isEvolution = EVO_CARD_SLUGS.has(slug) && !EVO_FORCE_OFF_SLUGS.has(slug);
  const allowedSlots = ["normal"];
  if (isEvolution) allowedSlots.push("evo");
  if (isHero || isChampion) allowedSlots.push("hero");
  if (isEvolution || isHero || isChampion) allowedSlots.push("wild");

  return {
    ...card,
    iconUrls: { medium: `https://royaleapi.github.io/cr-api-assets/cards/${slug}.png` },
    heroIconUrl: `https://royaleapi.github.io/cr-api-assets/cards/${slug}-hero.png`,
    evoIconUrl: `https://royaleapi.github.io/cr-api-assets/cards/${slug}-ev1.png`,
    isEvolution,
    isHero,
    isChampion,
    allowedSlots
  };
}

function getMetadata(card) {
  const name = normalizeName(card.name);
  const role = (card.role || "Support").toLowerCase();
  const attackType = (card.attackType || "Ground").toLowerCase();
  const isWinCondition = role === "wincondition" || /hog|giant|golem|balloon|barrel|x-bow|mortar|miner|ram rider|battle ram|goblin drill/.test(name);
  const isBuilding = isDefensiveStructureCard(card, role, name);
  const isLightSpell = /zap|log|snowball|arrows|barbarian barrel|tornado/.test(name);
  const isHeavySpell = /fireball|poison|rocket|lightning/.test(name);
  const isCycleCard = (card.elixirCost || 0) <= 2 || role === "cycle";
  const canHitAir = attackType === "both" || attackType === "air" || /musketeer|archers|baby dragon|minions|bats|electro wizard|phoenix|dart goblin|spear goblins|hunter|wizard|witch|executioner|magic archer|electro dragon|mega minion|inferno dragon|minion horde|firecracker|zappies|little prince/.test(name);
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

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hasDeckSignature(cards, names) {
  const set = new Set(cards.map((c) => String(c.name || "").toLowerCase()));
  return names.every((n) => set.has(n));
}

function applyMetaCalibration(cards, archetype, totalScore, strengths, recommendations) {
  const signatures = [
    {
      id: "hog-26",
      names: ["hog rider", "musketeer", "cannon", "ice golem", "skeletons", "ice spirit", "fireball", "the log"],
      minScore: 101,
      bonus: 5,
      strength: "Recognized meta cycle shell (Hog 2.6): elite defense-to-pressure conversion when piloted well.",
      rec: "Focus on micro-cycle timing and cannon placements; avoid overcommitting before 2x elixir."
    },
    {
      id: "hog-eq-cycle",
      names: ["hog rider", "earthquake", "the log", "firecracker"],
      minScore: 94,
      bonus: 3,
      strength: "Meta Hog EQ pattern detected: strong building pressure and consistent chip path.",
      rec: "Preserve spell cycle discipline and protect Firecracker lane geometry."
    },
    {
      id: "rhogs-aq-cycle",
      names: ["royal hogs", "archer queen", "earthquake", "royal delivery", "the log", "cannon", "ice spirit", "skeletons"],
      minScore: 104,
      bonus: 4,
      strength: "Recognized RHogs AQ 2.9 shell: top ladder control-cycle profile with high defensive efficiency.",
      rec: "Keep cycle discipline around AQ + Cannon and avoid unnecessary structural swaps."
    },
    {
      id: "lava-loon",
      names: ["lava hound", "balloon"],
      minScore: 92,
      bonus: 3,
      strength: "Meta air beatdown core detected: high punish ceiling versus weak anti-air decks.",
      rec: "Bank elixir for full pushes and track opponent anti-air rotation before committing."
    }
  ];

  let calibrated = totalScore;
  signatures.forEach((sig) => {
    if (hasDeckSignature(cards, sig.names)) {
      calibrated = Math.max(calibrated, sig.minScore) + sig.bonus;
      strengths.unshift(sig.strength);
      recommendations.unshift(sig.rec);
    }
  });

  if (archetype === "Cycle" && calibrated < 90) calibrated += 2;
  return calibrated;
}

function isProtectedMetaShell(cards) {
  const shells = [
    ["hog rider", "musketeer", "cannon", "ice golem", "skeletons", "ice spirit", "fireball", "the log"],
    ["royal hogs", "archer queen", "earthquake", "royal delivery", "the log", "cannon", "ice spirit", "skeletons"]
  ];
  return shells.some((shell) => hasDeckSignature(cards, shell));
}

function buildMlFeatures(cards, metadata, avgElixir, towerTroop) {
  const spellCount = cards.filter(c => c.role === "Spell").length;
  const lightSpellCount = metadata.filter(m => m.isLightSpell).length;
  const heavySpellCount = metadata.filter(m => m.isHeavySpell).length;
  const winConCount = metadata.filter(m => m.isWinCondition).length;
  const buildingCount = metadata.filter(m => m.isBuilding).length;
  const airCounters = metadata.filter(m => m.canHitAir).length;
  const splashCount = metadata.filter(m => m.isSplash).length;
  const cycleCards = metadata.filter(m => m.isCycleCard).length;
  const resetCount = metadata.filter(m => m.isReset).length;
  const tankCount = metadata.filter(m => m.isTank).length;
  const tower = normalizeTowerTroop(towerTroop);
  return {
    avgElixir,
    spellCount,
    lightSpellCount,
    heavySpellCount,
    winConCount,
    buildingCount,
    airCounters,
    splashCount,
    cycleCards,
    resetCount,
    tankCount,
    tower
  };
}

function predictWinRate(features) {
  // Lightweight ML-style linear model + sigmoid calibration.
  let z = 0;
  z += 0.35 * clamp(features.winConCount, 0, 2);
  z += 0.22 * clamp(features.spellCount, 0, 3);
  z += 0.18 * (features.lightSpellCount > 0 ? 1 : -0.5);
  z += 0.16 * (features.heavySpellCount > 0 ? 1 : -0.5);
  z += 0.20 * clamp(features.airCounters - 2, -1, 2);
  z += 0.14 * clamp(features.splashCount - 1, -1, 2);
  z += 0.12 * clamp(features.buildingCount, 0, 1);
  z += 0.10 * clamp(features.resetCount, 0, 1);
  z += 0.08 * clamp(features.cycleCards - 2, -2, 2);
  z += 0.06 * clamp(features.tankCount, 0, 2);
  z -= 0.20 * Math.abs(features.avgElixir - 3.6);

  if (features.tower === "cannoneer") z += (features.airCounters >= 3 ? 0.12 : -0.15);
  if (features.tower === "dagger_duchess") z += (features.cycleCards >= 2 ? 0.10 : -0.08);
  if (features.tower === "royal_chef") z += (features.tankCount >= 2 ? 0.12 : -0.08);

  const p = 1 / (1 + Math.exp(-(z - 0.9)));
  return clamp(35 + (p * 45), 35, 80);
}

function buildMlForecast(features, score, archetypeConfidence) {
  const predictedWinRate = Math.round(predictWinRate(features) * 10) / 10;
  const confidenceBase = 62 + (archetypeConfidence || 0) * 0.2 + clamp(score / 4, 0, 18);
  const confidence = Math.round(clamp(confidenceBase, 55, 94));
  const drivers = [];
  if (features.winConCount === 0) drivers.push("No clear win condition lowers conversion rate.");
  if (features.buildingCount === 0) drivers.push("No building/spawner anchor hurts defense stability.");
  if (features.lightSpellCount === 0) drivers.push("Missing light spell reduces control consistency.");
  if (features.heavySpellCount === 0) drivers.push("Missing heavy spell limits punish/finish potential.");
  if (features.airCounters <= 2) drivers.push("Low anti-air coverage creates matchup risk.");
  if (drivers.length === 0) drivers.push("Core deck profile is balanced with no major structural penalties.");
  return { predictedWinRate, confidence, topDrivers: drivers.slice(0, 3) };
}

function suggestMlUpgrades(cards, towerTroop, baselineWinRate) {
  if (isProtectedMetaShell(cards)) return [];

  const map = new Map(CARDS.map(c => [c.id, c]));
  const deckIds = cards.map(c => c.id);
  const deckSet = new Set(deckIds);
  const candidates = CARDS.filter(c => !deckSet.has(c.id)).slice(0, 80);
  const out = [];
  const baseMetadata = cards.map(getMetadata);
  const baseAvg = cards.reduce((s, c) => s + (c.elixirCost || 0), 0) / 8;
  const baseWinConCount = baseMetadata.filter(m => m.isWinCondition).length;

  const roleGroup = (card) => {
    const role = String(card?.role || "").toLowerCase();
    if (role === "wincondition") return "wincon";
    if (role === "spell") return "spell";
    if (role === "defense" || role === "building" || role === "spawner") return "defense";
    if ((card?.elixirCost || 0) <= 2) return "cycle";
    return "support";
  };

  for (let slot = 0; slot < cards.length; slot += 1) {
    const original = cards[slot];
    const outGroup = roleGroup(original);
    const outElixir = Number(original.elixirCost || 0);
    for (const incoming of candidates) {
      const inGroup = roleGroup(incoming);
      const inElixir = Number(incoming.elixirCost || 0);
      if (inGroup !== outGroup) continue;
      if (Math.abs(inElixir - outElixir) > 2.0) continue;

      const nextIds = [...deckIds];
      nextIds[slot] = incoming.id;
      if (new Set(nextIds).size !== 8) continue;
      const nextCards = nextIds.map(id => map.get(id)).filter(Boolean);
      if (nextCards.length !== 8) continue;
      const m = nextCards.map(getMetadata);
      const nextWinConCount = m.filter(x => x.isWinCondition).length;
      if (Math.abs(nextWinConCount - baseWinConCount) > 1) continue;
      const f = buildMlFeatures(nextCards, m, nextCards.reduce((s, c) => s + (c.elixirCost || 0), 0) / 8, towerTroop);
      if (Math.abs(f.avgElixir - baseAvg) > 0.45) continue;
      if (baseAvg <= 3.1 && f.avgElixir > 3.3) continue;
      const wr = predictWinRate(f);
      const delta = Math.round((wr - baselineWinRate) * 10) / 10;
      if (delta < 1.0) continue;
      out.push({
        slot: slot + 1,
        outgoing: original.name,
        incoming: incoming.name,
        predictedWinRate: Math.round(wr * 10) / 10,
        deltaWinRate: delta
      });
    }
  }

  return out.sort((a, b) => b.deltaWinRate - a.deltaWinRate).slice(0, 3);
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
  if (buildingCount >= 1) { defense += 10; breakdown["Building Coverage"] = 10; strengths.push("Defensive building/spawner anchor present."); }
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
  const singleTargetPressure = tankCount + winConCount;
  if (tt === "cannoneer") {
    if (airCounters >= 3) { totalScore += 2; towerImpact["Anti-Air Cover"] = 2; }
    else { totalScore -= 2; towerImpact["Anti-Air Cover"] = -2; weaknesses.push("Cannoneer prefers stronger anti-air support."); }
    if (splashCount >= 2 || lightSpellCount >= 1) { totalScore += 2; towerImpact["Swarm Cover"] = 2; }
    else { totalScore -= 2; towerImpact["Swarm Cover"] = -2; weaknesses.push("Cannoneer can struggle if swarm cleanup is too light."); }
    if (buildingCount >= 1) { totalScore += 2; towerImpact["Center-Pull Support"] = 2; }
    else { totalScore -= 1; towerImpact["Center-Pull Support"] = -1; recommendations.push("Cannoneer works better with a pull building (Tesla/Cannon/Bomb Tower)."); }
    if (avgElixir <= 4.2) { totalScore += 1; towerImpact["Tempo Recovery"] = 1; }
    else { totalScore -= 1; towerImpact["Tempo Recovery"] = -1; }
  } else if (tt === "dagger_duchess") {
    if (cheapCount >= 2) { totalScore += 2; towerImpact["Burst Tempo"] = 2; }
    else { totalScore -= 1; towerImpact["Burst Tempo"] = -1; }
    if (buildingCount >= 1) { totalScore += 2; towerImpact["Tank Pull Support"] = 2; }
    else { totalScore -= 2; towerImpact["Tank Pull Support"] = -2; recommendations.push("Dagger Duchess benefits from a defensive building to stabilize longer pushes."); }
    if (singleTargetPressure >= 3 && avgElixir >= 4.1) { totalScore -= 2; towerImpact["Sustained Push Durability"] = -2; }
    else { totalScore += 1; towerImpact["Sustained Push Durability"] = 1; }
  } else if (tt === "royal_chef") {
    if (tankCount >= 2 && avgElixir >= 3.7) { totalScore += 3; towerImpact["Frontline Synergy"] = 3; }
    else { totalScore -= 3; towerImpact["Frontline Synergy"] = -3; }
    if (winConCount >= 1 && supportCount >= 3) { totalScore += 1; towerImpact["Carry Support"] = 1; }
  } else if (tt === "tower_princess") {
    if (avgElixir <= 3.3 && winConCount >= 1) {
      totalScore += 2;
      towerImpact["Cycle Stability"] = 2;
    } else {
      towerImpact["Cycle Stability"] = 0;
    }
    if (airCounters >= 3 && splashCount >= 2) {
      totalScore += 1;
      towerImpact["All-Round Defense"] = 1;
    }
  } else {
    towerImpact.Baseline = 0;
  }
  if (totalScore < 0) totalScore = 0;

  const { archetype, confidence } = detectArchetype(cards, metadata, avgElixir, winConditions);
  totalScore = applyMetaCalibration(cards, archetype, totalScore, strengths, recommendations);
  const mlFeatures = buildMlFeatures(cards, metadata, avgElixir, tt);
  const mlForecast = buildMlForecast(mlFeatures, totalScore, confidence);
  let mlSuggestions = suggestMlUpgrades(cards, tt, mlForecast.predictedWinRate);
  if (mlForecast.predictedWinRate >= 62) {
    mlSuggestions = mlSuggestions.filter((s) => Number(s.deltaWinRate) >= 2.2);
  } else if (mlForecast.predictedWinRate >= 56) {
    mlSuggestions = mlSuggestions.filter((s) => Number(s.deltaWinRate) >= 1.4);
  }

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
    cards: cards.map(withFlags),
    mlForecast,
    mlSuggestions
  };
}

module.exports = { CARDS, withFlags, analyzeDeck };


