const input = document.getElementById('game-search');
const results = document.getElementById('game-search-results');
let selectedGame = null;

input?.addEventListener('input', async () => {
  const q = input.value.trim();
  if (!q) return results.innerHTML = '';

  const res = await fetch(`/api/play/games/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  results.innerHTML = data.games.map(g => `
    <div class="search-item" data-id="${g.id}">${g.title}</div>
  `).join('') + '<div class="search-item new">Don\'t see your Game?</div>';
});

results?.addEventListener('click', (e) => {
  const el = e.target.closest('.search-item');
  if (!el) return;

  if (el.classList.contains('new')) {
    document.getElementById('new-game-modal').hidden = false;
    return;
  }

  selectedGame = el.dataset.id;
  document.getElementById('selected-game-summary').innerText = el.textContent;
});

document.getElementById('host-game-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedGame) return alert('Select a game');
  const vis = document.getElementById('host-visibility').value;
  location.href = `/play/setup/${selectedGame}?visibility=${vis}`;
});

document.getElementById('new-game-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    bggUrl: form.bggUrl.value,
    minPlayers: form.minPlayers.value,
    maxPlayers: form.maxPlayers.value
  };

  const res = await fetch('/api/play/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.redirectUrl) location.href = data.redirectUrl;
});
