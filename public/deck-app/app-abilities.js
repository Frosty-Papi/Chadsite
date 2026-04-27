import { state } from './state.js';

const ENHANCEMENTS = [
  { id: 'attack', label: '+1 Attack' },
{ id: 'move', label: '+1 Move' },
{ id: 'range', label: '+1 Range' }
];

function getInitiative(card) {
  // fallback if no initiative data exists
  return card.initiative || Math.floor(Math.random() * 90) + 10;
}

function toggleSelect(card) {
  const exists = state.selectedCards.includes(card);

  if (exists) {
    state.selectedCards = state.selectedCards.filter(c => c !== card);
  } else {
    if (state.selectedCards.length >= 2) return;
    state.selectedCards.push(card);
  }

  if (state.selectedCards.length === 2) {
    state.turnPhase = 'order';
  } else {
    state.turnPhase = 'select';
  }

  render();
}

function playTurn() {
  if (state.turnPhase !== 'resolve') return;

  state.orderedCards.forEach(card => {
    state.cardsInHand = state.cardsInHand.filter(c => c !== card);
    state.cardsDiscarded.push(card);
  });

  state.selectedCards = [];
  state.orderedCards = [];
  state.turnPhase = 'select';
  state.turn++;
  state.initiative = null;

  render();
}

// ===== ENHANCEMENTS =====
function ensureEnh(card) {
  if (!state.enhancements[card.name]) {
    state.enhancements[card.name] = { top: [], bottom: [] };
  }
  return state.enhancements[card.name];
}

function addEnh(card, side, type) {
  const def = ENHANCEMENTS.find(e => e.id === type);
  if (!def) return;
  ensureEnh(card)[side].push(def);
  render();
}

function removeEnh(card, side, i) {
  ensureEnh(card)[side].splice(i, 1);
  render();
}

// ===== CARD LOOKUP =====
function findCardInZones(name) {
  return (
    state.cardsInHand.find(c => c.name === name) ||
    state.cardsDiscarded.find(c => c.name === name) ||
    state.cardsOnBoard.find(c => c.name === name) ||
    state.cardsDestroyed.find(c => c.name === name)
  );
}

// ===== ACTIONS =====
function moveCard(card, from, to) {
  state[from] = state[from].filter(c => c !== card);
  state[to].push(card);
  render();
}

// ===== BUILD =====
function renderBuild() {
  const app = document.getElementById('app');

  app.innerHTML = `
  <div class="page">
  <h1>Select Class</h1>
  <div class="class-grid"></div>
  <div class="card-grid"></div>
  <button id="toPlay" class="primary">Play</button>
  </div>
  `;

  const classGrid = app.querySelector('.class-grid');
  const cardGrid = app.querySelector('.card-grid');

  (window.abilities || []).forEach(cls => {
    const btn = document.createElement('button');
    btn.className = 'class-btn';
    btn.textContent = cls.name;

    btn.onclick = () => {
      state.selectedClass = cls;
      state.cardsInHand = [];
      render();
    };

    classGrid.appendChild(btn);
  });

  if (state.selectedClass) {
    state.selectedClass.cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card-select';
      el.textContent = card.name;

      el.onclick = () => {
        state.cardsInHand.push({ ...card });
        render();
      };

      cardGrid.appendChild(el);
    });
  }

  app.querySelector('#toPlay').onclick = () => {
    state.view = 'play';
    render();
  };
}

// ===== CARD UI =====
function renderCard(card, zone) {
  const enh = state.enhancements[card.name] || { top: [], bottom: [] };

  const el = document.createElement('div');
  const isSelected = state.selectedCards.includes(card);

  el.classList.toggle('selected', isSelected);
  el.className = 'card';

  let actions = '';

  if (zone === 'hand') {
    actions = `
    <button data-act="select">Select</button>
    <button data-act="discard">Discard</button>
    <button data-act="lose">Lose</button>
    <button data-act="activate">Activate</button>
    `;
  }

  if (zone === 'discard') {
    actions = `
    <button data-act="recover">Recover</button>
    <button data-act="activate">Activate</button>
    `;
  }

  if (zone === 'active') {
    actions = `
    <button data-act="end">End</button>
    `;
  }

  el.innerHTML = `
  <div class="card-header">${card.name}</div>

  <div class="enh-block">
  <div>
  Top:
  ${enh.top.map((e, i) => `
    <span class="chip">
    ${e.label}
    <button data-rem="${card.name}|top|${i}">×</button>
    </span>
    `).join('')}
    <select data-add="${card.name}|top">
    <option value="">+</option>
    ${ENHANCEMENTS.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}
    </select>
    </div>
    </div>

    <div class="actions">${actions}</div>
    `;

    el.dataset.name = card.name;
    el.dataset.zone = zone;

    return el;
}

