import { state } from './state.js';

// ===== LOAD DATA =====
const rawCards = window.characterAbilityCards || [];

// ===== MERGE TOP/BOTTOM INTO SINGLE CARD =====
function buildCardMap(cards) {
  const map = {};

  cards.forEach(card => {
    if (!card.image) return;

    if (!map[card.image]) {
      map[card.image] = {
        image: card.image,
        top: null,
        bottom: null,
        name: card.name.replace(/-(top|bottom)$/, '')
      };
    }

    if (card.xws?.endsWith('-top')) {
      map[card.image].top = card;
    } else if (card.xws?.endsWith('-bottom')) {
      map[card.image].bottom = card;
    }
  });

  return Object.values(map);
}

const mergedCards = buildCardMap(rawCards);

function normalizeLevel(level) {
  if (level === 'X' || level === 'x') return 'X';
  return Number(level);
}

function getSortWeight(level) {
  if (level === 1) return 1;
  if (level === 'X') return 1.5;
  return level;
}

function sortCards(cards) {
  return cards.sort((a, b) => {
    const levelA = normalizeLevel(a.top?.level || a.bottom?.level);
    const levelB = normalizeLevel(b.top?.level || b.bottom?.level);

    const weightA = getSortWeight(levelA);
    const weightB = getSortWeight(levelB);

    if (weightA !== weightB) return weightA - weightB;

    return a.name.localeCompare(b.name);
  });
}

function filterByLevel(cards, selectedLevel) {
  return cards.filter(card => {
    const level = normalizeLevel(card.top?.level || card.bottom?.level);

    if (level === 'X') return true;
    return level <= selectedLevel;
  });
}

// ===== BUILD STRUCTURE =====
function buildData() {
  const expansions = {};

  mergedCards.forEach(card => {
    if (!card.image) return;

    // example:
    // character-ability-cards/gloomhaven/be/gh-be-01.png
    const parts = card.image.split('/');

    const expansion = parts[1];
    const classId = parts[2];

    if (!expansions[expansion]) expansions[expansion] = {};
    if (!expansions[expansion][classId]) {
      expansions[expansion][classId] = {
        back: null,
        cards: []
      };
    }

    if (card.name.endsWith('-back')) {
      expansions[expansion][classId].back = card;
    } else {
      expansions[expansion][classId].cards.push(card);
    }
  });

  return expansions;
}

const data = buildData();

// ===== STATE =====
state.selectedExpansion = null;
state.selectedClass = null;

// ===== RENDER: EXPANSION =====
function renderExpansion() {
  const app = document.getElementById('app');

  app.innerHTML = `<h1>Select Expansion</h1><div class="exp-grid"></div>`;

  const grid = app.querySelector('.exp-grid');

  Object.keys(data).forEach(exp => {
    const btn = document.createElement('button');
    btn.className = 'exp-btn';
    btn.textContent = exp;

    btn.onclick = () => {
      state.selectedExpansion = exp;
      state.selectedClass = null;
      render();
    };

    grid.appendChild(btn);
  });
}

// ===== RENDER: CLASS =====
function renderClass() {
  const app = document.getElementById('app');
  const classes = data[state.selectedExpansion];

  app.innerHTML = `
  <h1>${state.selectedExpansion}</h1>
  <button id="backExp">← Back</button>
  <div class="class-grid"></div>
  `;

  const grid = app.querySelector('.class-grid');

  Object.entries(classes).forEach(([classId, cls]) => {
    if (!cls.back) return;

    const img = document.createElement('img');
    img.src = `/deck-assets/images/${cls.back.image}`;
    img.className = 'class-card';

    img.onclick = () => {
      state.selectedClass = classId;
      render();
    };

    grid.appendChild(img);
  });

  document.getElementById('backExp').onclick = () => {
    state.selectedExpansion = null;
    render();
  };
}

function renderBuild() {
  const app = document.getElementById('app');

  const cls = data[state.selectedExpansion]?.[state.selectedClass];
  if (!cls) return;

  app.innerHTML = `
  <div class="tabs">
  <button id="tabBuild">Build Deck</button>
  <button id="tabPlay">Play</button>
  </div>

  <div class="topbar">
  <div>Hand: ${state.builtHand.length} / 10</div>
  <button id="startGame">Start Game</button>
  </div>

  <div class="card-grid"></div>
  `;

  // 🔥 Attach handlers AFTER render
  document.getElementById('tabBuild').onclick = () => {
    state.view = 'build';
    render();
  };

  document.getElementById('tabPlay').onclick = () => {
    state.view = 'play';
    render();
  };

  const grid = app.querySelector('.card-grid');

  const visibleCards = sortCards(
    filterByLevel(cls.cards, state.selectedLevel)
  );

  visibleCards.forEach(card => {
    const img = document.createElement('img');
    img.src = `/deck-assets/images/${card.image}`;
    img.className = 'ability-card';

    const selected = state.builtHand.some(c => c.image === card.image);
    if (selected) img.classList.add('selected');

    img.onclick = () => {
      if (selected) {
        state.builtHand = state.builtHand.filter(c => c.image !== card.image);
      } else {
        if (state.builtHand.length >= 10) return;
        state.builtHand.push(card);
      }
      render();
    };

    grid.appendChild(img);
  });

  document.getElementById('startGame').onclick = () => {
    state.cardsInHand = [...state.builtHand];
    state.cardsDiscarded = [];
    state.cardsLost = [];
    state.cardsActive = [];

    saveGame();

    state.view = 'play';
    render();
  };
}

