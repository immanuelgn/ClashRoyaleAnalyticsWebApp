let chartInstance = null;
let radarChartInstance = null;
let subscoreMiniChartInstance = null;
let towerImpactMiniChartInstance = null;
let ACTIVE_API_BASE = window.__CR_API_BASE__ || "http://127.0.0.1:7295";
const ASSET_VARIANT_BASE = "https://raw.githubusercontent.com/RoyaleAPI/cr-api-assets/master/cards/";
const REV_KEY = "cr_deck_revisions_v1";
const SELECT_GUARD_MS = 140;

function fmtPct(value, digits = 1) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(digits);
}

function normalizeBase(base) {
  return String(base || "").trim().replace(/\/+$/, "");
}

function apiUrl(base, endpoint) {
  const cleanBase = normalizeBase(base);
  const cleanEndpoint = `/${String(endpoint || "").replace(/^\/+/, "")}`;
  if (cleanBase.endsWith("/api")) return `${cleanBase}${cleanEndpoint}`;
  return `${cleanBase}/api${cleanEndpoint}`;
}

function getApiBaseCandidates() {
  const out = [];
  const push = (v) => {
    const value = normalizeBase(v);
    if (!value) return;
    if (!out.includes(value)) out.push(value);
  };
  push(ACTIVE_API_BASE);
  push("/api");
  push(location.origin === "null" ? "" : location.origin);
  push("https://clashroyaleanalyticswebapp.vercel.app/api");
  return out;
}

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

const HERO_ART_OVERRIDES = {
  "Balloon": [
    "/assets/hero/balloon-hero-cover.png",
    "assets/hero/balloon-hero-cover.png"
  ],
  "Dark Prince": [
    "https://cdns3.royaleapi.com/cdn-cgi/image/w=2160,h=2880/static/img/blog/2026-05-season-83/hero-dark-prince/v1-d8e70510/hero-dp-a-288-002.jpg",
    "https://cdns3.royaleapi.com/cdn-cgi/image/w=2160,h=2880/static/img/blog/2026-05-season-83/hero-dark-prince/v1-d8e70510/hero-dp-a-288-004.jpg"
  ],
  "Bowler": [
    "https://cdns3.royaleapi.com/cdn-cgi/image/w=2160,h=2880/static/img/blog/2026-05-season-83/hero-bowler/v1-6b57ad72/hero-bowler-a-288-002.jpg",
    "https://cdns3.royaleapi.com/cdn-cgi/image/w=2160,h=2880/static/img/blog/2026-05-season-83/hero-bowler/v1-6b57ad72/hero-bowler-a-288-004.jpg"
  ]
};

const SLOT_RULES = [
  { id: 0, type: "evo", label: "Slot 1 - Evo Only" },
  { id: 1, type: "wild", label: "Slot 2 - Wild (Evo/Hero/Champion)" },
  { id: 2, type: "hero", label: "Slot 3 - Hero/Champion" },
  { id: 3, type: "normal", label: "Slot 4 - Normal" },
  { id: 4, type: "normal", label: "Slot 5 - Normal" },
  { id: 5, type: "normal", label: "Slot 6 - Normal" },
  { id: 6, type: "normal", label: "Slot 7 - Normal" },
  { id: 7, type: "normal", label: "Slot 8 - Normal" }
];

const TOWER_TROOPS = [
  { id: "tower_princess", label: "Tower Princess" },
  { id: "royal_chef", label: "Royal Chef" },
  { id: "cannoneer", label: "Cannoneer" },
  { id: "dagger_duchess", label: "Dagger Duchess" }
];

const TOWER_TROOP_ICONS = {
  tower_princess: "/assets/towers/tower-princess.png",
  royal_chef: "/assets/towers/royal-chef.png",
  cannoneer: "/assets/towers/cannoneer.png",
  dagger_duchess: "/assets/towers/dagger-duchess.png"
};

const META_PRESETS = [
  { name: "Hog EQ Cycle", cards: [26000021, 26000014, 26000012, 26000010, 26000031, 28000014, 28000000, 27000000], towerTroop: "tower_princess" },
  { name: "Giant Beatdown", cards: [26000003, 26000007, 26000015, 26000024, 26000019, 28000000, 28000017, 26000010], towerTroop: "royal_chef" },
  { name: "X-Bow Siege", cards: [27000008, 26000002, 26000010, 26000001, 28000004, 28000017, 26000031, 28000010], towerTroop: "cannoneer" },
  { name: "Lava Loon", cards: [26000029, 26000004, 26000022, 26000015, 26000011, 28000000, 28000008, 26000010], towerTroop: "tower_princess" },
  { name: "Hyper Bait", cardNames: ["Goblin Barrel", "Princess", "Dart Goblin", "Goblin Gang", "Rocket", "The Log", "Knight", "Inferno Tower"], towerTroop: "dagger_duchess" },
  { name: "Classic Golem Beatdown", cardNames: ["Golem", "Night Witch", "Baby Dragon", "Lumberjack", "Tornado", "Lightning", "Barbarian Barrel", "Mega Minion"], towerTroop: "royal_chef" },
  { name: "Royal Hogs EQ Cycle", cardNames: ["Royal Hogs", "Earthquake", "Archer Queen", "Cannon", "Fire Spirit", "The Log", "Skeletons", "Musketeer"], towerTroop: "tower_princess" },
  { name: "PEKKA Bridge Spam", cardNames: ["P.E.K.K.A", "Bandit", "Royal Ghost", "Battle Ram", "Electro Wizard", "Poison", "Zap", "Magic Archer"], towerTroop: "cannoneer" }
];

const state = {
  cards: [],
  filteredCards: [],
  deck: Array(8).fill(null),
  drag: null,
  selectedTowerTroop: "tower_princess",
  latestAnalysis: null,
  revisions: [],
  wildSlotModes: {},
  lastPoolSelect: { cardId: null, at: 0 }
};

const OPP_ARCHETYPE_NORMALIZE = new Map([
  ["cycle", "cycle"],
  ["hog cycle", "cycle"],
  ["beatdown", "beatdown"],
  ["air beatdown", "air_beatdown"],
  ["air_beatdown", "air_beatdown"],
  ["lava", "air_beatdown"],
  ["lava loon", "air_beatdown"],
  ["lavaloon", "air_beatdown"],
  ["bait", "bait"],
  ["log bait", "bait"],
  ["control", "control"],
  ["siege", "siege"],
  ["bridge spam", "bridge_spam"],
  ["bridge_spam", "bridge_spam"],
  ["bridgespam", "bridge_spam"],
  ["offmeta", "custom_offmeta"],
  ["custom", "custom_offmeta"],
  ["custom_offmeta", "custom_offmeta"]
]);

const deckSlotsEl = document.getElementById("deckSlots");
const towerTroopsEl = document.getElementById("towerTroops");
const cardPoolEl = document.getElementById("cardPool");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("searchInput");
const simDeckSelect = document.getElementById("simDeckSelect");
const weaknessPanelEl = document.getElementById("weaknessPanel");

document.getElementById("analyzeBtn").addEventListener("click", analyzeDeck);
document.getElementById("optimizeTowerBtn").addEventListener("click", optimizeTowerTroop);
document.getElementById("clearBtn").addEventListener("click", clearDeck);
document.getElementById("simRunBtn").addEventListener("click", runMatchupSim);
document.getElementById("saveRevisionBtn").addEventListener("click", saveRevision);
document.getElementById("exportRevisionBtn").addEventListener("click", exportSnapshot);
document.getElementById("mlWonBtn")?.addEventListener("click", () => submitMlFeedback(true));
document.getElementById("mlLostBtn")?.addEventListener("click", () => submitMlFeedback(false));
searchEl.addEventListener("input", onSearch);
document.querySelectorAll(".weakness-btn").forEach((btn) => btn.addEventListener("click", () => runWeaknessProfile(btn.dataset.profile)));

boot();

async function boot() {
  statusEl.textContent = "Loading card pool...";
  loadRevisions();
  try {
    const { cards, base } = await loadCardsWithFallback();
    ACTIVE_API_BASE = base;
    state.cards = normalizeCardFlags(cards).sort((a, b) => a.name.localeCompare(b.name));
    state.filteredCards = [...state.cards];
    renderTowerTroops();
    renderSlots();
    renderCardPool();
    renderMetaPresets();
    renderRevisionList();
    renderQuickRead(null);
    renderBattleSnapshot(null);
    renderSubscoreMiniChart(null);
    renderTowerImpactMiniChart(null);
    statusEl.textContent = "Drag cards, choose tower troop, then analyze.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Could not load cards from API. Please refresh once.";
  }
}

