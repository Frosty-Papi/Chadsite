function getCSRFToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

async function parseJsonSafely(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

const input = document.getElementById("game-search");
const results = document.getElementById("game-search-results");
const selectedSummary = document.getElementById("selected-game-summary");
let selectedGame = null;
let searchTimer = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setSelectedGame(id, title) {
  selectedGame = id;
  if (selectedSummary) {
    selectedSummary.hidden = false;
    selectedSummary.innerHTML = `<strong>${escapeHtml(title)}</strong>`;
  }
  if (results) results.innerHTML = "";
}

input?.addEventListener("input", async () => {
  const q = input.value.trim();
  selectedGame = null;
  if (selectedSummary) {
    selectedSummary.hidden = true;
    selectedSummary.innerHTML = "";
  }

  clearTimeout(searchTimer);
  if (!q) {
    if (results) results.innerHTML = "";
    return;
  }

  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/play/games/search?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" }
      });
      const data = await parseJsonSafely(res);
      const games = Array.isArray(data.games) ? data.games : [];

      if (!results) return;
      results.innerHTML = games.map(g => `
        <button type="button" class="search-item" data-id="${g.id}" data-title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</button>
      `).join("") + '<button type="button" class="search-item new">Don\'t see your Game?</button>';
    } catch {
      if (results) results.innerHTML = '<div class="search-item">Search failed</div>';
    }
  }, 180);
});

results?.addEventListener("click", (e) => {
  const el = e.target.closest(".search-item");
  if (!el) return;

  if (el.classList.contains("new")) {
    const modal = document.getElementById("new-game-modal");
    if (modal) modal.hidden = false;
    return;
  }

  setSelectedGame(el.dataset.id, el.dataset.title || el.textContent || "");
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    const modal = document.getElementById("new-game-modal");
    if (modal) modal.hidden = true;
  });
});

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((node) => node.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.target)?.classList.add("active");
  });
});

document.getElementById("host-game-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedGame) return alert("Select a game");
  const vis = document.getElementById("host-visibility")?.value || "public";
  location.href = `/play/setup/${selectedGame}?visibility=${encodeURIComponent(vis)}`;
});

document.getElementById("new-game-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {
    bggUrl: form.bggUrl.value,
    minPlayers: form.minPlayers.value,
    maxPlayers: form.maxPlayers.value
  };

  const res = await fetch("/api/play/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CSRF-Token": getCSRFToken(),
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) {
    alert(data.error || "Failed to create game entry");
    return;
  }

  if (data.redirectUrl) location.href = data.redirectUrl;
});
