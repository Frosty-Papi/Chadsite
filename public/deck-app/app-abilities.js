import { state } from './state.js';

const STORAGE_KEY = 'deck_modern_abilities_only_v1';
const EXPANSIONS = [
  { id: 'vanilla', label: 'Gloomhaven' },
  { id: 'jotl', label: 'Jaws of the Lion' },
  { id: 'frosthaven', label: 'Frosthaven' },
  { id: 'crimsonscales', label: 'Crimson Scales' },
  { id: 'trailofashes', label: 'Trail of Ashes' },
];

function deckData(path) {
  return `/deck-assets/data/${path}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uid(card) {
  return card?.name || card?.image || Math.random().toString(36).slice(2);
}

function cardImg(card) {
  return card?.image ? deckData(card.image) : '';
}

function cloneCard(card) {
  return {
    ...card,
    top: card.top ?? '',
    bottom: card.bottom ?? '',
    duration: 0,
    numberOfTimesUsed: 0,
  };
}

function cleanRemovedDomains() {
  state.modifiers = [];
  state.modifiersBase = [];
  state.modifiersSpecial = [];
  state.modifiersChosen = [];
  state.modifiersDrawPile = [];
  state.modifiersDiscardPile = [];
  state.lastDrawnModifier = null;
  state.perks = [];
  state.perkDefinitions = [];
  state.allGear = [];
  state.gearChosen = [];
  state.battleGoals = [];
  state.battleGoalsDrawn = [];
  state.battleGoalPicked = [];
}

function loadExpansionData(expansion) {
  state.expansion = expansion;
  switch (expansion) {
    case 'jotl':
      state.abilities = window.abilities_jotl || [];
      state.classNames = window.classNames_jotl || {};
      break;
    case 'frosthaven':
      state.abilities = window.abilities_frosthaven || [];
      state.classNames = window.classNames_frosthaven || {};
      break;
    case 'crimsonscales':
      state.abilities = window.abilities_cs || [];
      state.classNames = window.classNames_cs || {};
      break;
    case 'trailofashes':
      state.abilities = window.abilities_toa || [];
      state.classNames = window.classNames_toa || {};
      break;
    case 'vanilla':
    default:
      state.expansion = 'vanilla';
      state.abilities = window.abilities || [];
      state.classNames = window.classNames || {};
      break;
  }
  state.availableExpansions = EXPANSIONS.map(e => e.id);
  cleanRemovedDomains();
}

function resetRuntimeZones() {
  state.cardsInHand = [...state.abilitiesChosen];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];
  state.cardsOnBoard = [];
  state.twoAbilitiesSelected = [];
  state.turn = 1;
  state.isRestDisabled = true;
  state.longRestSelection = null;
  state.pendingShortRestLoss = null;
}

function initState() {
  state.menu = 'build';
  state.dark = state.dark ?? true;
  state.abilityCategory = null;
  state.abilitiesChosen = [];
  state.cardsInHand = [];
  state.cardsDiscarded = [];
  state.cardsDestroyed = [];
  state.cardsOnBoard = [];
  state.twoAbilitiesSelected = [];
  state.turn = 1;
  state.level = 1;
  state.enhancementSelections = {};
  state.enhancementEditingCard = null;
  state.longRestSelection = null;
  state.pendingShortRestLoss = null;
  cleanRemovedDomains();
}

function findCard(name) {
  for (const cat of state.abilities || []) {
    const found = (cat.cards || []).find(card => card.name === name);
    if (found) return found;
  }
  return null;
}

function selectedCardNames() {
  return new Set(state.abilitiesChosen.map(card => card.name));
}

function saveState() {
  const data = {
    expansion: state.expansion,
    menu: state.menu,
    dark: state.dark,
    level: state.level,
    abilityCategoryName: state.abilityCategory?.name || null,
    abilitiesChosen: state.abilitiesChosen.map(card => card.name),
    cardsInHand: state.cardsInHand.map(card => card.name),
    cardsDiscarded: state.cardsDiscarded.map(card => card.name),
    cardsDestroyed: state.cardsDestroyed.map(card => card.name),
    cardsOnBoard: state.cardsOnBoard.map(card => ({
      name: card.name,
      duration: card.duration ?? 0,
      numberOfTimesUsed: card.numberOfTimesUsed ?? 0,
    })),
    twoAbilitiesSelected: state.twoAbilitiesSelected.map(card => card.name),
    turn: state.turn,
    enhancementSelections: state.enhancementSelections || {},
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resolveCardList(names) {
  return (names || []).map(name => {
    const base = findCard(name);
    return base ? cloneCard(base) : null;
  }).filter(Boolean);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    loadExpansionData(data.expansion || 'vanilla');
    state.dark = data.dark ?? true;
    state.menu = data.menu || 'build';
    state.level = data.level || 1;
    state.enhancementSelections = data.enhancementSelections || {};
    state.abilityCategory = (state.abilities || []).find(cat => cat.name === data.abilityCategoryName) || null;
    state.abilitiesChosen = resolveCardList(data.abilitiesChosen);
    state.cardsInHand = resolveCardList(data.cardsInHand);
    state.cardsDiscarded = resolveCardList(data.cardsDiscarded);
    state.cardsDestroyed = resolveCardList(data.cardsDestroyed);
    state.cardsOnBoard = (data.cardsOnBoard || []).map(entry => {
      const base = findCard(entry.name);
      if (!base) return null;
      const card = cloneCard(base);
      card.duration = entry.duration ?? 0;
      card.numberOfTimesUsed = entry.numberOfTimesUsed ?? 0;
      return card;
    }).filter(Boolean);
    state.twoAbilitiesSelected = resolveCardList(data.twoAbilitiesSelected);
    state.turn = data.turn || 1;
    cleanRemovedDomains();
    recomputeRestDisabled();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function clearSave() {
  localStorage.removeItem(STORAGE_KEY);
  initState();
  loadExpansionData('vanilla');
  render();
}

function removeFrom(zone, card) {
  const index = zone.findIndex(c => c.name === card.name);
  if (index !== -1) zone.splice(index, 1);
}

function hasCard(zone, card) {
  return zone.some(c => c.name === card.name);
}

function recomputeRestDisabled() {
  state.isRestDisabled = state.cardsDiscarded.length < 2;
}

function setExpansion(expansion) {
  loadExpansionData(expansion);
  state.abilityCategory = null;
  state.abilitiesChosen = [];
  resetRuntimeZones();
  saveState();
  render();
}

function chooseClass(category) {
  if (state.abilityCategory?.name === category.name) return;
  if (state.abilitiesChosen.length || state.cardsInHand.length || state.cardsDiscarded.length || state.cardsDestroyed.length || state.cardsOnBoard.length) {
    const ok = window.confirm('Changing classes clears your current ability deck and play state. Continue?');
    if (!ok) return;
  }
  state.abilityCategory = category;
  state.abilitiesChosen = [];
  resetRuntimeZones();
  state.menu = 'build';
  saveState();
  render();
}

function toggleAbility(card) {
  if (!state.abilityCategory) return;
  if (hasCard(state.abilitiesChosen, card)) {
    removeFrom(state.abilitiesChosen, card);
    [state.cardsInHand, state.cardsDiscarded, state.cardsDestroyed, state.cardsOnBoard, state.twoAbilitiesSelected].forEach(zone => removeFrom(zone, card));
  } else {
    const max = state.abilityCategory.max || 99;
    if (state.abilitiesChosen.length >= max) {
      window.alert(`This class can bring ${max} ability cards.`);
      return;
    }
    const copy = cloneCard(card);
    state.abilitiesChosen.push(copy);
    state.cardsInHand.push(copy);
  }
  recomputeRestDisabled();
  saveState();
  render();
}

function newScenario() {
  resetRuntimeZones();
  saveState();
  render();
}

function selectForTurn(card) {
  if (!hasCard(state.cardsInHand, card)) return;
  if (hasCard(state.twoAbilitiesSelected, card)) {
    removeFrom(state.twoAbilitiesSelected, card);
  } else if (state.twoAbilitiesSelected.length < 2) {
    state.twoAbilitiesSelected.push(card);
  } else {
    window.alert('Select exactly two cards for the turn.');
  }
  saveState();
  render();
}

function playSelectedCards() {
  if (state.twoAbilitiesSelected.length !== 2) {
    window.alert('Select two cards from your hand first.');
    return;
  }
  state.twoAbilitiesSelected.forEach(card => {
    removeFrom(state.cardsInHand, card);
    state.cardsDiscarded.push(card);
  });
  state.twoAbilitiesSelected = [];
  tickActiveCards();
  state.turn += 1;
  recomputeRestDisabled();
  saveState();
  render();
}

function discardCard(card) {
  [state.cardsInHand, state.cardsOnBoard].forEach(zone => removeFrom(zone, card));
  if (!hasCard(state.cardsDiscarded, card)) state.cardsDiscarded.push(card);
  card.duration = 0;
  recomputeRestDisabled();
  saveState();
  render();
}

function loseCard(card) {
  [state.cardsInHand, state.cardsDiscarded, state.cardsOnBoard, state.twoAbilitiesSelected].forEach(zone => removeFrom(zone, card));
  if (!hasCard(state.cardsDestroyed, card)) state.cardsDestroyed.push(card);
  recomputeRestDisabled();
  saveState();
  render();
}

function recoverCard(card) {
  [state.cardsDiscarded, state.cardsDestroyed, state.cardsOnBoard, state.twoAbilitiesSelected].forEach(zone => removeFrom(zone, card));
  if (!hasCard(state.cardsInHand, card)) state.cardsInHand.push(card);
  recomputeRestDisabled();
  saveState();
  render();
}

function makeActive(card, duration) {
  removeFrom(state.cardsDiscarded, card);
  removeFrom(state.cardsInHand, card);
  card.duration = duration;
  card.numberOfTimesUsed = card.numberOfTimesUsed || 0;
  if (!hasCard(state.cardsOnBoard, card)) state.cardsOnBoard.push(card);
  recomputeRestDisabled();
  saveState();
  render();
}

function useActive(card) {
  card.numberOfTimesUsed = (card.numberOfTimesUsed || 0) + 1;
  saveState();
  render();
}

function tickActiveCards() {
  for (let i = state.cardsOnBoard.length - 1; i >= 0; i -= 1) {
    const card = state.cardsOnBoard[i];
    if (card.duration > 0) {
      card.duration -= 1;
      if (card.duration === 0) {
        state.cardsOnBoard.splice(i, 1);
        state.cardsDiscarded.push(card);
      }
    }
  }
}

function shortRest() {
  if (state.cardsDiscarded.length < 2) {
    window.alert('You need at least two discarded cards to short rest.');
    return;
  }
  const lost = state.cardsDiscarded[Math.floor(Math.random() * state.cardsDiscarded.length)];
  removeFrom(state.cardsDiscarded, lost);
  state.cardsDestroyed.push(lost);
  state.cardsInHand.push(...state.cardsDiscarded);
  state.cardsDiscarded = [];
  state.turn += 1;
  recomputeRestDisabled();
  saveState();
  window.alert(`${lost.name} was lost during the short rest.`);
  render();
}

function longRest(cardToLose) {
  if (state.cardsDiscarded.length < 2) {
    window.alert('You need at least two discarded cards to long rest.');
    return;
  }
  const card = cardToLose || state.cardsDiscarded[0];
  removeFrom(state.cardsDiscarded, card);
  state.cardsDestroyed.push(card);
  state.cardsInHand.push(...state.cardsDiscarded);
  state.cardsDiscarded = [];
  state.turn += 1;
  tickActiveCards();
  recomputeRestDisabled();
  saveState();
  render();
}

function editEnhancement(cardName, side) {
  const current = state.enhancementSelections?.[cardName]?.[side] || '';
  const value = window.prompt(`Enhancement for ${cardName} (${side})`, current);
  if (value === null) return;
  state.enhancementSelections[cardName] = {
    ...(state.enhancementSelections[cardName] || {}),
    [side]: value.trim(),
  };
  saveState();
  render();
}

function renderCard(card, zone) {
  const selected = hasCard(state.twoAbilitiesSelected, card) ? ' selected' : '';
  const enhancement = state.enhancementSelections?.[card.name] || {};
  const img = cardImg(card);
  return `
    <article class="play-card selected-deck-card${selected}" data-card="${escapeHtml(card.name)}" data-zone="${zone}">
      ${img ? `<img class="ability-image" src="${escapeHtml(img)}" alt="${escapeHtml(card.name)}">` : `<strong>${escapeHtml(card.name)}</strong>`}
      <div class="card-actions">
        ${zone === 'hand' ? `<button class="btn mini" data-action="select">${selected ? 'Unselect' : 'Select'}</button><button class="btn mini" data-action="discard">Discard</button><button class="btn mini" data-action="lose">Lose</button>` : ''}
        ${zone === 'discard' ? `<button class="btn mini" data-action="recover">Recover</button><button class="btn mini" data-action="active1">1 Round</button><button class="btn mini" data-action="activePersist">Persistent</button><button class="btn mini" data-action="lose">Lose</button>` : ''}
        ${zone === 'lost' ? `<button class="btn mini" data-action="recover">Recover</button>` : ''}
        ${zone === 'active' ? `<button class="btn mini" data-action="use">Use</button><button class="btn mini" data-action="discard">Discard</button><button class="btn mini" data-action="lose">Lose</button>` : ''}
        <button class="btn mini" data-action="enhanceTop">Enhance Top</button>
        <button class="btn mini" data-action="enhanceBottom">Enhance Bottom</button>
      </div>
      ${(enhancement.top || enhancement.bottom) ? `<p class="muted">${enhancement.top ? `Top: ${escapeHtml(enhancement.top)} ` : ''}${enhancement.bottom ? `Bottom: ${escapeHtml(enhancement.bottom)}` : ''}</p>` : ''}
      ${zone === 'active' ? `<p class="muted">Duration: ${card.duration < 0 ? 'Persistent' : card.duration} · Uses: ${card.numberOfTimesUsed || 0}</p>` : ''}
    </article>
  `;
}

function renderClassPicker() {
  return `
    <section class="panel compact-panel">
      <div class="split-head">
        <div>
          <h2>Class</h2>
          <p class="muted">Choose an expansion, pick a class, then build an ability deck.</p>
        </div>
        <select id="expansionSelect">
          ${EXPANSIONS.map(exp => `<option value="${exp.id}" ${state.expansion === exp.id ? 'selected' : ''}>${exp.label}</option>`).join('')}
        </select>
      </div>
      <div class="class-grid">
        ${(state.abilities || []).map(cat => `<button class="btn small ${state.abilityCategory?.name === cat.name ? 'active' : ''}" data-class="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}${cat.max ? ` (${cat.max})` : ''}</button>`).join('')}
      </div>
    </section>
  `;
}

function renderBuildPage() {
  const selected = selectedCardNames();
  const cards = state.abilityCategory?.cards || [];
  return `
    <main class="app-content page-shell">
      ${renderClassPicker()}
      <section class="panel">
        <div class="split-head">
          <div>
            <h2>Build Ability Deck</h2>
            <p class="muted">${state.abilityCategory ? `${state.abilityCategory.name}: ${state.abilitiesChosen.length}/${state.abilityCategory.max || '∞'} selected` : 'Select a class to begin.'}</p>
          </div>
          <div class="row-actions wrap">
            <button class="btn" id="newScenario">Reset Scenario</button>
            <button class="btn primary" id="goPlay">Play</button>
          </div>
        </div>
        <div class="image-grid ability-pool">
          ${cards.map(card => `<button class="image-card ${selected.has(card.name) ? 'chosen' : ''}" data-add-card="${escapeHtml(card.name)}">${card.image ? `<img class="ability-image" src="${escapeHtml(cardImg(card))}" alt="${escapeHtml(card.name)}">` : escapeHtml(card.name)}</button>`).join('')}
        </div>
      </section>
    </main>
  `;
}

function renderZone(title, zone, cards) {
  return `
    <section class="panel">
      <h2>${title} <span class="muted">${cards.length}</span></h2>
      <div class="play-strip">${cards.map(card => renderCard(card, zone)).join('') || '<p class="muted">Empty</p>'}</div>
    </section>
  `;
}

function renderPlayPage() {
  return `
    <main class="app-content page-shell">
      <section class="panel compact-panel">
        <div class="split-head">
          <div>
            <h1>${escapeHtml(state.abilityCategory?.name || 'Ability Deck')}</h1>
            <p class="muted">Turn ${state.turn} · Selected ${state.twoAbilitiesSelected.length}/2</p>
          </div>
          <div class="row-actions wrap">
            <button class="btn primary" id="playTurn">Play Selected</button>
            <button class="btn" id="shortRest" ${state.cardsDiscarded.length < 2 ? 'disabled' : ''}>Short Rest</button>
            <button class="btn" id="longRest" ${state.cardsDiscarded.length < 2 ? 'disabled' : ''}>Long Rest</button>
            <button class="btn" id="goBuild">Build</button>
          </div>
        </div>
      </section>
      ${renderZone('Hand', 'hand', state.cardsInHand)}
      ${renderZone('Active / On Board', 'active', state.cardsOnBoard)}
      ${renderZone('Discard', 'discard', state.cardsDiscarded)}
      ${renderZone('Lost', 'lost', state.cardsDestroyed)}
    </main>
  `;
}

function renderEnhancementPage() {
  const cards = state.abilitiesChosen;
  return `
    <main class="app-content page-shell">
      <section class="panel">
        <div class="split-head">
          <div>
            <h2>Enhancements</h2>
            <p class="muted">Enhancements are saved per ability card and do not interact with modifiers, perks, items, or battle goals.</p>
          </div>
          <button class="btn" id="goBuildFromEnhancements">Build</button>
        </div>
        <div class="enhancement-grid">
          ${cards.map(card => {
            const e = state.enhancementSelections?.[card.name] || {};
            return `<div class="panel compact-panel"><h3>${escapeHtml(card.name)}</h3>${card.image ? `<img class="enhancement-preview-card" src="${escapeHtml(cardImg(card))}" alt="${escapeHtml(card.name)}">` : ''}<p class="muted">Top: ${escapeHtml(e.top || 'None')}</p><p class="muted">Bottom: ${escapeHtml(e.bottom || 'None')}</p><div class="card-actions"><button class="btn mini" data-enhance-card="${escapeHtml(card.name)}" data-side="top">Edit Top</button><button class="btn mini" data-enhance-card="${escapeHtml(card.name)}" data-side="bottom">Edit Bottom</button></div></div>`;
          }).join('') || '<p class="muted">Choose ability cards first.</p>'}
        </div>
      </section>
    </main>
  `;
}

function render() {
  cleanRemovedDomains();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="deck-app ${state.dark ? 'theme-dark' : 'theme-light'}">
      <nav class="deck-navbar">
        <div class="navbar-brand-wrap"><a class="navbar-brand-link" href="/">ChadBroChill</a><span class="navbar-title">Deck Modern</span></div>
        <div class="navbar-links">
          <button class="nav-link-btn ${state.menu === 'build' ? 'active' : ''}" data-menu="build">Build</button>
          <button class="nav-link-btn ${state.menu === 'play' ? 'active' : ''}" data-menu="play">Play</button>
          <button class="nav-link-btn ${state.menu === 'enhancements' ? 'active' : ''}" data-menu="enhancements">Enhancements</button>
          <button class="nav-link-btn" id="themeToggle">${state.dark ? 'Light' : 'Dark'}</button>
          <button class="nav-link-btn" id="clearSave">Clear Save</button>
        </div>
      </nav>
      ${state.menu === 'play' ? renderPlayPage() : state.menu === 'enhancements' ? renderEnhancementPage() : renderBuildPage()}
    </div>
  `;
  bindEvents();
}