async function loadCardsWithFallback() {
  let lastError = null;
  for (const base of getApiBaseCandidates()) {
    try {
      const res = await fetch(apiUrl(base, "clashroyale/cards"), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("Empty card response");
      return { cards: data, base };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("No API endpoint available");
}

function normalizeCardFlags(cards) {
  return (cards || []).map((c) => {
    const slug = toCardSlug(c.name);
    const isChampion = !!c.isChampion;
    const isHero = HERO_CARD_SLUGS.has(slug);
    const isEvolution = EVO_CARD_SLUGS.has(slug) && !EVO_FORCE_OFF_SLUGS.has(slug);
    const allowedSlots = ["normal"];
    if (isEvolution) allowedSlots.push("evo");
    if (isHero || isChampion) allowedSlots.push("hero");
    if (isEvolution || isHero || isChampion) allowedSlots.push("wild");
    return {
      ...c,
      isHero,
      isChampion,
      isEvolution,
      allowedSlots
    };
  });
}

function renderMetaPresets() {
  if (!simDeckSelect) return;
  simDeckSelect.innerHTML = "";
  META_PRESETS.forEach((p, i) => {
    const isReady = !!resolvePresetCardIds(p);
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = isReady ? p.name : `${p.name} (updating...)`;
    simDeckSelect.appendChild(opt);
  });
}

function onSearch() {
  const q = searchEl.value.trim().toLowerCase();
  state.filteredCards = state.cards.filter((c) => c.name.toLowerCase().includes(q));
  renderCardPool();
}

function clearDeck() {
  state.deck = Array(8).fill(null);
  state.wildSlotModes = {};
  state.latestAnalysis = null;
  renderSlots();
  renderCardPool();
  ["towerOptimizerList", "deltaBreakdown", "weaknessProfileList", "patchDriftList", "simDetails", "mlDriversList", "mlSuggestionsList"].forEach((id) => renderList(id, []));
  ["towerOptimizerBest", "deltaSummary", "patchDriftLine", "simSummary", "mlForecastLine"].forEach((id) => setText(id, ""));
  setText("learningStatusLine", "");
  setText("mlFeedbackLine", "");
  ["mlOppArchetypeInput", "mlTrophiesInput", "mlCrownsForInput", "mlCrownsAgainstInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderMetricTiles("subscoreTiles", []);
  renderMetricTiles("towerImpactTiles", []);
  renderSubscoreMiniChart(null);
  renderTowerImpactMiniChart(null);
  renderMlForecastVisual(null);
  renderTowerOptimizerVisual([]);
  renderSwapBoard([]);
  setRisk("riskAir", "riskAirLabel", 0);
  setRisk("riskSwarm", "riskSwarmLabel", 0);
  setRisk("riskBeatdown", "riskBeatdownLabel", 0);
  setPatchDriftMeter(0);
  renderQuickRead(null);
  renderBattleSnapshot(null);
  weaknessPanelEl?.classList.add("hidden");
  renderBuilderMetrics();
  statusEl.textContent = "Deck cleared.";
}

function renderTowerTroops() {
  towerTroopsEl.innerHTML = "";
  TOWER_TROOPS.forEach((tower) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tower-btn ${state.selectedTowerTroop === tower.id ? "active" : ""}`;
    const img = document.createElement("img");
    img.className = "tower-icon";
    img.alt = tower.label;
    img.src = TOWER_TROOP_ICONS[tower.id];
    const label = document.createElement("span");
    label.className = "tower-label";
    label.textContent = tower.label;
    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      state.selectedTowerTroop = tower.id;
      renderTowerTroops();
      statusEl.textContent = `Tower troop selected: ${tower.label}.`;
    });
    towerTroopsEl.appendChild(btn);
  });
}

function renderSlots() {
  deckSlotsEl.innerHTML = "";
  SLOT_RULES.forEach((rule, index) => {
    const slot = document.createElement("div");
    slot.className = `slot ${rule.type}`;
    slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("drag-over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
    slot.addEventListener("drop", (e) => { e.preventDefault(); slot.classList.remove("drag-over"); handleDropOnSlot(index); });

    const title = document.createElement("div");
    title.className = "slot-title";
    title.textContent = rule.label;
    slot.appendChild(title);

    const card = state.deck[index];
    if (card) {
      slot.appendChild(buildCardChip(card, {
        showRemove: true,
        onRemove: () => removeCardFromSlot(index),
        slotType: getVisualMode(card, rule.type, index),
        slotRuleType: rule.type,
        slotIndex: index,
        draggable: true,
        onDragStart: () => { state.drag = { source: "slot", slotIndex: index, cardId: card.id }; },
        onDragEnd: () => { state.drag = null; }
      }));
    }

    deckSlotsEl.appendChild(slot);
  });
  renderBuilderMetrics();
}

function renderCardPool() {
  cardPoolEl.innerHTML = "";
  state.filteredCards.forEach((card) => {
    const inDeck = state.deck.some((d) => d?.id === card.id);
    const chip = buildCardChip(card, {
      showRemove: false,
      slotType: null,
      slotRuleType: null,
      draggable: !inDeck,
      onDragStart: () => { state.drag = { source: "pool", cardId: card.id }; },
      onDragEnd: () => { state.drag = null; }
    });

    if (inDeck) chip.classList.add("in-deck");
    else {
      const onSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectPoolCard(card.id);
      };
      chip.addEventListener("pointerup", onSelect);
      chip.addEventListener("click", onSelect);
    }

    cardPoolEl.appendChild(chip);
  });
}

function selectPoolCard(cardId) {
  const now = Date.now();
  if (state.lastPoolSelect.cardId === cardId && (now - state.lastPoolSelect.at) < SELECT_GUARD_MS) return;
  state.lastPoolSelect = { cardId, at: now };
  addCardToFirstValidSlot(cardId);
}

function buildCardChip(card, options) {
  const { showRemove, onRemove, slotType, slotRuleType, slotIndex, draggable, onDragStart, onDragEnd } = options;
  const isPoolCard = !showRemove && !slotType;
  const slotLabel = slotType ? slotType.toUpperCase() : (slotRuleType ? slotRuleType.toUpperCase() : "CARD");
  const chip = document.createElement("div");
  chip.className = "card-chip";
  if (slotType) chip.classList.add(`slot-${slotType}`);

  if (draggable) {
    chip.draggable = true;
    chip.addEventListener("dragstart", onDragStart);
    chip.addEventListener("dragend", onDragEnd);
  }

  const image = getDisplayImage(card, slotType);
  const fallbackChain = getDisplayImageFallbacks(card, slotType, slotIndex);
  const fallbackData = escapeHtml(fallbackChain.join("|"));
  const hasEvoMode = isEvolutionCard(card);
  const hasHeroMode = isHeroOrChampion(card);
  const canToggleWildMode = slotRuleType === "wild" && showRemove && (hasEvoMode || hasHeroMode);
  const currentWildMode = canToggleWildMode ? getWildModeForCard(slotIndex, card) : "";
  chip.innerHTML = `
    ${isPoolCard ? "" : `<span class="variant-pill">${slotLabel}</span>`}
    ${slotType ? getSlotBadge(slotType) : ""}
    <div class="card-img-wrap">
      <img class="card-img" src="${image || card.iconUrls?.medium || ""}" data-fallbacks="${fallbackData}" data-fallback-index="0" onerror="window.__crNextImageFallback && window.__crNextImageFallback(this)" alt="${escapeHtml(card.name)}" loading="lazy" />
    </div>
    <div class="name">${card.name}${isPoolCard ? getPoolSpecialSuffix(card) : ""}</div>
    <div class="meta">${card.elixirCost} Elixir</div>
    ${slotType ? `<div class="mode-line ${slotType}">${getModeLabel(slotType, slotRuleType, card)}</div>` : ""}
    ${canToggleWildMode ? `<div class="mode-switch"><button type="button" class="mode-opt ${currentWildMode === "evo" ? "active" : ""}" data-mode="evo" ${hasEvoMode ? "" : "disabled"}>EVO</button><button type="button" class="mode-opt ${currentWildMode === "hero" ? "active" : ""}" data-mode="hero" ${hasHeroMode ? "" : "disabled"}>HERO</button></div>` : ""}
  `;

  if (showRemove && onRemove) {
    chip.addEventListener("dblclick", onRemove);
    chip.title = "Double-click to remove";
  }

  if (canToggleWildMode) {
    chip.querySelectorAll(".mode-opt").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextMode = btn.dataset.mode;
        if (nextMode !== "evo" && nextMode !== "hero") return;
        if ((nextMode === "evo" && !hasEvoMode) || (nextMode === "hero" && !hasHeroMode)) return;
        state.wildSlotModes[slotIndex] = nextMode;
        const check = validateDeckComposition(state.deck);
        if (!check.ok) {
          // Revert if mode switch breaks composition rules.
          state.wildSlotModes[slotIndex] = nextMode === "evo" ? "hero" : "evo";
          statusEl.textContent = check.message;
          return;
        }
        renderSlots();
      });
    });
  }

  return chip;
}

function getDisplayImage(card, slotType) {
  const chain = getDisplayImageFallbacks(card, slotType, 1);
  if (chain.length > 0) return chain[0];
  return card.iconUrls?.medium || "";
}

function getDisplayImageFallbacks(card, slotType, slotIndex = -1) {
  const base = card.iconUrls?.medium || "";
  const slug = toCardSlug(card.name);
  const list = [];

  const push = (url) => {
    if (!url || typeof url !== "string") return;
    if (!list.includes(url)) list.push(url);
  };

  if (slotType === "evo") {
    push(`${ASSET_VARIANT_BASE}${slug}-ev1.png`);
    push(`${ASSET_VARIANT_BASE}${slug}-hero-ev1.png`);
    push(card.evoIconUrl);
    push(base);
    return list;
  }
  if (slotType === "hero") {
    // Keep local override optional, but always prefer RoyaleAPI card-asset hero art over blog promo posters.
    for (const url of (HERO_ART_OVERRIDES[card.name] || [])) push(url);
    push(`${ASSET_VARIANT_BASE}${slug}-hero.png`);
    push(card.heroIconUrl);
    push(base);
    return list;
  }
  if (slotType === "wild") {
    const wildMode = getWildModeForCard(slotIndex, card);
    if (wildMode === "hero") {
      // Keep local override optional, but always prefer RoyaleAPI card-asset hero art over blog promo posters.
      for (const url of (HERO_ART_OVERRIDES[card.name] || [])) push(url);
      push(`${ASSET_VARIANT_BASE}${slug}-hero.png`);
      push(card.heroIconUrl);
      push(base);
      return list;
    }
    push(`${ASSET_VARIANT_BASE}${slug}-ev1.png`);
    push(`${ASSET_VARIANT_BASE}${slug}-hero-ev1.png`);
    push(card.evoIconUrl);
    push(base);
    return list;
  }
  push(base);
  return list;
}

function getPoolSpecialSuffix(card) {
  const evo = !!card.isEvolution;
  const champ = !!card.isChampion;
  const hero = !!card.isHero && !champ;
  if (evo && champ) return " /EVO/CHAMP";
  if (evo && hero) return " /EVO/HERO";
  if (champ) return " /CHAMP";
  if (evo) return " /EVO";
  if (hero) return " /HERO";
  return "";
}

function toCardSlug(name) {
  return name.toLowerCase().replaceAll(".", "").replaceAll("'", "").replaceAll("&", "and").replaceAll(" ", "-").replaceAll("--", "-");
}

window.__crNextImageFallback = function __crNextImageFallback(imgEl) {
  try {
    const raw = imgEl?.dataset?.fallbacks || "";
    const list = raw.split("|").map((s) => s.trim()).filter(Boolean);
    const current = imgEl.getAttribute("src") || "";
    const idx = Number(imgEl?.dataset?.fallbackIndex || 0);
    const next = list[idx + 1];
    if (next && next !== current) {
      imgEl.dataset.fallbackIndex = String(idx + 1);
      imgEl.setAttribute("src", next);
      return;
    }
  } catch (err) {
    // no-op
  }
  imgEl.removeAttribute("onerror");
};

function getModeLabel(slotType, slotRuleType, card = null) {
  const champ = !!card?.isChampion;
  if (slotRuleType === "wild") {
    if (slotType === "hero") return champ ? "WILD-CHAMP MODE" : "WILD-HERO MODE";
    return "WILD-EVO MODE";
  }
  if (slotType === "evo") return "EVO MODE";
  if (slotType === "hero") return champ ? "CHAMP MODE" : "HERO MODE";
  return "";
}

function handleDropOnSlot(targetSlotIndex) {
  if (!state.drag) return;
  if (state.drag.source === "pool") return placeCardInSlot(state.drag.cardId, targetSlotIndex);
  if (state.drag.source === "slot") return moveOrSwapSlotCard(state.drag.slotIndex, targetSlotIndex);
}

function moveOrSwapSlotCard(from, to) {
  if (from === to) return;
  const fromCard = state.deck[from];
  const toCard = state.deck[to];
  if (!fromCard) return;

  const candidate = [...state.deck];
  candidate[to] = fromCard;
  candidate[from] = toCard || null;

  if (!validateCardForSlot(fromCard, SLOT_RULES[to].type, candidate).ok) return statusEl.textContent = validateCardForSlot(fromCard, SLOT_RULES[to].type, candidate).message;
  if (toCard && !validateCardForSlot(toCard, SLOT_RULES[from].type, candidate).ok) return statusEl.textContent = validateCardForSlot(toCard, SLOT_RULES[from].type, candidate).message;
  if (!validateDeckComposition(candidate).ok) return statusEl.textContent = validateDeckComposition(candidate).message;

  state.deck = candidate;
  syncWildSlotModes();
  renderSlots();
  renderCardPool();
}

function addCardToFirstValidSlot(cardId) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;

  // Prioritize slots by card type so click-to-add feels correct.
  const slotOrder = getPreferredSlotOrder(card);
  let lastMessage = "No valid empty slot available for that card.";

  for (const i of slotOrder) {
    if (state.deck[i]) continue;
    const placed = tryPlaceCardInSlot(card, i);
    if (placed.ok) {
      renderSlots();
      renderCardPool();
      return;
    }
    lastMessage = placed.message || lastMessage;
  }
  // Fallback: for normal cards, snap to first available normal slot.
  if (!isSpecialCard(card)) {
    for (let i = 0; i < SLOT_RULES.length; i += 1) {
      if (SLOT_RULES[i].type !== "normal") continue;
      if (state.deck[i]) continue;
      const placed = tryPlaceCardInSlot(card, i);
      if (placed.ok) {
        renderSlots();
        renderCardPool();
        return;
      }
      lastMessage = placed.message || lastMessage;
    }
  }
  statusEl.textContent = lastMessage;
}

function getPreferredSlotOrder(card) {
  const indices = SLOT_RULES.map((_, idx) => idx);
  const hero = !!(card.isHero || card.isChampion);
  const evo = !!card.isEvolution;

  if (hero && evo) return [2, 1, 0, 3, 4, 5, 6, 7];
  if (hero) return [2, 1, 3, 4, 5, 6, 7, 0];
  if (evo) return [0, 1, 3, 4, 5, 6, 7, 2];
  return indices;
}

function removeCardFromSlot(index) {
  state.deck[index] = null;
  if (SLOT_RULES[index].type === "wild") delete state.wildSlotModes[index];
  syncWildSlotModes();
  renderSlots();
  renderCardPool();
}

function placeCardInSlot(cardId, slotIndex) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;
  const result = tryPlaceCardInSlot(card, slotIndex);
  if (!result.ok) return statusEl.textContent = result.message;
  renderSlots();
  renderCardPool();
}

function tryPlaceCardInSlot(card, slotIndex) {
  if (state.deck.some((d) => d?.id === card.id)) return { ok: false, message: "Card already in deck." };
  const candidate = [...state.deck];
  candidate[slotIndex] = card;
  const slotCheck = validateCardForSlot(card, SLOT_RULES[slotIndex].type, candidate);
  if (!slotCheck.ok) return { ok: false, message: slotCheck.message };
  const deckCheck = validateDeckComposition(candidate);
  if (!deckCheck.ok) return { ok: false, message: deckCheck.message };
  if (SLOT_RULES[slotIndex].type === "wild") {
    state.wildSlotModes[slotIndex] = computeWildMode(card, state.wildSlotModes[slotIndex]);
  }
  state.deck = candidate;
  return { ok: true, message: "" };
}

function isHeroOrChampion(card) { return !!(card?.isHero || card?.isChampion); }
function isEvolutionCard(card) { return !!card?.isEvolution; }
function isSpecialCard(card) { return isHeroOrChampion(card) || isEvolutionCard(card); }

function validateCardForSlot(card, slotType, deckState) {
  const allowed = Array.isArray(card.allowedSlots) ? card.allowedSlots : ["normal"];
  if (!allowed.includes(slotType)) {
    if (slotType === "evo") return { ok: false, message: `"${card.name}" cannot be used as Evolution in Slot 1.` };
    if (slotType === "wild") return { ok: false, message: `"${card.name}" cannot be used in Wild Slot.` };
    if (slotType === "hero") return { ok: false, message: `"${card.name}" is not a Hero/Champion card for Slot 3.` };
    if (slotType === "normal") return { ok: false, message: `"${card.name}" is special and must be in Evo/Wild/Hero slots.` };
  }
  return { ok: true };
}

function validateDeckComposition(deckState) {
  // Special-slot limits are enforced by slot types (1 Evo slot, 1 Hero slot, 1 Wild slot).
  // Wild mode switching is still validated elsewhere by card capabilities.
  return { ok: true };
}

function countSpecialModeUsage(deckState) {
  let heroCount = 0;
  let evoCount = 0;

  for (let i = 0; i < deckState.length; i += 1) {
    const card = deckState[i];
    if (!card) continue;

    const slotType = SLOT_RULES[i].type;

    if (slotType === "evo") {
      evoCount += 1;
      continue;
    }

    if (slotType === "hero") {
      heroCount += 1;
      continue;
    }

    if (slotType === "wild") {
      const wildMode = getWildModeForCard(i, card);
      if (wildMode === "hero" && isHeroOrChampion(card)) {
        heroCount += 1;
      } else if (wildMode === "evo" && isEvolutionCard(card)) {
        evoCount += 1;
      }
    }
  }

  return { heroCount, evoCount };
}

function getWildModeForCard(slotIndex, card) {
  return computeWildMode(card, state.wildSlotModes[slotIndex]);
}

function computeWildMode(card, preferred) {
  const canHero = isHeroOrChampion(card);
  const canEvo = isEvolutionCard(card);
  if (preferred === "hero" && canHero) return "hero";
  if (preferred === "evo" && canEvo) return "evo";
  if (canEvo) return "evo";
  if (canHero) return "hero";
  return "evo";
}

function syncWildSlotModes() {
  for (let i = 0; i < SLOT_RULES.length; i += 1) {
    if (SLOT_RULES[i].type !== "wild") continue;
    const card = state.deck[i];
    if (!card) {
      delete state.wildSlotModes[i];
      continue;
    }
    state.wildSlotModes[i] = computeWildMode(card, state.wildSlotModes[i]);
  }
}

function getVisualMode(card, slotType, slotIndex = -1) {
  if (slotType === "hero") return "hero";
  if (slotType === "evo") return "evo";
  if (slotType === "wild") return getWildModeForCard(slotIndex, card);
  return null;
}

function getSlotBadge(slotType) {
  if (slotType === "evo") return '<span class="fx-badge evo">EVO</span>';
  if (slotType === "hero") return '<span class="fx-badge hero">HERO/CHAMP</span>';
  if (slotType === "wild") return '<span class="fx-badge wild">WILD</span>';
  return "";
}

async function analyzeDeck() {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Deck must contain all 8 cards before analysis.";
  try {
    statusEl.textContent = "Analyzing deck...";
    const data = await analyzePayload({ cardIds: cards.map((c) => c.id), towerTroop: state.selectedTowerTroop });
    state.latestAnalysis = data;
    renderAllAnalysis(data);
    await renderLearningStatus();
    statusEl.textContent = "Analyzing suggested changes...";
    await runDeltaEngine();
    renderPatchDrift(data);
    statusEl.textContent = "Analysis complete.";
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
}

async function renderLearningStatus() {
  const el = document.getElementById("learningStatusLine");
  if (!el) return;
  try {
    const res = await fetch(apiUrl(ACTIVE_API_BASE, "ml/status"));
    const data = await res.json();
    if (!data?.ok) {
      el.textContent = "Adaptive learning status: offline (local fallback mode).";
      return;
    }
    const analysisEvents = Number(data.analysisEvents || 0);
    const feedbackEvents = Number(data.feedbackEvents || 0);
    const seen = Number(data.calibration?.seenEvents || 0);
    const bias = Number(data.calibration?.bias || 0).toFixed(3);
    const scale = Number(data.calibration?.scale || 1).toFixed(3);
    el.textContent = `Adaptive learning active: ${analysisEvents} analyses, ${feedbackEvents} feedback rows, calibration seen=${seen} (bias ${bias}, scale ${scale}).`;
  } catch {
    el.textContent = "Adaptive learning status unavailable right now.";
  }
}

async function submitMlFeedback(won) {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) {
    statusEl.textContent = "Build 8-card deck first, then submit match feedback.";
    return;
  }
  const oppArchetypeRaw = document.getElementById("mlOppArchetypeInput")?.value?.trim() || "";
  const trophiesRaw = document.getElementById("mlTrophiesInput")?.value;
  const crownsForRaw = document.getElementById("mlCrownsForInput")?.value;
  const crownsAgainstRaw = document.getElementById("mlCrownsAgainstInput")?.value;
  const trophies = trophiesRaw === "" ? null : Number(trophiesRaw);
  const crownsFor = crownsForRaw === "" ? null : Number(crownsForRaw);
  const crownsAgainst = crownsAgainstRaw === "" ? null : Number(crownsAgainstRaw);
  const line = document.getElementById("mlFeedbackLine");
  if (line) line.textContent = "Saving feedback...";
  try {
    const payload = {
      cardIds: cards.map((c) => c.id),
      towerTroop: state.selectedTowerTroop,
      won: !!won,
      crownsFor: Number.isFinite(crownsFor) ? Math.max(0, Math.min(3, crownsFor)) : null,
      crownsAgainst: Number.isFinite(crownsAgainst) ? Math.max(0, Math.min(3, crownsAgainst)) : null,
      opponentArchetype: normalizeOpponentArchetype(oppArchetypeRaw),
      gameMode: "normal_battle",
      trophies: Number.isFinite(trophies) ? Math.max(0, Math.min(10000, trophies)) : null,
      patchVersion: "live"
    };
    const res = await fetch(apiUrl(ACTIVE_API_BASE, "ml/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    if (line) {
      line.textContent = won
        ? "Feedback saved: marked as win. Your Crowns = crowns you took, Opponent Crowns = crowns they took."
        : "Feedback saved: marked as loss. Your Crowns = crowns you took, Opponent Crowns = crowns they took.";
    }
    await renderLearningStatus();
  } catch (err) {
    if (line) line.textContent = "Could not submit feedback right now.";
    statusEl.textContent = `Feedback error: ${err.message || "unknown error"}`;
  }
}

function normalizeOpponentArchetype(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "");
  if (OPP_ARCHETYPE_NORMALIZE.has(compact)) return OPP_ARCHETYPE_NORMALIZE.get(compact);
  const underscored = compact.replace(/\s+/g, "_");
  if (OPP_ARCHETYPE_NORMALIZE.has(underscored)) return OPP_ARCHETYPE_NORMALIZE.get(underscored);
  return "custom_offmeta";
}

async function analyzePayload(payload) {
  const res = await fetch(apiUrl(ACTIVE_API_BASE, "deck/synergy"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.title || data?.error || "Analysis request failed");
  return data;
}

function renderAllAnalysis(data) {
  const tower = TOWER_TROOPS.find((t) => t.id === (data.towerTroop || state.selectedTowerTroop));
  setText("towerLine", `${tower?.label || "Tower Princess"}`);
  setText("archetype", `${data.archetype} (${data.archetypeConfidence}% conf)`);
  setText("score", `${data.score}`);
  setText("avgElixir", `${Number(data.averageElixir).toFixed(1)}`);
  setText("winCons", `Win Conditions: ${(data.winConditions || []).join(" | ") || "None detected"}`);
  const fallbackSubScores = buildSubScoresFallback(data);
  const subs = data.subScores && Object.keys(data.subScores).length ? data.subScores : fallbackSubScores;
  renderList("subScoresList", objectToList(subs));
  renderList("towerImpactList", objectToList(data.towerImpact));
  renderMetricTiles("subscoreTiles", buildVisualMetrics(subs, { Offense: 35, Defense: 25, Spells: 25, Cycle: 20, Consistency: 25 }));
  renderMetricTiles("towerImpactTiles", buildVisualMetrics(data.towerImpact, {}, 10));
  renderSubscoreMiniChart(subs);
  renderTowerImpactMiniChart(data.towerImpact);
  renderList("strengthsList", data.strengths || []);
  renderList("weaknessesList", data.weaknesses || []);
  renderList("recommendationsList", data.recommendations || []);
  renderQuickRead(data);
  renderMlForecastVisual(data);
  if (data.mlForecast) {
    setText("mlForecastLine", `Predicted Win Rate: ${fmtPct(data.mlForecast.predictedWinRate)}% (confidence ${fmtPct(data.mlForecast.confidence, 0)}%).`);
    renderList("mlDriversList", data.mlForecast.topDrivers || []);
  } else {
    setText("mlForecastLine", "");
    renderList("mlDriversList", []);
  }
  const saneMlSuggestions = (data.mlSuggestions || []).filter((s) => Number(s.deltaWinRate) >= 1.0).slice(0, 3);
  renderList("mlSuggestionsList", saneMlSuggestions.length
    ? saneMlSuggestions.map((s) => `Slot ${s.slot}: ${s.outgoing} -> ${s.incoming} (Win Rate ${fmtPct(s.predictedWinRate)}%, +${fmtPct(s.deltaWinRate)}%)`)
    : ["No strong swap suggested. Deck already looks well-optimized in current model constraints."]
  );
  renderMlSuggestionsVisual(saneMlSuggestions);
  renderSwrVisual(data);
  renderChart(data.breakdown || {});
  renderRiskBars(data);
  renderBattleSnapshot(data);
  weaknessPanelEl?.classList.remove("hidden");
  runWeaknessProfile("anti_air");
}

function renderQuickRead(data) {
  const arc = document.getElementById("scoreDialArc");
  const dialVal = document.getElementById("scoreDialValue");
  const verdict = document.getElementById("quickVerdict");
  const mlWinChip = document.getElementById("mlWinChip");
  const mlConfChip = document.getElementById("mlConfChip");
  const towerChip = document.getElementById("towerChip");
  const maxScore = 130;
  const r = 50;
  const c = 2 * Math.PI * r;

  if (!data) {
    if (arc) arc.style.strokeDashoffset = `${c}`;
    if (dialVal) dialVal.textContent = "-";
    if (verdict) verdict.textContent = "Build your deck and click Analyze to get a quick visual verdict.";
    if (mlWinChip) mlWinChip.textContent = "Win Rate: -";
    if (mlConfChip) mlConfChip.textContent = "Prediction Confidence: -";
    if (towerChip) towerChip.textContent = "Tower Fit: -";
    ["barOffense", "barDefense", "barSpells", "barCycle", "barConsistency"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.width = "0%";
    });
    return;
  }

  const score = Number(data.score || 0);
  const pct = Math.max(0, Math.min(1, score / maxScore));
  if (arc) arc.style.strokeDashoffset = `${c * (1 - pct)}`;
  if (dialVal) dialVal.textContent = `${Math.round(score)}`;

  const subs = data.subScores || {};
  const maxes = { Offense: 35, Defense: 25, Spells: 25, Cycle: 20, Consistency: 25 };
  const map = [
    ["barOffense", "Offense"],
    ["barDefense", "Defense"],
    ["barSpells", "Spells"],
    ["barCycle", "Cycle"],
    ["barConsistency", "Consistency"]
  ];
  map.forEach(([id, key]) => {
    const v = Number(subs[key] || 0);
    const max = maxes[key] || 20;
    const width = Math.max(0, Math.min(100, (v / max) * 100));
    const el = document.getElementById(id);
    if (el) el.style.width = `${width}%`;
  });

  const winRate = Number(data.mlForecast?.predictedWinRate || 0);
  const conf = Number(data.mlForecast?.confidence || 0);
  const towerImpactTotal = Object.values(data.towerImpact || {}).reduce((sum, v) => sum + Number(v || 0), 0);
  if (mlWinChip) mlWinChip.textContent = `Win Rate: ${winRate > 0 ? `${winRate}%` : "-"}`;
  if (mlConfChip) mlConfChip.textContent = `Prediction Confidence: ${conf > 0 ? `${conf}%` : "-"}`;
  if (towerChip) towerChip.textContent = `Tower Fit: ${towerImpactTotal >= 8 ? "Strong" : towerImpactTotal >= 3 ? "Neutral" : "Weak"}`;

  let tone = "Balanced";
  if (score >= 108) tone = "Meta-ready";
  else if (score >= 92) tone = "Competitive";
  else if (score >= 75) tone = "Playable";
  else tone = "Needs tuning";
  const archetype = data.archetype || "Unknown";
  const winCons = (data.winConditions || []).join(", ") || "No clear win condition";
  if (verdict) verdict.textContent = `${tone}: ${archetype} shell, ${winCons}. Use foldouts below for deep tuning details.`;
}

async function optimizeTowerTroop() {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Build 8-card deck first.";
  const cardIds = cards.map((c) => c.id);
  statusEl.textContent = "Comparing all tower troops...";

  const results = await Promise.all(TOWER_TROOPS.map(async (tower) => ({ tower, data: await analyzePayload({ cardIds, towerTroop: tower.id }) })));
  const ranked = results.map((r) => {
    const score = Number(r.data?.score || 0);
    const ml = Number(r.data?.mlForecast?.predictedWinRate || 0);
    const archetypeFit = Number(r.data?.archetypeConfidence || 0);
    const blended = Math.round((score * 0.52 + ml * 0.33 + archetypeFit * 0.15) * 10) / 10;
    return { id: r.tower.id, label: r.tower.label, score, ml, blended };
  }).sort((a, b) => b.blended - a.blended);
  renderTowerOptimizerVisual(ranked);
  renderList("towerOptimizerList", ranked.map((r, i) => `${i + 1}. ${r.label}: Composite ${r.blended} (Score ${r.score}, Forecast ${r.ml}%)`));
  const current = ranked.find((r) => r.id === state.selectedTowerTroop);
  const best = ranked[0];
  const keepCurrent = current && ((best.blended - current.blended) <= 1.5);
  const choice = keepCurrent ? current : best;
  setText(
    "towerOptimizerBest",
    keepCurrent
      ? `Current tower (${current.label}) is already within optimizer margin (Δ <= 1.5), keeping it.`
      : `Best tower troop: ${choice.label} (Blend ${choice.blended}).`
  );
  state.selectedTowerTroop = choice.id;
  renderTowerTroops();
  statusEl.textContent = "Tower optimization complete.";
}

async function runDeltaEngine() {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Build 8-card deck first.";

  const baseline = state.latestAnalysis || await analyzePayload({ cardIds: cards.map((c) => c.id), towerTroop: state.selectedTowerTroop });
  state.latestAnalysis = baseline;
  if (baseline.mlSuggestions && baseline.mlSuggestions.length > 0) {
    const validated = await validateMlSuggestions(cards, baseline);
    const top = validated.find((x) => Number(x.deltaWinRate) >= 1.0);
    if (!top) {
      setText("deltaSummary", "No high-confidence one-card upgrade found. Current deck structure is already strong.");
      renderSwapBoard([]);
      renderDeltaVisualStats([]);
      renderList("deltaBreakdown", [
        `Predicted Win Rate: ${fmtPct(baseline.mlForecast?.predictedWinRate)}%`,
        `Prediction confidence: ${fmtPct(baseline.mlForecast?.confidence, 0)}%`,
        "Try matchup simulator for matchup-specific improvements instead of structural swaps."
      ]);
      statusEl.textContent = "Suggested changes ready.";
      return null;
    }
    setText("deltaSummary", `Best smart swap: ${top.outgoing} -> ${top.incoming} (Slot ${top.slot}), +${fmtPct(top.deltaWinRate)}% predicted win rate.`);
    const bestThree = validated.filter((x) => Number(x.deltaWinRate) >= 1.0).slice(0, 3);
    renderSwapBoard(bestThree);
    renderDeltaVisualStats(bestThree);
    renderList("deltaBreakdown", [
      `Predicted Win Rate after swap: ${fmtPct(top.predictedWinRate)}%`,
      `Prediction confidence: ${fmtPct(baseline.mlForecast?.confidence, 0)}%`,
      `Structure-safe swaps prioritized (archetype stability + role coverage).`
    ]);
    statusEl.textContent = "Suggested changes ready.";
    return top;
  }

  const deckIds = cards.map((c) => c.id);
  const candidates = state.cards.filter((c) => !deckIds.includes(c.id)).slice(0, 32);
  let best = null;

  statusEl.textContent = "Running best swap search...";
  for (let slot = 0; slot < 8; slot += 1) {
    for (const incoming of candidates) {
      const next = [...deckIds];
      next[slot] = incoming.id;
      if (new Set(next).size !== 8) continue;
      try {
        const analyzed = await analyzePayload({ cardIds: next, towerTroop: state.selectedTowerTroop });
        const delta = analyzed.score - baseline.score;
        if (!best || delta > best.delta) best = { slot, outgoing: cards[slot], incoming, analyzed, delta };
      } catch {
      }
    }
  }

  if (!best) {
    setText("deltaSummary", "No better one-card swap found in sampled candidates.");
    renderSwapBoard([]);
    renderDeltaVisualStats([]);
    renderList("deltaBreakdown", []);
    return null;
  }

  setText("deltaSummary", `Best swap: ${best.outgoing.name} -> ${best.incoming.name} (Slot ${best.slot + 1}). ${baseline.score} -> ${best.analyzed.score} (${best.delta >= 0 ? "+" : ""}${fmtPct(best.delta)}).`);
  renderSwapBoard([
    {
      slot: best.slot + 1,
      outgoing: best.outgoing.name,
      incoming: best.incoming.name,
      predictedWinRate: Number(best.analyzed.mlForecast?.predictedWinRate || baseline.mlForecast?.predictedWinRate || 0),
      deltaWinRate: Number(best.delta)
    }
  ]);
  renderDeltaVisualStats([
    {
      predictedWinRate: Number(best.analyzed.mlForecast?.predictedWinRate || baseline.mlForecast?.predictedWinRate || 0),
      deltaWinRate: Number(best.delta),
      qualityScore: Number(best.delta)
    }
  ]);
  renderList("deltaBreakdown", [
    `Archetype: ${baseline.archetype} -> ${best.analyzed.archetype}`,
    `Average Elixir Cost: ${Number(baseline.averageElixir).toFixed(1)} -> ${Number(best.analyzed.averageElixir).toFixed(1)}`,
    `Win Conditions: ${(best.analyzed.winConditions || []).join(", ") || "None"}`
  ]);
  statusEl.textContent = "Suggested changes ready.";
  return best;
}

function runWeaknessProfile(profile) {
  const data = state.latestAnalysis;
  if (!data) return statusEl.textContent = "Run Analyze Deck first.";
  const b = data.breakdown || {};
  const lines = [];
  if (profile === "anti_air") {
    if ((b["Air Defense"] || 0) <= 6) lines.push("Air defense is low; add at least one more ranged anti-air card.");
    else lines.push("Air defense is stable. Keep at least 3 reliable anti-air answers.");
    if ((b["Reset Access"] || 0) <= 3) lines.push("Reset access is weak; add Zap/Electro utility vs Inferno threats.");
  }
  if (profile === "anti_swarm") {
    if ((b["Swarm Control"] || 0) <= 4) lines.push("Swarm control is weak; add one more splash unit or light spell.");
    else lines.push("Swarm control is healthy; avoid replacing both splash and light-spell together.");
    if ((b["Spell Count"] || 0) <= 3) lines.push("Spell count is low; add a cheap spell for cycle swarm control.");
  }
  if (profile === "anti_beatdown") {
    if ((b["Building Coverage"] || 0) <= 4) lines.push("No strong building anchor detected; add Cannon/Tesla/Inferno Tower.");
    else lines.push("Building/spawner anchor detected; preserve it against beatdown archetypes.");
    if ((b["Frontline Presence"] || 0) <= 3) lines.push("Frontline pressure is low; add a sturdier tank or mini-tank.");
    if ((b["Reset Access"] || 0) <= 3) lines.push("Add reset utility to improve heavy-push defense consistency.");
  }
  renderList("weaknessProfileList", [...lines, ...(data.weaknesses || []).slice(0, 2)]);
  statusEl.textContent = "Weakness profile ready.";
}

function renderSwapBoard(suggestions) {
  const root = document.getElementById("swapBoard");
  if (!root) return;
  root.innerHTML = "";
  if (!Array.isArray(suggestions) || suggestions.length === 0) return;
  suggestions.forEach((s) => {
    const delta = Number(s.deltaWinRate || 0);
    const card = document.createElement("div");
    card.className = "swap-card";
    const head = document.createElement("div");
    head.className = "swap-head";
    const label = document.createElement("span");
    label.textContent = `Slot ${s.slot}: ${s.outgoing} -> ${s.incoming}`;
    const right = document.createElement("span");
    right.className = "swap-delta";
    right.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
    head.appendChild(label);
    head.appendChild(right);
    const meter = document.createElement("div");
    meter.className = "swap-meter";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(0, Math.min(100, (Math.abs(delta) / 10) * 100))}%`;
    meter.appendChild(fill);
    card.appendChild(head);
    card.appendChild(meter);
    root.appendChild(card);
  });
}

function renderTowerOptimizerVisual(ranked) {
  const root = document.getElementById("towerOptimizerVisual");
  if (!root) return;
  root.innerHTML = "";
  const safeRanked = (ranked || []).slice(0, 4);
  if (safeRanked.length === 0) {
    const placeholder = document.createElement("article");
    placeholder.className = "insight-card";
    placeholder.innerHTML = `
      <h4>No Tower Comparison Yet</h4>
      <p>Click <strong>Optimize Tower Troop</strong> after Analyze to generate tower matchup spread visuals.</p>
    `;
    root.appendChild(placeholder);
    return;
  }
  safeRanked.forEach((r, i) => {
    const card = document.createElement("article");
    card.className = "insight-card";
    card.innerHTML = `
      <h4>${i === 0 ? "Best Tower" : `Option ${i + 1}`}</h4>
      <p>${r.label}</p>
      <div class="swap-meter"><i style="width:${Math.max(0, Math.min(100, r.blended))}%;"></i></div>
      <div class="chip-row">
        <span class="chip">Blend ${r.blended}</span>
        <span class="chip">Score ${r.score}</span>
        <span class="chip">Forecast ${r.ml}%</span>
      </div>
    `;
    root.appendChild(card);
  });
}

function renderDeltaVisualStats(suggestions) {
  const root = document.getElementById("deltaVisualStats");
  if (!root) return;
  root.innerHTML = "";
  if (!Array.isArray(suggestions) || suggestions.length === 0) return;
  const top = suggestions[0];
  const avgGain = suggestions.reduce((a, s) => a + Number(s.deltaWinRate || 0), 0) / suggestions.length;
  const chips = [
    `Top Gain +${Number(top.deltaWinRate || 0).toFixed(1)}%`,
    `Pred Win ${Number(top.predictedWinRate || 0).toFixed(1)}%`,
    `Avg Gain +${avgGain.toFixed(1)}%`
  ];
  chips.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;
    root.appendChild(chip);
  });
}

function renderMlSuggestionsVisual(suggestions) {
  const root = document.getElementById("mlSuggestionsVisual");
  if (!root) return;
  root.innerHTML = "";
  if (!Array.isArray(suggestions) || suggestions.length === 0) return;
  suggestions.forEach((s) => {
    const delta = Number(s.deltaWinRate || 0);
    const card = document.createElement("article");
    card.className = "swap-card";
    card.innerHTML = `
      <div class="swap-head">
        <span>Slot ${s.slot}: ${s.outgoing} -> ${s.incoming}</span>
        <span class="swap-delta">${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%</span>
      </div>
      <div class="swap-meter"><i style="width:${Math.max(0, Math.min(100, (Math.abs(delta) / 10) * 100))}%;"></i></div>
    `;
    root.appendChild(card);
  });
}

function renderPatchDriftVisual(drift, level) {
  const root = document.getElementById("patchDriftVisual");
  if (!root) return;
  root.innerHTML = "";
  const items = [
    { title: "Current Risk", text: `${level} (${drift})` },
    { title: "Primary Action", text: "Re-run Tower Optimizer after balance patches." },
    { title: "Backup Plan", text: "Keep 2 tested swaps for bad matchups." }
  ];
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "insight-card";
    card.innerHTML = `<h4>${item.title}</h4><p>${item.text}</p>`;
    root.appendChild(card);
  });
}

