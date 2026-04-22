import { state, setState } from './state.js';

function loadData() {
  if (window.abilities) setState({ abilities: window.abilities });
  if (window.attack_modifiers_categories) setState({ modifiers: window.attack_modifiers_categories });
  if (window.allItems) setState({ gear: window.allItems });
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <div class="deck-app">
      <h1>Deck (Rebuild in progress)</h1>
      <p>Abilities loaded: ${state.abilities.length}</p>
      <p>Modifiers loaded: ${state.modifiers.length}</p>
      <p>Gear loaded: ${state.gear.length}</p>
    </div>
  `;
}

function init() {
  loadData();
  render();
}

document.addEventListener('DOMContentLoaded', init);