function cardFromButton(button) {
  const article = button.closest('[data-card]');
  if (!article) return null;
  const name = article.dataset.card;
  const zones = [state.cardsInHand, state.cardsDiscarded, state.cardsDestroyed, state.cardsOnBoard, state.abilitiesChosen];
  for (const zone of zones) {
    const found = zone.find(card => card.name === name);
    if (found) return found;
  }
  return null;
}

function bindEvents() {
  document.querySelectorAll('[data-menu]').forEach(button => {
    button.addEventListener('click', () => {
      state.menu = button.dataset.menu;
      saveState();
      render();
    });
  });

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    state.dark = !state.dark;
    saveState();
    render();
  });

  document.getElementById('clearSave')?.addEventListener('click', () => {
    if (window.confirm('Clear saved deck-modern ability state?')) clearSave();
  });

  document.getElementById('expansionSelect')?.addEventListener('change', event => setExpansion(event.target.value));

  document.querySelectorAll('[data-class]').forEach(button => {
    button.addEventListener('click', () => {
      const cat = (state.abilities || []).find(item => item.name === button.dataset.class);
      if (cat) chooseClass(cat);
    });
  });

  document.querySelectorAll('[data-add-card]').forEach(button => {
    button.addEventListener('click', () => {
      const card = (state.abilityCategory?.cards || []).find(item => item.name === button.dataset.addCard);
      if (card) toggleAbility(card);
    });
  });

  document.getElementById('goPlay')?.addEventListener('click', () => {
    state.menu = 'play';
    saveState();
    render();
  });

  document.getElementById('goBuild')?.addEventListener('click', () => {
    state.menu = 'build';
    saveState();
    render();
  });

  document.getElementById('goBuildFromEnhancements')?.addEventListener('click', () => {
    state.menu = 'build';
    saveState();
    render();
  });

  document.getElementById('newScenario')?.addEventListener('click', newScenario);
  document.getElementById('playTurn')?.addEventListener('click', playSelectedCards);
  document.getElementById('shortRest')?.addEventListener('click', shortRest);
  document.getElementById('longRest')?.addEventListener('click', () => {
    const names = state.cardsDiscarded.map(card => card.name).join('\n');
    const choice = window.prompt(`Type the exact card name to lose:\n${names}`, state.cardsDiscarded[0]?.name || '');
    const card = state.cardsDiscarded.find(item => item.name === choice);
    if (card) longRest(card);
  });

  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => {
      const card = cardFromButton(button);
      if (!card) return;
      switch (button.dataset.action) {
        case 'select': return selectForTurn(card);
        case 'discard': return discardCard(card);
        case 'lose': return loseCard(card);
        case 'recover': return recoverCard(card);
        case 'active1': return makeActive(card, 1);
        case 'activePersist': return makeActive(card, -1);
        case 'use': return useActive(card);
        case 'enhanceTop': return editEnhancement(card.name, 'top');
        case 'enhanceBottom': return editEnhancement(card.name, 'bottom');
        default: return undefined;
      }
    });
  });

  document.querySelectorAll('[data-enhance-card]').forEach(button => {
    button.addEventListener('click', () => editEnhancement(button.dataset.enhanceCard, button.dataset.side));
  });
}

function init() {
  initState();
  if (!loadState()) loadExpansionData('vanilla');
  render();
}

init();