function renderZone(title, cards, zone) {
  const section = document.createElement('div');
  section.className = 'zone';

  section.innerHTML = `<h2>${title} (${cards.length})</h2>`;

  const grid = document.createElement('div');
  grid.className = 'card-grid';

  cards.forEach(card => {
    const img = document.createElement('img');
    img.src = `/deck-assets/images/${card.image}`;
    img.className = 'ability-card';

    img.onclick = () => handleCardAction(card, zone);

    grid.appendChild(img);
  });

  section.appendChild(grid);
  return section;
}

async function renderPlay() {
  const app = document.getElementById('app');

  app.innerHTML = `
  <div class="tabs">
  <button id="tabBuild">Build Deck</button>
  <button id="tabPlay">Play</button>
  </div>

  <div id="content"></div>
  `;

  document.getElementById('tabBuild').onclick = () => {
    state.view = 'build';
    render();
  };

  document.getElementById('tabPlay').onclick = () => {
    state.view = 'play';
    render();
  };

  const content = document.getElementById('content');

  content.appendChild(renderZone('Hand', state.cardsInHand, 'hand'));
  content.appendChild(renderZone('Active', state.cardsActive, 'active'));
  content.appendChild(renderZone('Discard', state.cardsDiscarded, 'discard'));
  content.appendChild(renderZone('Lost', state.cardsLost, 'lost'));
}

function handleCardAction(card, zone) {
  const remove = arr => arr.filter(c => c.image !== card.image);

  if (zone === 'hand') {
    state.cardsInHand = remove(state.cardsInHand);
    state.cardsDiscarded.push(card);
  } else if (zone === 'discard') {
    state.cardsDiscarded = remove(state.cardsDiscarded);
    state.cardsInHand.push(card);
  } else if (zone === 'hand') {
    state.cardsLost.push(card);
  }

  saveGame();
  render();
}

// ===== ROUTER =====
async function render() {
  const hasSavedGame =
  state.cardsInHand.length ||
  state.cardsDiscarded.length ||
  state.cardsLost.length ||
  state.cardsActive.length;

  // 🔥 PRIORITY: if playing, skip selection flow
  if (hasSavedGame && state.view === 'play') {
    return renderPlay();
  }

  // 🔥 Normal flow
  if (!state.selectedExpansion) return renderExpansion();
  if (!state.selectedClass) return renderClass();

  if (state.view === 'build') return renderBuild();
  return renderPlay();
}

async function saveGame() {
  const csrf =
  document.querySelector('meta[name="csrf-token"]')?.content ||
  document.querySelector('input[name="_csrf"]')?.value;

  const payload = {
    cardsInHand: state.cardsInHand.map(c => c.image),
    cardsDiscarded: state.cardsDiscarded.map(c => c.image),
    cardsLost: state.cardsLost.map(c => c.image),
    cardsActive: state.cardsActive.map(c => c.image),
    selectedClass: state.selectedClass,
    selectedExpansion: state.selectedExpansion
  };

  const res = await fetch('/api/deck/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'CSRF-Token': csrf } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.warn('Save failed:', res.status);
    return;
  }

  return res.json();
}

async function loadGame() {
  const res = await fetch('/api/deck/load', {
    credentials: 'include'
  });

  if (!res.ok) {
    console.warn("Load failed:", res.status);
    return;
  }

  const text = await res.text();

  // 🔥 prevent HTML crash
  if (text.startsWith('<')) {
    console.warn("Got HTML instead of JSON (probably not logged in)");
    return;
  }

  const data = JSON.parse(text);

  if (!data) return;

  const allCards = mergedCards;

  function restore(list) {
    return (list || [])
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  state.cardsInHand = restore(data.cardsInHand);
  state.cardsDiscarded = restore(data.cardsDiscarded);
  state.cardsLost = restore(data.cardsLost);
  state.cardsActive = restore(data.cardsActive);
  state.selectedClass = data.selectedClass;
  state.selectedExpansion = data.selectedExpansion;
}

// ===== INIT =====
init();

async function init() {
  await loadGame();

  const hasSavedGame =
  state.cardsInHand.length ||
  state.cardsDiscarded.length ||
  state.cardsLost.length ||
  state.cardsActive.length;

  if (hasSavedGame) {
    state.view = 'play';
  } else {
    state.view = 'build';
  }

  render();
}
