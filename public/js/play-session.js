const root = document.getElementById("play-session-root");
const board = document.getElementById("session-board");

let state = {};
try {
  state = JSON.parse(root?.dataset.state || "{}");
} catch {
  state = {};
}

const sessionId = root?.dataset.sessionId || "";

function getCSRFToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

function render() {
  if (!board) return;
  board.innerHTML = "";

  (state.widgets || []).forEach((w) => {
    const el = document.createElement("div");
    el.className = "widget";
    el.style.left = `${w.x || 0}px`;
    el.style.top = `${w.y || 0}px`;
    el.style.width = `${w.width || w.w || 100}px`;
    el.style.height = `${w.height || w.h || 50}px`;
    el.textContent = w.type || "widget";
    board.appendChild(el);
  });
}

render();

document.getElementById("terminate-btn")?.addEventListener("click", async () => {
  await fetch(`/api/play/sessions/${sessionId}/terminate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CSRF-Token": getCSRFToken(),
              "Accept": "application/json"
    },
    body: JSON.stringify({ outcome: "completed" })
  });

  location.href = "/play";
});
