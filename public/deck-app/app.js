import { state, setState } from './state.js';

function loadData() {
  if (window.abilities) {
    setState({ abilities: window.abilities });
  }
}

function chooseClass(index) {
  const category = state.abilities[index];

  setState({
    abilityCategory: category,
    abilitiesChosen: [],
    cardsInHand: [],
    cardsDiscarded: [],
    cardsDestroyed: [],
    cardsOnBoard: []
  });

  render();
}

function toggleAbility(card) {
  if (!state.abilitiesChosen.includes(card)) {
    if (state.abilitiesChosen.length < state.abilityCategory.max) {
      state.abilitiesChosen.push(card);
      state.cardsInHand.push(card);
    }
  } else {
    state.abilitiesChosen = state.abilitiesChosen.filter(c => c !== card);
    state.cardsInHand = state.cardsInHand.filter(c => c !== card);
  }

  render();
}

function playCard(card) {
  state.cardsInHand = state.cardsInHand.filter(c => c !== card);
  state.cardsDiscarded.push(card);
  render();
}

function nextTurn() {
  state.turn++;
  render();
}

function renderClasses() {
  return state.abilities.map((c, i) => `
  <button data-class="${i}" class="btn">${c.name}</button>
  `).join('');
}

function renderAbilities() {
  if (!state.abilityCategory) return '';

  return state.abilityCategory.cards.map(card => `
  <div class="card selectable" data-add="${card.name}">
  ${card.name} (L${card.level})
  </div>
  `).join('');
}

function renderZone(title, cards, action) {
  return `
  <div class="zone">
  <h3>${title}</h3>
  ${cards.map(card => `
    <div class="card" data-${action}="${card.name}">
    ${card.name}
    </div>
    `).join('')}
    </div>
    `;
}

function render() {
  const root = document.getElementById('app');

  root.innerHTML = `
  <div class="deck-app">
  <h1>Deck Builder</h1>
  <p>Turn: ${state.turn}</p>

  <div class="section">
  <h2>Classes</h2>
  ${renderClasses()}
  </div>

  <div class="section">
  <h2>Abilities</h2>
  ${renderAbilities()}
  </div>

  <div class="zones">
  ${renderZone('Hand', state.cardsInHand, 'play')}
  ${renderZone('Discard', state.cardsDiscarded, 'none')}
  </div>

  <button id="nextTurn" class="btn primary">Next Turn</button>
  </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-class]').forEach(btn => {
    btn.onclick = () => chooseClass(btn.dataset.class);
  });

  document.querySelectorAll('[data-add]').forEach(el => {
    el.onclick = () => {
      const card = state.abilityCategory.cards.find(
        c => c.name === el.dataset.add
      );
      toggleAbility(card);
    };
  });

  document.querySelectorAll('[data-play]').forEach(el => {
    el.onclick = () => {
      const card = state.cardsInHand.find(
        c => c.name === el.dataset.play
      );
      playCard(card);
    };
  });

  const next = document.getElementById('nextTurn');
  if (next) next.onclick = nextTurn;
}

function init() {
  loadData();
  render();
}

document.addEventListener('DOMContentLoaded', init);