function renderSwrVisual(data) {
  const root = document.getElementById("swrVisual");
  if (!root) return;
  root.innerHTML = "";
  const blocks = [
    { title: "Strengths", items: data?.strengths || [], klass: "good" },
    { title: "Weaknesses", items: data?.weaknesses || [], klass: "warn" },
    { title: "Action Plan", items: data?.recommendations || [], klass: "plan" }
  ];
  blocks.forEach((b) => {
    const card = document.createElement("article");
    card.className = `swr-card ${b.klass}`;
    const topThree = b.items.slice(0, 3);
    card.innerHTML = `
      <h4>${b.title}</h4>
      <ul>${topThree.map((x) => `<li>${x}</li>`).join("") || "<li>No data yet.</li>"}</ul>
    `;
    root.appendChild(card);
  });
}

async function validateMlSuggestions(cards, baseline) {
  const suggestions = (baseline.mlSuggestions || []).filter((x) => Number(x.deltaWinRate) >= 0.5).slice(0, 8);
  const validated = [];
  for (const s of suggestions) {
    const slot = Math.max(0, Number(s.slot) - 1);
    const incomingCard = findCardByName(s.incoming);
    if (!incomingCard || slot < 0 || slot > 7) continue;
    const deck = cards.map((c) => c.id);
    deck[slot] = incomingCard.id;
    if (new Set(deck).size !== 8) continue;
    try {
      const analyzed = await analyzePayload({ cardIds: deck, towerTroop: state.selectedTowerTroop });
      const qualityScore = computeSwapQuality(baseline, analyzed);
      validated.push({
        ...s,
        predictedWinRate: Number(analyzed.mlForecast?.predictedWinRate || s.predictedWinRate || 0),
        deltaWinRate: Number(analyzed.mlForecast?.predictedWinRate || 0) - Number(baseline.mlForecast?.predictedWinRate || 0),
        qualityScore
      });
    } catch {
      continue;
    }
  }
  return validated.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
}

