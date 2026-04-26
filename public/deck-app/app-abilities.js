import { state } from './state.js';

const ENHANCEMENTS = [
  { id: 'attack', label: '+1 Attack' },
{ id: 'move', label: '+1 Move' },
{ id: 'range', label: '+1 Range' }
];

// ===== Enhancements =====
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

function getCard(name) {
  return state.cardsInHand.find(c => c.name === name);
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
function renderCard(card) {
  const enh = state.enhancements[card.name] || { top: [], bottom: [] };

  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
  <div class="card-header">${card.name}</div>

  <div class="enh-block">
  <div>
  <span>Top:</span>
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

    <div>
    <span>Bottom:</span>
    ${enh.bottom.map((e, i) => `
      <span class="chip">
      ${e.label}
      <button data-rem="${card.name}|bottom|${i}">×</button>
      </span>
      `).join('')}
      <select data-add="${card.name}|bottom">
      <option value="">+</option>
      ${ENHANCEMENTS.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}
      </select>
      </div>
      </div>
      `;

      return el;
}

// ===== PLAY =====
function renderPlay() {
  const app = document.getElementById('app');

  app.innerHTML = `
  <div class="page">
  <div class="topbar">
  <button id="toBuild">Back</button>
  <h1>Hand</h1>
  </div>
  <div class="card-grid" id="hand"></div>
  </div>
  `;

  const hand = app.querySelector('#hand');

  state.cardsInHand.forEach(card => {
    hand.appendChild(renderCard(card));
  });

  app.querySelector('#toBuild').onclick = () => {
    state.view = 'build';
    render();
  };
}

// ===== ROUTER =====
function render() {
  if (state.view === 'build') renderBuild();
  else renderPlay();
}

// ===== EVENTS =====
document.addEventListener('change', e => {
  if (e.target.matches('[data-add]')) {
    const [name, side] = e.target.dataset.add.split('|');
    const card = getCard(name);
    if (!card || !e.target.value) return;

    addEnh(card, side, e.target.value);
    e.target.value = '';
  }
});

document.addEventListener('click', e => {
  if (e.target.matches('[data-rem]')) {
    const [name, side, i] = e.target.dataset.rem.split('|');
    const card = getCard(name);
    if (!card) return;

    removeEnh(card, side, Number(i));
  }
});

render();
