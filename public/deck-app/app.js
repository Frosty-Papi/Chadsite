import { state } from './state.js';

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <div class="deck-app">
      <h1>Deck (Rebuild in progress)</h1>
      <p>Menu: ${state.menu}</p>
      <p>Turn: ${state.turn}</p>
    </div>
  `;
}

function init() {
  render();
}

document.addEventListener('DOMContentLoaded', init);