function computeSwapQuality(base, next) {
  const baseSubs = base?.subScores || {};
  const nextSubs = next?.subScores || {};
  const gainOff = Number(nextSubs.Offense || 0) - Number(baseSubs.Offense || 0);
  const gainDef = Number(nextSubs.Defense || 0) - Number(baseSubs.Defense || 0);
  const gainSpell = Number(nextSubs.Spells || 0) - Number(baseSubs.Spells || 0);
  const gainCycle = Number(nextSubs.Cycle || 0) - Number(baseSubs.Cycle || 0);
  const gainCons = Number(nextSubs.Consistency || 0) - Number(baseSubs.Consistency || 0);
  const baseWin = Number(base?.mlForecast?.predictedWinRate || 0);
  const nextWin = Number(next?.mlForecast?.predictedWinRate || 0);
  const winGain = nextWin - baseWin;
  const archetypePenalty = base?.archetype !== next?.archetype ? 1.2 : 0;
  const baseWinCons = (base?.winConditions || []).length;
  const nextWinCons = (next?.winConditions || []).length;
  const winConPenalty = nextWinCons < baseWinCons ? (baseWinCons - nextWinCons) * 1.4 : 0;
  const weighted = winGain * 2.6 + gainDef * 0.9 + gainCons * 0.8 + gainOff * 0.6 + gainSpell * 0.6 + gainCycle * 0.5;
  return Number((weighted - archetypePenalty - winConPenalty).toFixed(2));
}