// ===== ZONES =====
function renderZone(title, cards, zone) {
  const sec = document.createElement('div');
  sec.className = 'zone';

  sec.innerHTML = `<h2>${title} (${cards.length})</h2>`;

  const grid = document.createElement('div');
  grid.className = 'card-grid';

  cards.forEach(card => {
    grid.appendChild(renderCard(card, zone));
  });

  sec.appendChild(grid);
  return sec;
}

// ===== PLAY =====
function renderPlay() {
  const app = document.getElementById('app');
  let orderUI = '';

  if (state.turnPhase === 'order') {
    const [a, b] = state.selectedCards;

      orderUI = `
      <div class="order-panel">
      <h3>Choose Card Order</h3>

      <button data-order="ab">
      ${a.name} (Top) → ${b.name} (Bottom)
      </button>

      <button data-order="ba">
      ${b.name} (Top) → ${a.name} (Bottom)
      </button>
      </div>
      `;
    }

  app.innerHTML = `
  <div class="page">
  <div class="topbar">
  <button id="toBuild">Back</button>
  <h1>Turn ${state.turn}</h1>
  <div>Initiative: ${state.initiative ?? '-'}</div>
  <button id="playTurn">Play Turn</button>
  </div>

  <div class="zones"></div>
  </div>
  ${orderUI}
  `;

  const zones = app.querySelector('.zones');

  zones.appendChild(renderZone('Hand', state.cardsInHand, 'hand'));
  zones.appendChild(renderZone('Active', state.cardsOnBoard, 'active'));
  zones.appendChild(renderZone('Discard', state.cardsDiscarded, 'discard'));
  zones.appendChild(renderZone('Lost', state.cardsDestroyed, 'lost'));

  document.getElementById('toBuild').onclick = () => {
    state.view = 'build';
    render();
  };
  document.getElementById('playTurn').onclick = playTurn;


}

// ===== ROUTER =====
function render() {
  if (state.view === 'build') renderBuild();
  else renderPlay();
}

// ===== EVENTS =====
document.addEventListener('click', e => {
  const cardEl = e.target.closest('.card');
  if (!cardEl) return;

  const name = cardEl.dataset.name;
  const zone = cardEl.dataset.zone;
  const card = findCardInZones(name);

  if (!card) return;

  if (e.target.dataset.act === 'discard') {
    moveCard(card, 'cardsInHand', 'cardsDiscarded');
  }

  if (e.target.dataset.act === 'lose') {
    moveCard(card, 'cardsInHand', 'cardsDestroyed');
  }

  if (e.target.dataset.act === 'activate') {
    moveCard(card, zone === 'hand' ? 'cardsInHand' : 'cardsDiscarded', 'cardsOnBoard');
  }

  if (e.target.dataset.act === 'recover') {
    moveCard(card, 'cardsDiscarded', 'cardsInHand');
  }

  if (e.target.dataset.act === 'end') {
    moveCard(card, 'cardsOnBoard', 'cardsDiscarded');
  }

  if (e.target.dataset.act === 'select') {
    toggleSelect(card);
  }

  if (e.target.dataset.order) {
    const [a, b] = state.selectedCards;

    if (e.target.dataset.order === 'ab') {
      state.orderedCards = [a, b];
    } else {
      state.orderedCards = [b, a];
    }

    // initiative = top card
    state.initiative = getInitiative(state.orderedCards[0]);

    state.turnPhase = 'resolve';

    render();
  }

  if (e.target.matches('[data-rem]')) {
    const [n, side, i] = e.target.dataset.rem.split('|');
    removeEnh(card, side, Number(i));
  }
});

document.addEventListener('change', e => {
  if (e.target.matches('[data-add]')) {
    const [name, side] = e.target.dataset.add.split('|');
    const card = findCardInZones(name);

    if (!card || !e.target.value) return;

    addEnh(card, side, e.target.value);
    e.target.value = '';
  }
});

render();
