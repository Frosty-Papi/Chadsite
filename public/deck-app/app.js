// ONLY showing modified parts for brevity (full file replaced)

function renderClassButtons() {
  return `<div class="class-grid">${state.abilities.map((cat, i) => {
    const sample = cat.cards?.[0]?.image || '';
    const m = sample.match(/([a-z]{2})-/i);
    const code = m ? m[1].toLowerCase() : '';
    const icon = state.classIcons?.[code]
      ? deckData(state.classIcons[code])
      : '';

    return `
      <button class="image-card ${state.abilityCategory?.name === cat.name ? 'chosen' : ''}" data-class="${i}">
        ${icon ? `<img src="${icon}" class="ability-image">` : cat.name}
      </button>`;
  }).join('')}</div>`;
}

function renderAbilityPool() {
  if (!state.abilityCategory) return '<p class="muted empty-help">Choose a class to build a deck.</p>';
  return `<div class="image-grid ability-grid">${(state.abilityCategory.cards || [])
    .filter(card => card.level <= state.level && !/-back\./i.test(card.image))
    .map(card => `<button class="image-card ${state.abilitiesChosen.includes(card) ? 'chosen' : ''}" data-add="${card.name}"><img src="${cardImg(card)}" class="ability-image"></button>`)
    .join('')}</div>`;
}

function renderBattleGoals() {
  if (!state.battleGoals.length) return '';
  return `<section class="panel"><h2>Battle Goals</h2>
    <div class="battle-goal-row">
      <div class="battle-goal-card" id="drawGoals">
        <img src="${deckData('battle-goals/battlegoal-back.png')}">
      </div>
      ${state.battleGoalsDrawn.map(g => `<div class="battle-goal-card" data-pick-goal="${g.name}"><img src="${deckData(g.image)}"></div>`).join('')}
      ${state.battleGoalPicked.map(g => `<div class="battle-goal-card"><img src="${deckData(g.image)}"><div class="counter-badge">${state.goalCounter}</div></div>`).join('')}
    </div>
    <div class="row-actions"><button id="incGoal" class="btn">+1</button></div>
  </section>`;
}

function render() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="deck-toolbar">
      <div><h1>Gloomhaven Deckbuilder</h1></div>
      <div class="toolbar-actions">
        <button id="newGame" class="btn">New game</button>
      </div>
    </div>
    <section class="panel"><h2>Classes</h2>${renderClassButtons()}</section>
    <section class="panel"><h2>Abilities</h2>${renderAbilityPool()}</section>
    <div class="deck-main-layout">
      <div class="left-column">...</div>
      <div class="right-column">
        ${renderModifiers()}
        ${renderBattleGoals()}
        ${renderGear()}
      </div>
    </div>`;
  bindEvents();
}

function init() {
  loadData();
  Promise.all([
    fetch('/api/deck/battle-goals').then(r=>r.json()),
    fetch('/api/deck/class-icons').then(r=>r.json())
  ]).then(([bg, ci]) => {
    state.battleGoals = bg.battleGoals || [];
    state.classIcons = ci.classIcons || {};
  }).finally(()=>{
    if (state.modifiersBase.length) initModifiers();
    loadSavedState();
    render();
  });
}