function findCardByName(name) {
  if (!name) return null;
  const cleaned = String(name).trim().toLowerCase();
  return state.cards.find((c) => c.name.toLowerCase() === cleaned) || null;
}

function renderRiskBars(data) {
  const b = data?.breakdown || {};
  const air = Math.max(0, Math.min(100, 100 - (Number(b["Air Defense"] || 0) / 12) * 100));
  const swarm = Math.max(0, Math.min(100, 100 - ((Number(b["Swarm Control"] || 0) + Number(b["Spell Count"] || 0)) / 16) * 100));
  const beatdown = Math.max(0, Math.min(100, 100 - ((Number(b["Building Coverage"] || 0) + Number(b["Frontline Presence"] || 0)) / 18) * 100));
  setRisk("riskAir", "riskAirLabel", air);
  setRisk("riskSwarm", "riskSwarmLabel", swarm);
  setRisk("riskBeatdown", "riskBeatdownLabel", beatdown);
}

function setRisk(barId, labelId, value) {
  const bar = document.getElementById(barId);
  const label = document.getElementById(labelId);
  if (bar) bar.style.width = `${value}%`;
  if (label) label.textContent = value >= 70 ? "High Risk" : value >= 40 ? "Medium Risk" : "Low Risk";
}

function buildVisualMetrics(obj, maxMap = {}, defaultMax = 35) {
  return Object.entries(obj || {}).map(([k, v]) => {
    const num = Number(v || 0);
    const max = Number(maxMap[k] || defaultMax || 1);
    return {
      name: k,
      value: num,
      pct: Math.max(0, Math.min(100, (num / max) * 100))
    };
  });
}

