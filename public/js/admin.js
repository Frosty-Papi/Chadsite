// =====================
// CSRF + API
// =====================
function getCSRF() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

async function api(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "CSRF-Token": getCSRF()
        },
        body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || "Request failed");

    return data;
}

// =====================
// STATE
// =====================
let STATE = { users: [], services: [] };

// =====================
// SOCKET
// =====================
let ws;

function connectWS() {
    ws = new WebSocket(`ws://${location.host}`);

    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === "admin:state") {
            STATE = msg;
            render();
        }
    };

    ws.onclose = () => setTimeout(connectWS, 2000);
}

// =====================
// RENDER
// =====================
function render() {
    renderUsers();
    renderServices();
}

function renderUsers() {
    const table = document.getElementById("user-table");
    if (!table) return;

    table.innerHTML = "";

    STATE.users.forEach(u => {
        const tr = document.createElement("tr");
        tr.dataset.id = u.id;

        const status = u.is_disabled
            ? "Disabled"
            : u.must_reset_password
                ? "Reset Required"
                : "Active";

        tr.innerHTML = `
        <td>${escapeHtml(u.username)}</td>
        <td>
            <select class="role-select" data-id="${u.id}">
                <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
        </td>
        <td class="status-cell">${status}</td>
        <td>
            <button data-id="${u.id}" class="disable-btn">Disable</button>
            <button data-id="${u.id}" class="enable-btn">Enable</button>
            <button data-id="${u.id}" class="reset-btn">Reset</button>
            <button data-id="${u.id}" class="delete-btn">Delete</button>
        </td>`;

        table.appendChild(tr);
    });
}

function renderServices() {
    const el = document.getElementById("service-list");
    if (!el) return;

    el.innerHTML = "";

    STATE.services.forEach(s => {
        const row = document.createElement("div");
        row.className = "service-row";
        row.dataset.id = s.id;

        row.innerHTML = `
        <span>${escapeHtml(s.name)}</span>
        <span>${escapeHtml(s.path)}</span>
        <span>(${s.min_role})</span>
        <button data-id="${s.id}" class="delete-service-btn">Delete</button>`;

        el.appendChild(row);
    });
}

// =====================
// HELPERS
// =====================
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

// =====================
// INIT
// =====================
document.addEventListener("DOMContentLoaded", async () => {

    connectWS();

    // fallback load
    try {
        const res = await fetch("/api/admin/state");
        STATE = await res.json();
        render();
    } catch {}

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-id]");
        if (!btn) return;

        const id = btn.dataset.id;

        if (btn.classList.contains("disable-btn")) await api("/admin/user/disable", { userId: id });
        if (btn.classList.contains("enable-btn")) await api("/admin/user/enable", { userId: id });
        if (btn.classList.contains("delete-btn")) await api("/admin/user/delete", { userId: id });
        if (btn.classList.contains("reset-btn")) await api("/admin/user/reset-password", { userId: id });
        if (btn.classList.contains("delete-service-btn")) await api("/admin/service/delete", { serviceId: id });
    });

    document.addEventListener("change", async (e) => {
        if (!e.target.classList.contains("role-select")) return;

        await api("/admin/user/role", {
            userId: e.target.dataset.id,
            role: e.target.value
        });
    });
});
