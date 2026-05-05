import { state } from './state.js';

// ===== LOAD DATA =====
const rawCards = window.characterAbilityCards || [];

let saveTimeout = null;

function queueSave() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    persistState();
  }, 400); // 400ms debounce
}

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
  <button id="tabSelect">Select Class</button>
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

  document.getElementById('tabSelect').onclick = () => {
    state.view = 'select';
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

      queueSave();
      render();
    };

    grid.appendChild(img);
  });

  document.getElementById('startGame').onclick = () => {
    // 🔥 Convert built hand → full play state
    state.cardsInHand = state.builtHand.map(c => c);

    state.cardsDiscarded = [];
    state.cardsLost = [];
    state.cardsActive = [];

    // 🔥 Save build (IMPORTANT: use images)
    const newBuild = {
      classId: state.selectedClass,
      expansion: state.selectedExpansion,

      cardsInHand: state.cardsInHand.map(c => c.image),
      cardsDiscarded: [],
      cardsLost: [],
      cardsActive: []
    };

    const existingIndex = state.builds.findIndex(
      b => b.classId === newBuild.classId
    );

    if (existingIndex >= 0) {
      state.builds[existingIndex] = newBuild;
      state.activeBuild = existingIndex;
    } else {
      if (state.builds.length >= 3) {
        alert("Max 3 builds");
        return;
      }
      state.builds.push(newBuild);
      state.activeBuild = state.builds.length - 1;
    }

    persistState();

    // 🔥 NOW switch view
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
  <button id="tabSelect">Select Class</button>
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

  document.getElementById('tabSelect').onclick = () => {
    state.view = 'select';
    render();
  };

  const content = document.getElementById('content');

  content.appendChild(renderZone('Hand', state.cardsInHand, 'hand'));
  content.appendChild(renderZone('Active', state.cardsActive, 'active'));
  content.appendChild(renderZone('Discard', state.cardsDiscarded, 'discard'));
  content.appendChild(renderZone('Lost', state.cardsLost, 'lost'));
}

function renderSelectClass() {
  const app = document.getElementById('app');

  app.innerHTML = `
  <div class="header">
  <h1>Select Class</h1>
  </div>

  <div class="build-grid"></div>
  `;

  const grid = app.querySelector('.build-grid');

  const allCards = mergedCards;

  function restore(list) {
    if (!Array.isArray(list)) return [];
    return list
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  // ===== EXISTING BUILDS =====
  state.builds.forEach((build, i) => {
    const cls = data[build.expansion]?.[build.classId];
    if (!cls) return;

    const div = document.createElement('div');
    div.className = 'build-card';

    const imgSrc = cls.back
    ? `/deck-assets/images/${cls.back.image}`
    : '';

    const handCount = (build.cardsInHand || []).length;

    div.innerHTML = `
    <img src="${imgSrc}" class="class-img"/>
    <div class="build-info">
    <div class="class-name">${build.classId.toUpperCase()}</div>
    <div class="expansion">${build.expansion}</div>
    <div class="hand-size">Hand: ${handCount}</div>
    </div>

    <div class="actions">
    <button class="load">Play</button>
    <button class="dup">Duplicate</button>
    <button class="del">Delete</button>
    </div>
    `;

    // LOAD
    div.querySelector('.load').onclick = () => {
      state.activeBuild = i;
      state.lastPlayed = i;

      const b = state.builds[i];

      state.cardsInHand = restore(b.cardsInHand);
      state.cardsDiscarded = restore(b.cardsDiscarded);
      state.cardsLost = restore(b.cardsLost);
      state.cardsActive = restore(b.cardsActive);

      state.selectedClass = b.classId;
      state.selectedExpansion = b.expansion;

      state.view = 'play';
      render();
    };

    // DELETE
    div.querySelector('.del').onclick = () => {
      state.builds.splice(i, 1);
      persistState();
      render();
    };

    // DUPLICATE
    div.querySelector('.dup').onclick = () => {
      if (state.builds.length >= 3) {
        alert("Max 3 builds");
        return;
      }

      const clone = JSON.parse(JSON.stringify(build));
      state.builds.push(clone);

      persistState();
      render();
    };

    grid.appendChild(div);
  });

  // ===== EMPTY SLOTS =====
  const remaining = 3 - state.builds.length;

  for (let i = 0; i < remaining; i++) {
    const div = document.createElement('div');
    div.className = 'build-card empty';

    div.innerHTML = `
    <div class="empty-slot">+ New Build</div>
    `;

    div.onclick = () => {
      state.selectedExpansion = null;
      state.selectedClass = null;
      state.view = 'build';
      render();
    };

    grid.appendChild(div);
  }
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

  queueSave();
  render();
}

// ===== ROUTER =====
async function render() {
  // 🔥 ALWAYS show Select Class first unless actively building/playing
  if (!state.view) {
    return renderSelectClass();
  }

  if (state.view === 'select') {
    return renderSelectClass();
  }

  if (!state.selectedExpansion) return renderExpansion();
  if (!state.selectedClass) return renderClass();

  if (state.view === 'build') return renderBuild();
  return renderPlay();
}

async function persistState() {
  if (state.activeBuild == null) return;

  const build = state.builds[state.activeBuild];
  if (!build) return;

  state.lastPlayed = state.activeBuild;

  // 🔥 Sync current state into active build
  build.cardsInHand = state.cardsInHand.map(c => c.image);
  build.cardsDiscarded = state.cardsDiscarded.map(c => c.image);
  build.cardsLost = state.cardsLost.map(c => c.image);
  build.cardsActive = state.cardsActive.map(c => c.image);

  build.classId = state.selectedClass;
  build.expansion = state.selectedExpansion;

  try {
    await window.api('/api/deck/save', {
      method: 'POST',
      body: {
        builds: state.builds,
        lastPlayed: state.lastPlayed
      }
    });
  } catch (err) {
    console.warn("Auto-save failed:", err);
  }
}

async function loadGame() {
  const res = await fetch('/api/deck/load', {
    credentials: 'include'
  });

  if (!res.ok) return;

  const data = await res.json();

  if (!data || !Array.isArray(data.builds)) return;

  state.builds = data.builds;
  state.lastPlayed = data.lastPlayed || 0;

  if (state.builds.length === 0) return;

  // 🔥 Load last played
  state.activeBuild = Math.min(state.lastPlayed, state.builds.length - 1);

  const b = state.builds[state.activeBuild];

  const allCards = mergedCards;

  function restore(list) {
    if (!Array.isArray(list)) return [];
    return list
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  state.cardsInHand = restore(b.cardsInHand);
  state.cardsDiscarded = restore(b.cardsDiscarded);
  state.cardsLost = restore(b.cardsLost);
  state.cardsActive = restore(b.cardsActive);

  state.selectedClass = b.classId;
  state.selectedExpansion = b.expansion;
}

// ===== INIT =====
init();

async function init() {
  await loadGame();

  if (state.builds.length > 0) {
    state.view = 'play';   // 🔥 jump straight into game
  } else {
    state.view = 'select';
  }

  render();
}