function buildSubScoresFallback(data) {
  const b = data?.breakdown || {};
  return {
    Offense: Number(b["Win Condition Clarity"] || 0) + Number(b["Support Package"] || 0),
    Defense: Number(b["Air Defense"] || 0) + Number(b["Building Coverage"] || 0) + Number(b["Swarm Control"] || 0),
    Spells: Number(b["Spell Count"] || 0) + Number(b["Spell Balance"] || 0) + Number(b["Reset Access"] || 0),
    Cycle: Number(b["Cycle Speed"] || 0) + Number(b["Cheap Cycle Support"] || 0),
    Consistency: Number(b["Elixir Balance"] || 0) + Number(b["Frontline Presence"] || 0) + Number(b["Card Uniqueness"] || 0)
  };
}

function renderMetricTiles(targetId, metrics) {
  const root = document.getElementById(targetId);
  if (!root) return;
  root.innerHTML = "";
  if (!Array.isArray(metrics) || metrics.length === 0) {
    ["Pending 1", "Pending 2", "Pending 3"].forEach((name) => {
      const item = document.createElement("article");
      item.className = "metric-tile-visual";
      item.innerHTML = `
        <div class="name">${name}</div>
        <div class="value">-</div>
        <div class="mini-bar"><i style="width:0%;"></i></div>
      `;
      root.appendChild(item);
    });
    return;
  }
  metrics.forEach((m) => {
    const item = document.createElement("article");
    item.className = "metric-tile-visual";
    item.innerHTML = `
      <div class="name">${m.name}</div>
      <div class="value">${m.value}</div>
      <div class="mini-bar"><i style="width:${m.pct}%;"></i></div>
    `;
    root.appendChild(item);
  });
}

