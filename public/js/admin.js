(() => {

    // =====================
    // STATE
    // =====================
    const state = {
        users: [],
        services: [],
        socket: null,
        reconnectTimer: null,
        activeTab: "users",
        editingServiceId: null,
        search: ""
    };

    // =====================
    // CSRF + API
    // =====================
    function getCSRF() {
        return document.querySelector('meta[name="csrf-token"]')?.content || "";
    }

    async function api(url, body = {}) {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "CSRF-Token": getCSRF()
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            console.error("API ERROR:", url, data);
            showToast(data.error || "Request failed", "error");
            throw new Error(data.error || "Request failed");
        }

        return data;
    }

    // =====================
    // SOCKET
    // =====================
    function connectWS() {
        if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) {
            return;
        }

        const protocol = location.protocol === "https:" ? "wss:" : "ws:";
        state.socket = new WebSocket(`${protocol}//${location.host}`);

        state.socket.onopen = () => showConnectionState("live");

        state.socket.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === "admin:state") {
                    applyState(msg);
                }
            } catch {}
        };

        state.socket.onclose = () => {
            showConnectionState("reconnecting");
            scheduleReconnect();
        };

        state.socket.onerror = () => {
            showConnectionState("offline");
        };
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) return;

        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            connectWS();
        }, 2000);
    }

    // =====================
    // CONNECTION UI
    // =====================
    function showConnectionState(status) {
        let el = document.getElementById("admin-live-status");
        const panel = document.querySelector(".profile-panel");

        if (!el && panel) {
            el = document.createElement("div");
            el.id = "admin-live-status";
            el.className = "admin-live-status";
            panel.appendChild(el);
        }

        if (!el) return;

        const map = {
            live: "🟢 Live",
            reconnecting: "🔴 Reconnecting",
            offline: "⚫ Offline"
        };

        el.textContent = map[status] || map.offline;
    }

    // =====================
    // STATE MANAGEMENT
    // =====================
    async function loadState() {
        const res = await fetch("/api/admin/state");
        const data = await res.json();
        applyState(data);
    }

    function applyState(data) {
        state.users = data.users || [];
        state.services = data.services || [];
        render();
    }

    function syncSoon() {
        setTimeout(() => loadState().catch(() => {}), 250);
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

        state.users.forEach(user => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
            <td>${escape(user.username)}</td>
            <td>
            <select class="role-select" data-id="${user.id}">
            <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
            </td>
            <td>${status(user)}</td>
            <td>
            <button class="disable-btn" data-id="${user.id}">Disable</button>
            <button class="enable-btn" data-id="${user.id}">Enable</button>
            <button class="reset-btn" data-id="${user.id}">Reset</button>
            <button class="force-reset-btn" data-id="${user.id}">Force Reset</button>
            <button class="delete-btn" data-id="${user.id}">Delete</button>
            </td>
            `;

            table.appendChild(tr);
        });
    }

    function renderServices() {
        const el = document.getElementById("service-list");
        if (!el) return;

        el.innerHTML = "";

        state.services.forEach(s => {
            const div = document.createElement("div");
            div.className = "service-row";

            div.innerHTML = `
            <span>${escape(s.name)}</span>
            <span>${escape(s.path)}</span>
            <span>(${s.min_role})</span>
            <button class="edit-service-btn" data-id="${s.id}">Edit</button>
            <button class="delete-service-btn" data-id="${s.id}">Delete</button>
            `;

            el.appendChild(div);
        });
    }

    function status(u) {
        if (u.is_disabled) return "Disabled";
        if (u.must_reset_password) return "Reset Required";
        return "Active";
    }

    function escape(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[c]));
    }

    // =====================
    // EVENTS
    // =====================
    function bindEvents() {

        document.addEventListener("click", async (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            const id = btn.dataset.id;

            try {
                if (btn.classList.contains("disable-btn")) {
                    await api("/admin/user/disable", { userId: id });
                }

                if (btn.classList.contains("enable-btn")) {
                    await api("/admin/user/enable", { userId: id });
                }

                if (btn.classList.contains("reset-btn")) {
                    const res = await api("/admin/user/reset-password", { userId: id });
                    alert("OTP: " + res.password);
                }

                if (btn.classList.contains("force-reset-btn")) {
                    await api("/admin/user/force-reset", { userId: id });
                }

                if (btn.classList.contains("delete-btn")) {
                    if (confirm("Delete user?")) {
                        await api("/admin/user/delete", { userId: id });
                    }
                }

                if (btn.classList.contains("delete-service-btn")) {
                    if (confirm("Delete service?")) {
                        await api("/admin/service/delete", { serviceId: id });
                    }
                }

                syncSoon();

            } catch {}
        });

        document.addEventListener("change", async (e) => {
            if (!e.target.classList.contains("role-select")) return;

            try {
                await api("/admin/user/role", {
                    userId: e.target.dataset.id,
                    role: e.target.value
                });
                syncSoon();
            } catch {}
        });
    }

    // =====================
    // INIT
    // =====================
    document.addEventListener("DOMContentLoaded", async () => {
        bindEvents();
        connectWS();

        await loadState().catch(() => {});
        setInterval(loadState, 15000);
    });

})();
