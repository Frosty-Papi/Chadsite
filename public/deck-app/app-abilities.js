import { state } from './state.js';

const ENHANCEMENTS = [
  { id: 'attack', label: '+1 Attack', cost: 75 },
{ id: 'move', label: '+1 Move', cost: 50 },
{ id: 'range', label: '+1 Range', cost: 30 }
];

// ===== Enhancement Logic =====
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

// ===== Build =====
function renderBuild() {
  const app = document.getElementById('app');
  app.innerHTML = `<h2>Select Class</h2>`;

  (window.abilities || []).forEach(cls => {
    const btn = document.createElement('button');
    btn.textContent = cls.name;
    btn.onclick = () => {
      state.selectedClass = cls;
      state.cardsInHand = [];
      render();
    };
    app.appendChild(btn);
  });

  if (state.selectedClass) {
    const grid = document.createElement('div');

    state.selectedClass.cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card-mini';
      el.textContent = card.name;

      el.onclick = () => {
        state.cardsInHand.push({ ...card });
        render();
      };

      grid.appendChild(el);
    });

    app.appendChild(grid);
  }

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Go To Play';
  playBtn.onclick = () => {
    state.view = 'play';
    render();
  };

  app.appendChild(playBtn);
}

// ===== Card UI =====
function renderCard(card) {
  const enh = state.enhancements[card.name] || { top: [], bottom: [] };

  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
  <div class="card-title">${card.name}</div>

  <div>
  <strong>Top:</strong>
  ${enh.top.map((e, i) => `
    <span class="chip">
    ${e.label}
    <button data-rem="${card.name}|top|${i}">x</button>
    </span>
    `).join('')}

    <select data-add="${card.name}|top">
    <option value="">+</option>
    ${ENHANCEMENTS.map(e => `
      <option value="${e.id}">${e.label}</option>
      `).join('')}
      </select>
      </div>

      <div>
      <strong>Bottom:</strong>
      ${enh.bottom.map((e, i) => `
        <span class="chip">
        ${e.label}
        <button data-rem="${card.name}|bottom|${i}">x</button>
        </span>
        `).join('')}

        <select data-add="${card.name}|bottom">
        <option value="">+</option>
        ${ENHANCEMENTS.map(e => `
          <option value="${e.id}">${e.label}</option>
          `).join('')}
          </select>
          </div>
          `;

          return el;
}

// ===== Play =====
function renderPlay() {
  const app = document.getElementById('app');
  app.innerHTML = `<h2>Hand</h2>`;

  state.cardsInHand.forEach(card => {
    app.appendChild(renderCard(card));
  });

  const back = document.createElement('button');
  back.textContent = 'Back to Build';
  back.onclick = () => {
    state.view = 'build';
    render();
  };

  app.appendChild(back);
}

// ===== Router =====
function render() {
  if (state.view === 'build') renderBuild();
  else renderPlay();
}

// ===== Events (delegation) =====
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

// ===== Init =====
render();