function renderMlForecastVisual(data) {
  const root = document.getElementById("mlForecastVisual");
  if (!root) return;
  root.innerHTML = "";
  if (!data?.mlForecast) return;
  const wr = Number(data.mlForecast.predictedWinRate || 0).toFixed(1);
  const conf = Number(data.mlForecast.confidence || 0);
  const sugg = (data.mlSuggestions || []).filter((s) => Number(s.deltaWinRate) > 0).length;
  const metaSim = Math.round((Number(data.metaSignals?.maxSimilarity || 0)) * 100);
  const cards = [
    { label: "Predicted Win Rate", main: `${wr}%` },
    { label: "Prediction Confidence", main: `${conf}%` },
    { label: "Viable Swap Options", main: `${sugg}` },
    { label: "Meta Similarity", main: `${metaSim}%` }
  ];
  cards.forEach((c) => {
    const node = document.createElement("article");
    node.className = "ml-forecast-card";
    node.innerHTML = `<div class="label">${c.label}</div><div class="main">${c.main}</div>`;
    root.appendChild(node);
  });
}

function setPatchDriftMeter(pct) {
  const meter = document.getElementById("patchDriftMeter");
  if (meter) meter.style.width = `${Math.max(0, Math.min(100, Number(pct) || 0))}%`;
}

function renderPatchDrift(data) {
  const drift = Math.max(0, Math.round(((data.archetypeConfidence || 0) - (data.score || 0)) * 0.6));
  const level = drift >= 8 ? "High" : drift >= 4 ? "Medium" : "Low";
  setText("patchDriftLine", `Patch Drift Risk: ${level} (${drift}).`);
  setPatchDriftMeter(Math.max(0, Math.min(100, drift * 10)));
  renderPatchDriftVisual(drift, level);
  renderList("patchDriftList", [
    "Re-run Tower Optimizer after each patch.",
    "Use Delta Engine for low-risk one-card tune-ups.",
    "Keep 2 backup swaps for your worst matchup archetype."
  ]);
}

function renderBattleSnapshot(data) {
  const arc = document.getElementById("winRateArc");
  const snapWin = document.getElementById("snapWinrate");
  const snapArc = document.getElementById("snapArchetype");
  const snapTower = document.getElementById("snapTower");
  const snapPace = document.getElementById("snapDeckPace");
  const snapRisk = document.getElementById("snapRiskTag");
  const insightRoot = document.getElementById("insightCards");
  const radius = 46;
  const circ = 2 * Math.PI * radius;

  if (!data) {
    if (arc) arc.style.strokeDashoffset = `${circ}`;
    if (snapWin) snapWin.textContent = "-";
    if (snapArc) snapArc.textContent = "Archetype: -";
    if (snapTower) snapTower.textContent = "Tower: -";
    if (snapPace) snapPace.textContent = "Pace: -";
    if (snapRisk) snapRisk.textContent = "Risk: -";
    if (insightRoot) insightRoot.innerHTML = "";
    if (radarChartInstance) {
      radarChartInstance.destroy();
      radarChartInstance = null;
    }
    return;
  }

  const winRate = Number(data.mlForecast?.predictedWinRate || 0);
  const scorePct = Math.max(0, Math.min(1, winRate / 100));
  if (arc) arc.style.strokeDashoffset = `${circ * (1 - scorePct)}`;
  if (snapWin) snapWin.textContent = `${winRate.toFixed(1)}%`;
  if (snapArc) snapArc.textContent = `Archetype: ${data.archetype || "-"}`;
  if (snapTower) snapTower.textContent = `Tower: ${labelTower(data.towerTroop || state.selectedTowerTroop)}`;
  const avg = Number(data.averageElixir || 0);
  const pace = avg <= 3.0 ? "Fast" : avg <= 3.8 ? "Balanced" : "Heavy";
  if (snapPace) snapPace.textContent = `Pace: ${pace}`;

  const b = data.breakdown || {};
  const riskValue = Math.max(
    Math.max(0, Math.min(100, 100 - (Number(b["Air Defense"] || 0) / 12) * 100)),
    Math.max(0, Math.min(100, 100 - ((Number(b["Swarm Control"] || 0) + Number(b["Spell Count"] || 0)) / 16) * 100)),
    Math.max(0, Math.min(100, 100 - ((Number(b["Building Coverage"] || 0) + Number(b["Frontline Presence"] || 0)) / 18) * 100))
  );
  if (snapRisk) snapRisk.textContent = `Risk: ${riskValue >= 70 ? "High" : riskValue >= 40 ? "Medium" : "Low"}`;

  renderRadarChart(data.subScores || {});
  renderInsightCards(data);
}

function renderRadarChart(subScores) {
  const ctx = document.getElementById("radarChart")?.getContext("2d");
  if (!ctx) return;
  const labels = ["Offense", "Defense", "Spells", "Cycle", "Consistency"];
  const values = labels.map((k) => Number(subScores[k] || 0));
  if (radarChartInstance) radarChartInstance.destroy();
  radarChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Deck Profile",
        data: values,
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34,211,238,0.18)",
        pointBackgroundColor: "#f59e0b",
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 35,
          ticks: { display: false },
          pointLabels: { color: "#c7d7f2", font: { size: 11 } },
          grid: { color: "rgba(148,163,184,.25)" },
          angleLines: { color: "rgba(148,163,184,.2)" }
        }
      }
    }
  });
}

