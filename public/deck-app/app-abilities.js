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
      render();
    };

    grid.appendChild(img);
  });

  document.getElementById('startGame').onclick = () => {
    const newBuild = {
      classId: state.selectedClass,
      expansion: state.selectedExpansion,

      cardsInHand: state.builtHand.map(c => c.image),
      cardsDiscarded: [],
      cardsLost: [],
      cardsActive: []
    };

    // replace existing build if same class
    const existingIndex = state.builds.findIndex(
      b => b.classId === newBuild.classId
    );

    if (state.builds.length >= 3 && existingIndex === -1) {
      return alert("Max 3 builds");
    }

    if (existingIndex >= 0) {
      state.builds[existingIndex] = newBuild;
    } else {
      state.builds.push(newBuild);
    }

    state.activeBuild = state.builds.length - 1;

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
      saveGame();
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

      saveGame();
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

  saveGame();
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

async function saveGame() {
  const csrf =
  document.querySelector('meta[name="csrf-token"]')?.content ||
  document.querySelector('input[name="_csrf"]')?.value;

  const res = await fetch('/api/deck/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'CSRF-Token': csrf } : {})
    },
    body: JSON.stringify({
      builds: state.builds
    })
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

  if (text.startsWith('<')) {
    console.warn("Got HTML instead of JSON");
    return;
  }

  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    console.warn("Expected builds array, got:", data);
    return;
  }

  state.builds = data;

  const allCards = mergedCards;

  function restore(list) {
    if (!Array.isArray(list)) return [];
    return list
    .map(img => allCards.find(c => c.image === img))
    .filter(Boolean);
  }

  // 🔥 If builds exist, load first one as active
  if (state.builds.length > 0) {
    state.activeBuild = 0;

    const b = state.builds[0];

    state.cardsInHand = restore(b.cardsInHand);
    state.cardsDiscarded = restore(b.cardsDiscarded);
    state.cardsLost = restore(b.cardsLost);
    state.cardsActive = restore(b.cardsActive);

    state.selectedClass = b.classId;
    state.selectedExpansion = b.expansion;
  }
}

// ===== INIT =====
init();

async function init() {
  await loadGame();

  // 🔥 Always start at Select Class
  state.view = 'select';

  render();
}
