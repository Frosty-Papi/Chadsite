import { state, setState } from './state.js';

function loadData() {
  if (window.abilities) setState({ abilities: window.abilities });
  if (window.attack_modifiers_categories) {
    setState({ modifiers: window.attack_modifiers_categories });
    setState({ modifiersBase: window.attack_modifiers_categories[0]?.cards || [] });
    setState({ modifiersSpecial: window.attack_modifiers_categories.slice(1) });
  }
  if (window.allItems) setState({ allGear: window.allItems });
}

/* ================= MODIFIERS ================= */

function initModifiers() {
  state.modifiersChosen = [...state.modifiersBase];
  state.modifiersDrawPile = [...state.modifiersChosen];
  shuffle(state.modifiersDrawPile);
}

function drawModifier() {
  if (!state.modifiersDrawPile.length) return;

  const card = state.modifiersDrawPile.shift();
  state.lastDrawnModifier = card;
  state.modifiersDiscardPile.unshift(card);
  render();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ================= GEAR ================= */

function toggleGear(item) {
  if (!state.gearChosen.includes(item)) {
    state.gearChosen.push(item);
  } else {
    state.gearChosen = state.gearChosen.filter(i => i !== item);
  }
  render();
}

/* ================= EXISTING GAME ================= */

function chooseClass(index) {
  const category = state.abilities[index];

  setState({
    abilityCategory: category,
    abilitiesChosen: [],
    cardsInHand: [],
    cardsDiscarded: [],
    cardsDestroyed: [],
    cardsOnBoard: [],
    twoAbilitiesSelected: [],
    turn: 1
  });

  initModifiers();
  render();
}

function toggleAbility(card) {
  const idx = state.abilitiesChosen.indexOf(card);

  if (idx === -1) {
    if (state.abilitiesChosen.length < state.abilityCategory.max) {
      state.abilitiesChosen.push(card);
      state.cardsInHand.push(card);
    }
  } else {
    state.abilitiesChosen.splice(idx, 1);
  }

  render();
}

function toggleSelected(card) {
  const idx = state.twoAbilitiesSelected.indexOf(card);

  if (idx !== -1) state.twoAbilitiesSelected.splice(idx, 1);
  else if (state.twoAbilitiesSelected.length < 2) state.twoAbilitiesSelected.push(card);

  render();
}

function moveCard(card, from, to) {
  const i = from.indexOf(card);
  if (i !== -1) from.splice(i, 1);
  if (!to.includes(card)) to.push(card);
}

function playSelected() {
  if (state.twoAbilitiesSelected.length !== 2) return;

  state.twoAbilitiesSelected.forEach(card => {
    moveCard(card, state.cardsInHand, state.cardsDiscarded);
  });

  state.twoAbilitiesSelected = [];
  state.turn++;
  render();
}

/* ================= RENDER ================= */

function renderModifiers() {
  return `
    <div class="panel">
      <h2>Modifiers</h2>
      <button id="drawMod">Draw</button>
      <button id="shuffleMod">Shuffle</button>
      <p>Last: ${state.lastDrawnModifier?.name || 'None'}</p>
      <p>Deck: ${state.modifiersDrawPile.length}</p>
    </div>
  `;
}

function renderGear() {
  if (!state.allGear.length) return '';

  return `
    <div class="panel">
      <h2>Gear</h2>
      ${state.allGear.map((cat, i) => `
        <div>
          <h4>${cat.name}</h4>
          ${cat.items.slice(0,5).map(item => `
            <button data-gear="${item.name}">${item.name}</button>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function render() {
  const root = document.getElementById('app');

  root.innerHTML = `
    <div class="deck-app">
      <h1>Deck</h1>
      <p>Turn: ${state.turn}</p>

      ${renderModifiers()}
      ${renderGear()}

      <button id="play">Play Selected</button>
    </div>
  `;

  bindEvents();
}

/* ================= EVENTS ================= */

function bindEvents() {
  document.getElementById('drawMod')?.addEventListener('click', drawModifier);
  document.getElementById('shuffleMod')?.addEventListener('click', () => shuffle(state.modifiersDrawPile));

  document.querySelectorAll('[data-gear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.allGear.flatMap(c => c.items).find(i => i.name === btn.dataset.gear);
      if (item) toggleGear(item);
    });
  });

  document.getElementById('play')?.addEventListener('click', playSelected);
}

function init() {
  loadData();
  render();
}

document.addEventListener('DOMContentLoaded', init);