function renderInsightCards(data) {
  const root = document.getElementById("insightCards");
  if (!root) return;
  const strength = (data.strengths || [])[0] || "No major strength detected yet.";
  const weakness = (data.weaknesses || [])[0] || "No major weakness detected.";
  const recommendation = (data.recommendations || [])[0] || "No recommendation.";
  root.innerHTML = "";
  [
    { title: "Strong Point", body: strength, cls: "good" },
    { title: "Biggest Risk", body: weakness, cls: "bad" },
    { title: "Best Next Move", body: recommendation, cls: "warn" }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = `insight-card ${item.cls}`;
    card.innerHTML = `<h4>${item.title}</h4><p>${item.body}</p>`;
    root.appendChild(card);
  });
}

async function runMatchupSim() {
  const idx = Number(simDeckSelect.value || 0);
  const preset = META_PRESETS[idx];
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Build your full deck first.";
  const presetCardIds = resolvePresetCardIds(preset);
  if (!presetCardIds || presetCardIds.length !== 8) return statusEl.textContent = `Preset "${preset.name}" is not available in current card data yet.`;

  statusEl.textContent = "Running matchup simulator...";
  try {
    const [yourDeck, enemyDeck] = await Promise.all([
      analyzePayload({ cardIds: cards.map((c) => c.id), towerTroop: state.selectedTowerTroop }),
      analyzePayload({ cardIds: presetCardIds, towerTroop: preset.towerTroop })
    ]);

    const scoreDelta = yourDeck.score - enemyDeck.score;
    const winChance = Math.max(15, Math.min(85, 50 + Math.round(scoreDelta * 1.2)));

    setText("simSummary", `Vs ${preset.name}: estimated win chance ${winChance}% (${yourDeck.score} vs ${enemyDeck.score}).`);
    renderList("simDetails", [
      `Your archetype: ${yourDeck.archetype} | Opponent archetype: ${enemyDeck.archetype}`,
      `Your tower: ${labelTower(yourDeck.towerTroop)} | Opp tower: ${labelTower(enemyDeck.towerTroop)}`,
      `Plan: ${(scoreDelta >= 0) ? "pressure and convert tempo leads" : "play defensive, win on counterpush windows"}`
    ]);

    statusEl.textContent = "Matchup simulation complete.";
  } catch (err) {
    statusEl.textContent = `Simulator error: ${err.message}`;
  }
}

function saveRevision() {
  const cards = state.deck.filter(Boolean);
  if (!state.latestAnalysis || cards.length !== 8) return statusEl.textContent = "Analyze a full deck before saving revision.";

  const rev = {
    at: new Date().toISOString(),
    towerTroop: state.selectedTowerTroop,
    cardIds: cards.map((c) => c.id),
    cardNames: cards.map((c) => c.name),
    score: state.latestAnalysis.score,
    archetype: state.latestAnalysis.archetype
  };

  state.revisions.unshift(rev);
  state.revisions = state.revisions.slice(0, 20);
  localStorage.setItem(REV_KEY, JSON.stringify(state.revisions));
  renderRevisionList();
  statusEl.textContent = "Revision saved.";
}

function loadRevisions() {
  try {
    state.revisions = JSON.parse(localStorage.getItem(REV_KEY) || "[]");
  } catch {
    state.revisions = [];
  }
}

function renderRevisionList() {
  const lines = state.revisions.map((r, i) => `${i + 1}. ${new Date(r.at).toLocaleString()} | ${r.score} | ${r.archetype} | ${labelTower(r.towerTroop)}`);
  renderList("revisionList", lines);
}

function exportSnapshot() {
  const cards = state.deck.filter(Boolean);
  if (!state.latestAnalysis || cards.length !== 8) return statusEl.textContent = "Analyze a full deck before export.";

  const payload = {
    exportedAt: new Date().toISOString(),
    towerTroop: state.selectedTowerTroop,
    cards: cards.map((c) => ({ id: c.id, name: c.name })),
    analysis: state.latestAnalysis
  };

  navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    .then(() => { statusEl.textContent = "Snapshot copied to clipboard."; })
    .catch(() => { statusEl.textContent = "Could not copy snapshot."; });
}

function labelTower(id) {
  return TOWER_TROOPS.find((t) => t.id === id)?.label || "Tower Princess";
}

function renderList(elementId, items) {
  const ul = document.getElementById(elementId);
  if (!ul) return;
  ul.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "list-empty";
    li.textContent = "None";
    ul.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list-pill";
    li.textContent = item;
    ul.appendChild(li);
  });
}

function objectToList(obj) { return Object.entries(obj || {}).map(([k, v]) => `${k}: ${v}`); }

function renderChart(breakdown) {
  const labels = Object.keys(breakdown || {});
  const values = Object.values(breakdown || {});
  const ctx = document.getElementById("synergyChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Breakdown",
        data: values,
        borderRadius: 8,
        borderSkipped: false,
        backgroundColor: [
          "#38bdf8",
          "#22d3ee",
          "#60a5fa",
          "#818cf8",
          "#a78bfa",
          "#34d399",
          "#f59e0b",
          "#fb7185"
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.1,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: "#cfe6ff", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(59, 130, 246, 0.12)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#cfe6ff" },
          grid: { color: "rgba(59, 130, 246, 0.15)" }
        }
      }
    }
  });
}

function renderSubscoreMiniChart(subScores) {
  const ctx = document.getElementById("subscoreMiniChart")?.getContext("2d");
  if (!ctx) return;
  const labels = ["Offense", "Defense", "Spells", "Cycle", "Consistency"];
  const hasData = !!subScores && labels.some((k) => Number(subScores[k] || 0) > 0);
  const values = hasData ? labels.map((k) => Number(subScores[k] || 0)) : [14, 10, 9, 8, 11];
  if (subscoreMiniChartInstance) subscoreMiniChartInstance.destroy();
  subscoreMiniChartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Subscores",
        data: values,
        fill: true,
        borderWidth: 2,
        borderColor: hasData ? "#22d3ee" : "rgba(148, 163, 184, 0.8)",
        backgroundColor: hasData ? "rgba(34, 211, 238, 0.22)" : "rgba(148, 163, 184, 0.16)",
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBackgroundColor: hasData ? "#7dd3fc" : "#94a3b8"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 35,
          angleLines: { color: "rgba(148, 163, 184, 0.22)" },
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          pointLabels: { color: "#cfe6ff", font: { size: 11 } },
          ticks: {
            display: false,
            backdropColor: "transparent"
          }
        }
      }
    }
  });
}

function renderTowerImpactMiniChart(towerImpact) {
  const ctx = document.getElementById("towerImpactMiniChart")?.getContext("2d");
  if (!ctx) return;
  const fallback = [
    ["Pressure", 2],
    ["Defense", 3],
    ["Cycle", 2],
    ["Spell Sync", 2]
  ];
  const entries = Object.entries(towerImpact || {}).filter(([, v]) => Number.isFinite(Number(v)));
  const hasData = entries.length > 0;
  const source = hasData ? entries.slice(0, 6) : fallback;
  const labels = source.map(([k]) => k);
  const values = source.map(([, v]) => Number(v || 0));
  if (towerImpactMiniChartInstance) towerImpactMiniChartInstance.destroy();
  towerImpactMiniChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        borderRadius: 7,
        borderSkipped: false,
        backgroundColor: hasData
          ? ["#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#34d399"]
          : "rgba(148, 163, 184, 0.45)"
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: 10,
          ticks: { color: "#cfe6ff" },
          grid: { color: "rgba(59, 130, 246, 0.15)" }
        },
        y: {
          ticks: { color: "#cfe6ff" },
          grid: { display: false }
        }
      }
    }
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function resolvePresetCardIds(preset) {
  if (!preset) return null;
  const validFromIds = Array.isArray(preset.cards) && preset.cards.length === 8
    ? preset.cards.filter((id) => state.cards.some((c) => c.id === id))
    : [];
  if (validFromIds.length === 8) return validFromIds;

  if (!Array.isArray(preset.cardNames) || preset.cardNames.length !== 8) return null;
  const ids = preset.cardNames
    .map((name) => state.cards.find((c) => c.name.toLowerCase() === String(name).toLowerCase())?.id)
    .filter(Boolean);
  return ids.length === 8 ? ids : null;
}

function renderBuilderMetrics() {
  const cards = state.deck.filter(Boolean);
  const count = cards.length;
  const avg = count ? (cards.reduce((sum, c) => sum + (Number(c.elixirCost) || 0), 0) / count) : 0;
  const pace = avg === 0 ? "Not Ready" : avg <= 3 ? "Fast Cycle" : avg <= 4 ? "Balanced" : "Heavy Beatdown";

  setText("liveDeckCount", `${count} / 8`);
  setText("liveAvgElixir", avg.toFixed(1));
  setText("livePace", pace);
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}


