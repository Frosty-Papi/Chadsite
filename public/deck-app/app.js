import { state, setState } from './state.js';

const STORAGE_KEY = 'deck_modern_state_v1';
const CURSE_NAME = 'curse';
const BLESS_NAME = 'bless';
const NULL_NAME = 'am-p-19';
const TWO_X_NAME = 'am-p-20';

function loadData() {
  if (window.abilities) setState({ abilities: window.abilities });
  if (window.attack_modifiers_categories) {
    setState({ modifiers: window.attack_modifiers_categories });
    setState({ modifiersBase: window.attack_modifiers_categories[0]?.cards || [] });
    setState({ modifiersSpecial: window.attack_modifiers_categories.slice(1) });
  }
  if (window.allItems) setState({ allGear: window.allItems });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function flatGear() {
  return state.allGear.flatMap(c => c.items);
}

function allModifierCards() {
  return [
    ...state.modifiersBase,
    ...state.modifiersSpecial.flatMap(c => c.cards || []),
    ...state.modifiers.flatMap(c => c.cards || []),
  ];
}

function findAbilityByName(name) {
  for (const cat of state.abilities) {
    const found = (cat.cards || []).find(c => c.name === name);
    if (found) return found;
  }
  return null;
}

function findModifierByName(name) {
  return allModifierCards().find(c => c.name === name) || null;
}

function findGearByName(name) {
  return flatGear().find(i => i.name === name) || null;
}

function isCurse(card) {
  const curseSet = state.modifiersSpecial.find(s => s.name === CURSE_NAME);
  return !!(card && curseSet && curseSet.cards.includes(card));
}

function isBless(card) {
  const blessSet = state.modifiersSpecial.find(s => s.name === BLESS_NAME);
  return !!(card && blessSet && blessSet.cards.includes(card));
}

function isNull(card) {
  return !!(card && card.name === NULL_NAME);
}

function isTwoX(card) {
  return !!(card && card.name === TWO_X_NAME);
}

function updateBlessCurseCounts() {
  state.blessings = state.modifiersDrawPile.filter(isBless).length;
  state.curses = state.modifiersDrawPile.filter(isCurse).length;
}

function saveState() {
  const payload = {
    turn: state.turn,
    level: state.level,
    abilityCategoryName: state.abilityCategory?.name || null,
    abilitiesChosen: state.abilitiesChosen.map(c => c.name),
    cardsInHand: state.cardsInHand.map(c => c.name),
    cardsDiscarded: state.cardsDiscarded.map(c => c.name),
    cardsDestroyed: state.cardsDestroyed.map(c => c.name),
    cardsOnBoard: state.cardsOnBoard.map(c => ({ name: c.name, duration: c.duration ?? 0 })),
    twoAbilitiesSelected: state.twoAbilitiesSelected.map(c => c.name),
    modifiersChosen: state.modifiersChosen.map(c => c.name),
    modifiersDrawPile: state.modifiersDrawPile.map(c => c.name),
    modifiersDiscardPile: state.modifiersDiscardPile.map(c => c.name),
    lastDrawnModifier: state.lastDrawnModifier?.name || null,
    gearChosen: state.gearChosen.map(i => ({
      name: i.name,
      played: !!i.played,
      lost: !!i.lost,
      used: i.used || 0,
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSavedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    state.turn = data.turn || 1;
    state.level = data.level || 1;

    if (data.abilityCategoryName) {
      state.abilityCategory = state.abilities.find(a => a.name === data.abilityCategoryName) || null;
    }

    state.abilitiesChosen = (data.abilitiesChosen || []).map(findAbilityByName).filter(Boolean);
    state.cardsInHand = (data.cardsInHand || []).map(findAbilityByName).filter(Boolean);
    state.cardsDiscarded = (data.cardsDiscarded || []).map(findAbilityByName).filter(Boolean);
    state.cardsDestroyed = (data.cardsDestroyed || []).map(findAbilityByName).filter(Boolean);
    state.cardsOnBoard = (data.cardsOnBoard || []).map(entry => {
      const card = findAbilityByName(entry.name);
      if (card) card.duration = entry.duration ?? 0;
      return card;
    }).filter(Boolean);
    state.twoAbilitiesSelected = (data.twoAbilitiesSelected || []).map(findAbilityByName).filter(Boolean);

    state.modifiersChosen = (data.modifiersChosen || []).map(findModifierByName).filter(Boolean);
    state.modifiersDrawPile = (data.modifiersDrawPile || []).map(findModifierByName).filter(Boolean);
    state.modifiersDiscardPile = (data.modifiersDiscardPile || []).map(findModifierByName).filter(Boolean);
    state.lastDrawnModifier = data.lastDrawnModifier ? findModifierByName(data.lastDrawnModifier) : null;

    state.gearChosen = (data.gearChosen || []).map(entry => {
      const item = findGearByName(entry.name);
      if (!item) return null;
      item.played = !!entry.played;
      item.lost = !!entry.lost;
      item.used = entry.used || 0;
      return item;
    }).filter(Boolean);

    updateBlessCurseCounts();
  } catch (e) {
    console.error('Failed to load deck state', e);
  }
}

/* ================= MODIFIERS ================= */

function initModifiers() {
  state.modifiersChosen = [...state.modifiersBase];
  state.modifiersDrawPile = [...state.modifiersChosen];
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;
  shuffle(state.modifiersDrawPile);
  updateBlessCurseCounts();
}

function drawModifier() {
  if (!state.modifiersDrawPile.length) return;

  if (state.lastDrawnModifier) {
    state.modifiersDiscardPile.unshift(state.lastDrawnModifier);
  }

  const card = state.modifiersDrawPile.shift();
  state.lastDrawnModifier = card;

  if (isCurse(card) || isBless(card)) {
    state.modifiersChosen = state.modifiersChosen.filter(c => c !== card);
  } else {
    state.modifiersDiscardPile.unshift(card);
  }

  updateBlessCurseCounts();

  if (isNull(card) || isTwoX(card)) {
    shuffleModifiers();
  }

  saveState();
  render();
}

function shuffleModifiers() {
  state.modifiersDrawPile = [...state.modifiersChosen];
  shuffle(state.modifiersDrawPile);
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;
  updateBlessCurseCounts();
  saveState();
  render();
}

function addSpecialModifier(kind) {
  const source = state.modifiersSpecial.find(s => s.name === kind);
  if (!source) return;
  const card = (source.cards || []).find(c => !state.modifiersChosen.includes(c));
  if (!card) return;

  state.modifiersChosen.push(card);
  state.modifiersDrawPile.push(card);
  shuffle(state.modifiersDrawPile);
  updateBlessCurseCounts();
  saveState();
  render();
}

/* ================= GEAR ================= */

function resetGearItem(item) {
  item.played = false;
  item.lost = false;
  item.used = 0;
}

function toggleGear(item) {
  if (!state.gearChosen.includes(item)) {
    resetGearItem(item);
    state.gearChosen.push(item);
  } else {
    state.gearChosen = state.gearChosen.filter(i => i !== item);
  }
  saveState();
  render();
}

function tapGear(item) {
  item.played = true;
  item.lost = false;
  item.used = 0;
  saveState();
  render();
}

function loseGear(item) {
  item.played = true;
  item.lost = true;
  item.used = 0;
  saveState();
  render();
}

function useGear(item) {
  item.used = (item.used || 0) + 1;
  saveState();
  render();
}

function restoreGear(item) {
  resetGearItem(item);
  saveState();
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
    turn: 1,
  });

  initModifiers();
  saveState();
  render();
}

function removeFromAllZones(card) {
  state.cardsInHand = state.cardsInHand.filter(c => c !== card);
  state.cardsDiscarded = state.cardsDiscarded.filter(c => c !== card);
  state.cardsDestroyed = state.cardsDestroyed.filter(c => c !== card);
  state.cardsOnBoard = state.cardsOnBoard.filter(c => c !== card);
  state.twoAbilitiesSelected = state.twoAbilitiesSelected.filter(c => c !== card);
}

function toggleAbility(card) {
  const idx = state.abilitiesChosen.indexOf(card);

  if (idx === -1) {
    if (state.abilityCategory && state.abilitiesChosen.length < state.abilityCategory.max) {
      state.abilitiesChosen.push(card);
      if (!state.cardsInHand.includes(card)) state.cardsInHand.push(card);
    }
  } else {
    state.abilitiesChosen.splice(idx, 1);
    removeFromAllZones(card);
  }

  saveState();
  render();
}

function toggleSelected(card) {
  const idx = state.twoAbilitiesSelected.indexOf(card);

  if (idx !== -1) state.twoAbilitiesSelected.splice(idx, 1);
  else if (state.twoAbilitiesSelected.length < 2) state.twoAbilitiesSelected.push(card);

  saveState();
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
  saveState();
  render();
}

function newGame() {
  state.cardsInHand = [...state.abilitiesChosen];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];
  state.cardsOnBoard = [];
  state.twoAbilitiesSelected = [];
  state.turn = 1;
  state.gearChosen.forEach(resetGearItem);
  shuffleModifiers();
  saveState();
  render();
}

/* ================= RENDER ================= */

function renderModifiers() {
  return `
    <div class="panel">
      <h2>Modifiers</h2>
      <div class="toolbar-actions">
        <button id="drawMod" class="btn">Draw</button>
        <button id="shuffleMod" class="btn">Shuffle</button>
        <button id="addBless" class="btn">+ Bless</button>
        <button id="addCurse" class="btn">+ Curse</button>
      </div>
      <p>Last: ${state.lastDrawnModifier?.name || 'None'}</p>
      <p>Deck: ${state.modifiersDrawPile.length} | Discard: ${state.modifiersDiscardPile.length}</p>
      <p>Blessings: ${state.blessings} | Curses: ${state.curses}</p>
    </div>
  `;
}

function renderGear() {
  if (!state.allGear.length) return '';

  const chosen = `
    <div class="panel">
      <h2>Chosen Gear</h2>
      ${(state.gearChosen.map(item => `
        <div class="gear-row">
          <div>${item.name} <span class="muted">used:${item.used || 0}</span></div>
          <div class="row-actions">
            <button class="btn small" data-gear-use="${item.name}">+1</button>
            <button class="btn small" data-gear-tap="${item.name}">Tap</button>
            <button class="btn small" data-gear-lose="${item.name}">Lose</button>
            <button class="btn small" data-gear-restore="${item.name}">Restore</button>
          </div>
        </div>
      `).join('')) || '<p class="muted">No gear selected</p>'}
    </div>
  `;

  const available = `
    <div class="panel">
      <h2>Gear</h2>
      ${state.allGear.map(cat => `
        <div>
          <h4>${cat.name}</h4>
          <div class="row-actions">
            ${cat.items.slice(0, 5).map(item => `<button class="btn small" data-gear="${item.name}">${item.name}</button>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  return chosen + available;
}

function render() {
  const root = document.getElementById('app');

  root.innerHTML = `
    <div class="deck-app">
      <h1>Deck</h1>
      <p>Turn: ${state.turn}</p>
      ${renderModifiers()}
      ${renderGear()}
      <div class="toolbar-actions">
        <button id="play" class="btn primary">Play Selected</button>
        <button id="newGame" class="btn">New Game</button>
        <button id="saveDeckState" class="btn">Save</button>
      </div>
    </div>
  `;

  bindEvents();
}

/* ================= EVENTS ================= */

function bindEvents() {
  document.getElementById('drawMod')?.addEventListener('click', drawModifier);
  document.getElementById('shuffleMod')?.addEventListener('click', shuffleModifiers);
  document.getElementById('addBless')?.addEventListener('click', () => addSpecialModifier(BLESS_NAME));
  document.getElementById('addCurse')?.addEventListener('click', () => addSpecialModifier(CURSE_NAME));

  document.querySelectorAll('[data-gear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findGearByName(btn.dataset.gear);
      if (item) toggleGear(item);
    });
  });

  document.querySelectorAll('[data-gear-use]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findGearByName(btn.dataset.gearUse);
      if (item) useGear(item);
    });
  });

  document.querySelectorAll('[data-gear-tap]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findGearByName(btn.dataset.gearTap);
      if (item) tapGear(item);
    });
  });

  document.querySelectorAll('[data-gear-lose]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findGearByName(btn.dataset.gearLose);
      if (item) loseGear(item);
    });
  });

  document.querySelectorAll('[data-gear-restore]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = findGearByName(btn.dataset.gearRestore);
      if (item) restoreGear(item);
    });
  });

  document.getElementById('play')?.addEventListener('click', playSelected);
  document.getElementById('newGame')?.addEventListener('click', newGame);
  document.getElementById('saveDeckState')?.addEventListener('click', saveState);
}

function init() {
  loadData();
  if (state.modifiersBase.length) initModifiers();
  loadSavedState();
  render();
}

document.addEventListener('DOMContentLoaded', init);
