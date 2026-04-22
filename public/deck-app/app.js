import { state, setState } from './state.js';

function loadData() {
  if (window.abilities) setState({ abilities: window.abilities });
}

/* =========================
 C ORE GAME LOGIC                                  *
 ========================= */

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
    removeFromAllZones(card);
  }

  render();
}

function removeFromAllZones(card) {
  state.cardsInHand = state.cardsInHand.filter(c => c !== card);
  state.cardsDiscarded = state.cardsDiscarded.filter(c => c !== card);
  state.cardsDestroyed = state.cardsDestroyed.filter(c => c !== card);
  state.cardsOnBoard = state.cardsOnBoard.filter(c => c !== card);
  state.twoAbilitiesSelected = state.twoAbilitiesSelected.filter(c => c !== card);
}

function toggleSelected(card) {
  const idx = state.twoAbilitiesSelected.indexOf(card);

  if (idx !== -1) {
    state.twoAbilitiesSelected.splice(idx, 1);
  } else if (state.twoAbilitiesSelected.length < 2) {
    state.twoAbilitiesSelected.push(card);
  }

  render();
}

function moveCard(card, from, to) {
  const i = from.indexOf(card);
  if (i !== -1) from.splice(i, 1);
  if (!to.includes(card)) to.push(card);
}

function playSelected() {
  if (state.twoAbilitiesSelected.length !== 2) {
    alert("Select 2 cards");
    return;
  }

  state.twoAbilitiesSelected.forEach(card => {
    moveCard(card, state.cardsInHand, state.cardsDiscarded);
  });

  state.twoAbilitiesSelected = [];
  state.turn++;
  render();
}

function destroyCard(card) {
  moveCard(card, state.cardsDiscarded, state.cardsDestroyed);
  state.twoAbilitiesSelected = state.twoAbilitiesSelected.filter(c => c !== card);
  render();
}

function recoverCard(card) {
  moveCard(card, state.cardsDiscarded, state.cardsInHand);
  render();
}

function keepOnBoard(card) {
  moveCard(card, state.cardsDiscarded, state.cardsOnBoard);
  card.duration = -1;
  render();
}

function newGame() {
  state.cardsInHand = [...state.abilitiesChosen];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];
  state.cardsOnBoard = [];
  state.twoAbilitiesSelected = [];
  state.turn = 1;
  render();
}

/* =========================
 R ENDERING                                        *
 ========================= */

function renderClasses() {
  return state.abilities.map((c, i) =>
  `<button data-class="${i}" class="btn">${c.name}</button>`
  ).join('');
}

function renderAbilities() {
  if (!state.abilityCategory) return '';

  return state.abilityCategory.cards.map(card => {
    const chosen = state.abilitiesChosen.includes(card) ? 'chosen' : '';
    return `
    <div class="card ${chosen}" data-add="${card.name}">
    ${card.name} (L${card.level})
    </div>
    `;
  }).join('');
}

function renderZone(title, cards, type) {
  return `
  <div class="zone">
  <h3>${title}</h3>
  ${cards.map(card => {
    const selected = state.twoAbilitiesSelected.includes(card) ? 'selected' : '';
    return `
    <div class="card ${selected}" data-${type}="${card.name}">
    ${card.name}
    </div>
    `;
  }).join('')}
  </div>
  `;
}

function render() {
  const root = document.getElementById('app');

  root.innerHTML = `
  <div class="deck-app">
  <h1>Deck</h1>
  <p>Turn: ${state.turn}</p>

  <div>${renderClasses()}</div>
  <div>${renderAbilities()}</div>

  <div class="zones">
  ${renderZone('Hand', state.cardsInHand, 'pick')}
  ${renderZone('Discard', state.cardsDiscarded, 'discard')}
  ${renderZone('Destroyed', state.cardsDestroyed, 'none')}
  ${renderZone('Board', state.cardsOnBoard, 'none')}
  </div>

  <button id="play">Play Selected</button>
  <button id="newGame">New Game</button>
  </div>
  `;

  bindEvents();
}

/* =========================
 E VENTS                                           *
 ========================= */

function findCard(list, name) {
  return list.find(c => c.name === name);
}

function bindEvents() {
  document.querySelectorAll('[data-class]').forEach(btn =>
  btn.onclick = () => chooseClass(btn.dataset.class)
  );

  document.querySelectorAll('[data-add]').forEach(el =>
  el.onclick = () =>
  toggleAbility(
    state.abilityCategory.cards.find(c => c.name === el.dataset.add)
  )
  );

  document.querySelectorAll('[data-pick]').forEach(el =>
  el.onclick = () =>
  toggleSelected(findCard(state.cardsInHand, el.dataset.pick))
  );

  document.querySelectorAll('[data-discard]').forEach(el =>
  el.onclick = () =>
  destroyCard(findCard(state.cardsDiscarded, el.dataset.discard))
  );

  document.getElementById('play').onclick = playSelected;
  document.getElementById('newGame').onclick = newGame;
}

/* =========================
 I NIT                                             *
 ========================= */

function init() {
  loadData();
  render();
}

document.addEventListener('DOMContentLoaded', init);
