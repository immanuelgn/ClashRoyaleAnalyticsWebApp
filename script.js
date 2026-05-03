let chartInstance = null;
let ACTIVE_API_BASE = window.__CR_API_BASE__ || "http://127.0.0.1:7295";
const ASSET_VARIANT_BASE = "https://raw.githubusercontent.com/RoyaleAPI/cr-api-assets/master/cards/";
const REV_KEY = "cr_deck_revisions_v1";
const SELECT_GUARD_MS = 140;

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

const HERO_ART_OVERRIDES = {
  "Balloon": [
    "/assets/hero/balloon-hero-cover.png",
    "assets/hero/balloon-hero-cover.png"
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
  tower_princess: buildTowerIconDataUri("TP", "#7c3aed", "#4338ca"),
  royal_chef: buildTowerIconDataUri("RC", "#f59e0b", "#b45309"),
  cannoneer: buildTowerIconDataUri("CN", "#0ea5e9", "#0369a1"),
  dagger_duchess: buildTowerIconDataUri("DD", "#10b981", "#047857")
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

const deckSlotsEl = document.getElementById("deckSlots");
const towerTroopsEl = document.getElementById("towerTroops");
const cardPoolEl = document.getElementById("cardPool");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("searchInput");
const simDeckSelect = document.getElementById("simDeckSelect");

document.getElementById("analyzeBtn").addEventListener("click", analyzeDeck);
document.getElementById("optimizeTowerBtn").addEventListener("click", optimizeTowerTroop);
document.getElementById("clearBtn").addEventListener("click", clearDeck);
document.getElementById("simRunBtn").addEventListener("click", runMatchupSim);
document.getElementById("saveRevisionBtn").addEventListener("click", saveRevision);
document.getElementById("exportRevisionBtn").addEventListener("click", exportSnapshot);
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
    const isHero = HERO_CARD_SLUGS.has(slug) || isChampion;
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
  ["towerOptimizerList", "deltaBreakdown", "weaknessProfileList", "patchDriftList", "simDetails"].forEach((id) => renderList(id, []));
  ["towerOptimizerBest", "deltaSummary", "patchDriftLine", "simSummary"].forEach((id) => setText(id, ""));
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
  const canToggleWildMode = slotRuleType === "wild" && showRemove && isEvolutionCard(card) && isHeroOrChampion(card);
  const currentWildMode = canToggleWildMode ? getWildModeForCard(slotIndex, card) : "";
  chip.innerHTML = `
    ${isPoolCard ? "" : `<span class="variant-pill">${slotLabel}</span>`}
    ${slotType ? getSlotBadge(slotType) : ""}
    <div class="card-img-wrap">
      <img class="card-img" src="${image || card.iconUrls?.medium || ""}" data-fallbacks="${fallbackData}" data-fallback-index="0" onerror="window.__crNextImageFallback && window.__crNextImageFallback(this)" alt="${escapeHtml(card.name)}" loading="lazy" />
    </div>
    <div class="name">${card.name}${isPoolCard ? getPoolSpecialSuffix(card) : ""}</div>
    <div class="meta">${card.elixirCost} Elixir</div>
    ${slotType ? `<div class="mode-line ${slotType}">${getModeLabel(slotType, slotRuleType)}</div>` : ""}
    ${canToggleWildMode ? `<div class="mode-switch"><button type="button" class="mode-opt ${currentWildMode === "evo" ? "active" : ""}" data-mode="evo">EVO</button><button type="button" class="mode-opt ${currentWildMode === "hero" ? "active" : ""}" data-mode="hero">HERO</button></div>` : ""}
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
    for (const url of (HERO_ART_OVERRIDES[card.name] || [])) push(url);
    push(`${ASSET_VARIANT_BASE}${slug}-hero.png`);
    push(card.heroIconUrl);
    push(base);
    return list;
  }
  if (slotType === "wild") {
    const wildMode = getWildModeForCard(slotIndex, card);
    if (wildMode === "hero") {
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
  const hero = !!(card.isHero || card.isChampion);
  if (evo && hero) return " /EVO/HERO";
  if (evo) return " /EVO";
  if (hero) return " /HERO";
  return "";
}

function toCardSlug(name) {
  return name.toLowerCase().replaceAll(".", "").replaceAll("'", "").replaceAll("&", "and").replaceAll(" ", "-").replaceAll("--", "-");
}

function buildTowerIconDataUri(text, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c2}'/>
    </linearGradient></defs>
    <rect x='4' y='4' width='72' height='72' rx='16' fill='url(#g)'/>
    <rect x='10' y='10' width='60' height='60' rx='12' fill='rgba(8,15,35,0.35)'/>
    <text x='40' y='49' font-family='Segoe UI,Arial,sans-serif' font-size='24' font-weight='800' text-anchor='middle' fill='white'>${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

function getModeLabel(slotType, slotRuleType) {
  if (slotRuleType === "wild") return slotType === "hero" ? "WILD-HERO MODE" : "WILD-EVO MODE";
  if (slotType === "evo") return "EVO MODE";
  if (slotType === "hero") return "HERO MODE";
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

function removeCardFromSlot(index) { state.deck[index] = null; renderSlots(); renderCardPool(); }

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
  const preferred = state.wildSlotModes[slotIndex];
  if (preferred === "evo" || preferred === "hero") return preferred;
  if (isHeroOrChampion(card)) return "hero";
  return "evo";
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
    statusEl.textContent = "Analyzing suggested changes...";
    await runDeltaEngine();
    renderPatchDrift(data);
    statusEl.textContent = "Analysis complete.";
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
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
  renderList("subScoresList", objectToList(data.subScores));
  renderList("towerImpactList", objectToList(data.towerImpact));
  renderList("strengthsList", data.strengths || []);
  renderList("weaknessesList", data.weaknesses || []);
  renderList("recommendationsList", data.recommendations || []);
  renderChart(data.breakdown || {});
}

async function optimizeTowerTroop() {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Build 8-card deck first.";
  const cardIds = cards.map((c) => c.id);
  statusEl.textContent = "Comparing all tower troops...";

  const results = await Promise.all(TOWER_TROOPS.map(async (tower) => ({ tower, data: await analyzePayload({ cardIds, towerTroop: tower.id }) })));
  const ranked = results.map((r) => ({ id: r.tower.id, label: r.tower.label, score: r.data.score })).sort((a, b) => b.score - a.score);
  renderList("towerOptimizerList", ranked.map((r, i) => `${i + 1}. ${r.label}: ${r.score}`));
  setText("towerOptimizerBest", `Best tower troop: ${ranked[0].label} (${ranked[0].score}).`);
  state.selectedTowerTroop = ranked[0].id;
  renderTowerTroops();
  statusEl.textContent = "Tower optimization complete.";
}

async function runDeltaEngine() {
  const cards = state.deck.filter(Boolean);
  if (cards.length !== 8) return statusEl.textContent = "Build 8-card deck first.";

  const baseline = state.latestAnalysis || await analyzePayload({ cardIds: cards.map((c) => c.id), towerTroop: state.selectedTowerTroop });
  state.latestAnalysis = baseline;

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
    renderList("deltaBreakdown", []);
    return null;
  }

  setText("deltaSummary", `Best swap: ${best.outgoing.name} -> ${best.incoming.name} (Slot ${best.slot + 1}). ${baseline.score} -> ${best.analyzed.score} (${best.delta >= 0 ? "+" : ""}${best.delta}).`);
  renderList("deltaBreakdown", [
    `Archetype: ${baseline.archetype} -> ${best.analyzed.archetype}`,
    `Average Elixer Cost: ${Number(baseline.averageElixir).toFixed(1)} -> ${Number(best.analyzed.averageElixir).toFixed(1)}`,
    `Win Conditions: ${(best.analyzed.winConditions || []).join(", ") || "None"}`
  ]);
  statusEl.textContent = "Suggested changes ready.";
  return best;
}

function runWeaknessProfile(profile) {
  const data = state.latestAnalysis;
  if (!data) return statusEl.textContent = "Run Analyze Deck first.";
  const tips = [];
  if (profile === "anti_air") tips.push("Add +1 anti-air support card.", "Prefer tower troop with stable air coverage.");
  if (profile === "anti_swarm") tips.push("Keep one light spell + one splash card.", "Avoid all single-target support stacks.");
  if (profile === "anti_beatdown") tips.push("Use one building + one reset source.", "Keep enough DPS in backline support.");
  renderList("weaknessProfileList", [...tips, ...(data.weaknesses || []).slice(0, 3)]);
  statusEl.textContent = "Weakness profile ready.";
}

function renderPatchDrift(data) {
  const drift = Math.max(0, Math.round(((data.archetypeConfidence || 0) - (data.score || 0)) * 0.6));
  const level = drift >= 8 ? "High" : drift >= 4 ? "Medium" : "Low";
  setText("patchDriftLine", `Patch Drift Risk: ${level} (${drift}).`);
  renderList("patchDriftList", [
    "Re-run Tower Optimizer after each patch.",
    "Use Delta Engine for low-risk one-card tune-ups.",
    "Keep 2 backup swaps for your worst matchup archetype."
  ]);
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
  const labels = Object.keys(breakdown);
  const values = Object.values(breakdown);
  const ctx = document.getElementById("synergyChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Breakdown", data: values, backgroundColor: "#38bdf8" }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
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

