function getCSRF() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

async function api(url, method = "GET", body) {
    const opts = {
        method,
        headers: {
            "CSRF-Token": getCSRF()
        }
    };

    if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function esc(value) {
    return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderGames(tbody, games, emptyText) {
    if (!tbody) return;

    if (!Array.isArray(games) || games.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="muted">${esc(emptyText)}</td></tr>`;
        return;
    }

    tbody.innerHTML = games.map(game => `
    <tr>
    <td>${esc(game.title)}</td>
    <td>${esc(game.display_name || game.username)}</td>
    <td>${Number(game.current_users)}/${Number(game.max_users)}</td>
    </tr>
    `).join("");
}

async function loadGames() {
    const publicBody = document.getElementById("public-games-body");
    const privateBody = document.getElementById("private-games-body");

    try {
        const publicData = await api("/api/play/public-games");
        renderGames(publicBody, publicData.games, "No public games available.");
    } catch (err) {
        renderGames(publicBody, [], err.message);
    }

    try {
        const privateData = await api("/api/play/private-games");
        renderGames(privateBody, privateData.games, "No private games from friends are available.");
    } catch (err) {
        renderGames(privateBody, [], err.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
            document.querySelectorAll(".play-tab").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
        });
    });

    const createSessionForm = document.getElementById("create-session-form");
    if (createSessionForm) {
        createSessionForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const raw = Object.fromEntries(new FormData(createSessionForm));
            const payload = {
                title: raw.title,
                maxUsers: raw.maxUsers,
                isPrivate: !!raw.isPrivate
            };

            try {
                await api("/api/play/sessions", "POST", payload);
                createSessionForm.reset();
                await loadGames();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    loadGames();
    setInterval(loadGames, 15000);
});
