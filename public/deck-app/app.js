// ONLY replacing render() and layout helpers

function render(){
  const root = document.getElementById('app');
  if(!root) return;

  root.innerHTML = `
  <div class="deck-app shell">

    <div class="deck-toolbar">
      <div>
        <h1>Deck</h1>
        <p class="muted">Turn ${state.turn} · ${state.abilityCategory?.name || 'No Class'} · ${state.abilitiesChosen.length}/${state.abilityCategory?.max || 0}</p>
      </div>
      <div class="toolbar-actions">
        <button id="play" class="btn primary">Play</button>
        <button id="shortRest" class="btn">Rest</button>
        <button id="newGame" class="btn">New</button>
      </div>
    </div>

    <div class="deck-main-layout">

      <div class="left-column">

        <h2 class="play-section-title">Classes</h2>
        ${renderClassButtons()}

        <h2 class="play-section-title">Abilities</h2>
        ${renderAbilityPool()}

        <h2 class="play-section-title">Hand</h2>
        <div class="play-strip">
          ${renderZone('Hand', state.cardsInHand, 'pick')}
        </div>

        <h2 class="play-section-title">Discard</h2>
        ${renderZone('Discard', state.cardsDiscarded)}

        <h2 class="play-section-title">Lost</h2>
        ${renderZone('Destroyed', state.cardsDestroyed)}

        <h2 class="play-section-title">Active</h2>
        ${renderZone('On Board', state.cardsOnBoard)}

      </div>

      <div class="right-column">
        ${renderModifiers()}
        ${renderGear()}
      </div>

    </div>

  </div>`;

  bindEvents();
}
