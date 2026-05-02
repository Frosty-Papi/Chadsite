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

// ===== RENDER: CARDS =====
function renderCards() {
  const app = document.getElementById('app');
  const cls = data[state.selectedExpansion][state.selectedClass];

  app.innerHTML = `
  <div class="topbar">
  <button id="backClass">← Back</button>

  <label>
  Level:
  <select id="levelSelect">
  ${[1,2,3,4,5,6,7,8,9].map(l =>
    `<option value="${l}" ${l === state.selectedLevel ? 'selected' : ''}>${l}</option>`
  ).join('')}
  </select>
  </label>
  </div>

  <div class="card-grid"></div>
  `;

  document.getElementById('levelSelect').onchange = (e) => {
    state.selectedLevel = Number(e.target.value);
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

    grid.appendChild(img);
  });

  document.getElementById('backClass').onclick = () => {
    state.selectedClass = null;
    render();
  };
}

// ===== ROUTER =====
function render() {
  if (!state.selectedExpansion) return renderExpansion();
  if (!state.selectedClass) return renderClass();
  return renderCards();
}

// ===== INIT =====
render();
