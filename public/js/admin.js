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
        search: "",
        serviceEdits: {} // ✅ ADD THIS
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

        // ⚠️ Don't re-render services while editing
        if (!state.editingServiceId) {
            renderServices();
        }

        renderUsers();
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

            const isDisabled = !!user.is_disabled;

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
            <button class="disable-btn" data-id="${user.id}" ${isDisabled ? "disabled" : ""}>Disable</button>
            <button class="enable-btn" data-id="${user.id}" ${!isDisabled ? "disabled" : ""}>Enable</button>
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
            const isEditing = state.editingServiceId == s.id;

            const row = document.createElement("div");
            const edit = state.serviceEdits[s.id] || {};

            const nameVal = edit.name ?? s.name;
            const pathVal = edit.path ?? s.path;

            row.className = "service-row";
            row.dataset.id = s.id;

            row.innerHTML = `
            <div class="service-info ${isEditing ? "hidden" : ""}">
            <span class="col name">${escape(s.name)}</span>
            <span class="col path">${escape(s.path)}</span>
            <span class="col role">${escape(s.min_role)}</span>
            </div>

            <div class="service-edit ${isEditing ? "" : "hidden"}">
            <input class="edit-name" value="${escape(nameVal)}" placeholder="Name">
            <input class="edit-path" value="${escape(pathVal)}" placeholder="/path or https://...">

            <select class="edit-role">
            <option value="user" ${s.min_role === "user" ? "selected" : ""}>User</option>
            <option value="admin" ${s.min_role === "admin" ? "selected" : ""}>Admin</option>
            </select>

            <div class="validation name-error"></div>
            <div class="validation path-error"></div>
            </div>

            <div class="service-actions">
            ${isEditing ? `
                <button class="save-service-btn" data-id="${s.id}">Save</button>
                <button class="cancel-service-btn" data-id="${s.id}">Cancel</button>
                ` : `
                <button class="edit-service-btn" data-id="${s.id}">Edit</button>
                <button class="delete-service-btn" data-id="${s.id}">Delete</button>
                `}
                </div>
                `;

                el.appendChild(row);
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

                if (btn.classList.contains("edit-service-btn")) {
                    state.editingServiceId = id;
                    renderServices();
                    return;
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

                if (btn.classList.contains("cancel-service-btn")) {
                    delete state.serviceEdits[id];
                    state.editingServiceId = null;
                    renderServices();
                    return;
                }

                if (btn.classList.contains("save-service-btn")) {
                    const row = btn.closest(".service-row");

                    if (!validateServiceRow(row)) return;

                    const name = row.querySelector(".edit-name").value.trim();
                    const path = row.querySelector(".edit-path").value.trim();
                    const role = row.querySelector(".edit-role").value;

                    await api("/admin/service/update", {
                        serviceId: id,
                        name,
                        path,
                        min_role: role
                    });

                    delete state.serviceEdits[id];
                    state.editingServiceId = null;
                    syncSoon();
                    return;
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

    function setupTabs() {
        document.querySelectorAll("[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.dataset.tab;

                // hide all
                document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));

                // deactivate all buttons
                document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));

                // show selected
                document.getElementById("tab-" + tab)?.classList.remove("hidden");

                // activate button
                btn.classList.add("active");
            });
        });
    }

    function bindServiceForm() {
        const form = document.getElementById("create-service-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const data = Object.fromEntries(new FormData(form));

            await api("/admin/service", data);

            form.reset();
                              syncSoon();
        });
    }

    function validateServiceRow(row) {
        const nameInput = row.querySelector(".edit-name");
        const pathInput = row.querySelector(".edit-path");

        const nameError = row.querySelector(".name-error");
        const pathError = row.querySelector(".path-error");

        let valid = true;

        // Name validation
        if (!nameInput.value.trim()) {
            nameError.textContent = "Name required";
            nameInput.classList.add("invalid");
            nameInput.classList.remove("valid");
            valid = false;
        } else {
            nameError.textContent = "";
            nameInput.classList.add("valid");
            nameInput.classList.remove("invalid");
        }

        // Path validation
        const path = pathInput.value.trim();

        const internal = /^\/[a-z0-9/_-]*$/i.test(path);
        let external = false;

        try {
            const url = new URL(path);
            external = url.protocol === "http:" || url.protocol === "https:";
        } catch {}

        if (!internal && !external) {
            pathError.textContent = "Invalid path or URL";
            pathInput.classList.add("invalid");
            pathInput.classList.remove("valid");
            valid = false;
        } else {
            pathError.textContent = "";
            pathInput.classList.add("valid");
            pathInput.classList.remove("invalid");
        }

        return valid;
    }

    // =====================
    // INIT
    // =====================
    document.addEventListener("DOMContentLoaded", async () => {
        bindEvents();
        connectWS();
        setupTabs();
        bindServiceForm();

        await loadState().catch(() => {});
        setInterval(loadState, 15000);
    });

    document.addEventListener("input", (e) => {
        if (e.target.matches(".edit-name, .edit-path")) {
            const row = e.target.closest(".service-row");
            const id = row.dataset.id;
            const edit = (state.serviceEdits && state.serviceEdits[s.id]) || {};

            if (!state.serviceEdits[id]) {
                state.serviceEdits[id] = {};
            }

            state.serviceEdits[id].name = row.querySelector(".edit-name").value;
            state.serviceEdits[id].path = row.querySelector(".edit-path").value;
        }
    });

})();
