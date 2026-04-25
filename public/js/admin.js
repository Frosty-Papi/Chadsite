(() => {
    const state = {
        users: [],
        services: [],
        socket: null,
        socketReconnectTimer: null,
        activeTab: "users",
        editingServiceId: null,
        search: ""
    };

    function getCSRF() {
        return document.querySelector('meta[name="csrf-token"]')?.content || "";
    }

    async function api(url, body = {}) {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "CSRF-Token": getCSRF()
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const message = data.error || "Request failed";
            showToast(message, "error");
            throw new Error(message);
        }

        if (data.message) showToast(data.message, data.success ? "success" : "info");
        return data;
    }

    async function loadState() {
        const res = await fetch("/api/admin/state", {
            headers: { "Accept": "application/json" }
        });

        if (!res.ok) throw new Error("Unable to load admin state");

        const data = await res.json();
        applyState(data);
    }

    function applyState(data) {
        state.users = Array.isArray(data.users) ? data.users : [];
        state.services = Array.isArray(data.services) ? data.services : [];
        renderUsers();
        renderServices();
        applySearchFilter();
    }

    function syncSoon() {
        setTimeout(() => loadState().catch(() => {}), 250);
    }

    function websocketUrl() {
        const protocol = location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${location.host}`;
    }

    function connectSocket() {
        if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) return;

        try {
            state.socket = new WebSocket(websocketUrl());
        } catch {
            scheduleReconnect();
            return;
        }

        state.socket.addEventListener("open", () => {
            showConnectionState(true);
            clearTimeout(state.socketReconnectTimer);
            state.socketReconnectTimer = null;
        });

        state.socket.addEventListener("message", (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }

            if (msg.type === "admin:state") {
                applyState(msg);
            }
        });

        state.socket.addEventListener("close", () => {
            showConnectionState(false);
            scheduleReconnect();
        });

        state.socket.addEventListener("error", () => {
            showConnectionState(false);
        });
    }

    function scheduleReconnect() {
        if (state.socketReconnectTimer) return;
        state.socketReconnectTimer = setTimeout(() => {
            state.socketReconnectTimer = null;
            connectSocket();
        }, 2000);
    }

    function showConnectionState(connected) {
        let el = document.getElementById("admin-live-status");
        const panel = document.querySelector(".profile-panel");
        if (!el && panel) {
            el = document.createElement("div");
            el.id = "admin-live-status";
            el.className = "admin-live-status";
            panel.appendChild(el);
        }

        if (el) {
            el.textContent = connected ? "Live sync connected" : "Live sync reconnecting...";
            el.dataset.connected = connected ? "1" : "0";
        }
    }

    function setupTabs() {
        document.querySelectorAll("[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => activateTab(btn.dataset.tab));
        });
        activateTab(state.activeTab);
    }

    function activateTab(tabName) {
        if (!tabName) return;
        state.activeTab = tabName;

        document.querySelectorAll(".tab").forEach(tab => tab.classList.add("hidden"));
        document.querySelectorAll("[data-tab]").forEach(btn => {
            const active = btn.dataset.tab === tabName;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");
        });

        document.getElementById(`tab-${tabName}`)?.classList.remove("hidden");
    }

    function statusLabel(user) {
        if (Number(user.is_disabled)) return "Disabled";
        if (Number(user.must_reset_password)) return "Reset Required";
        return "Active";
    }

    function renderUsers() {
        const table = document.getElementById("user-table");
        if (!table) return;

        table.innerHTML = "";

        state.users.forEach(user => {
            const tr = document.createElement("tr");
            tr.dataset.id = user.id;
            tr.dataset.name = String(user.username || "").toLowerCase();

            tr.innerHTML = `
                <td>${escapeHtml(user.username)}</td>
                <td>
                    <select class="role-select" data-id="${escapeAttr(user.id)}">
                        <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
                        <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                    </select>
                </td>
                <td class="status-cell">${escapeHtml(statusLabel(user))}</td>
                <td class="actions-cell">
                    <button type="button" class="secondary disable-btn" data-id="${escapeAttr(user.id)}" ${Number(user.is_disabled) ? "disabled" : ""}>Disable</button>
                    <button type="button" class="secondary enable-btn" data-id="${escapeAttr(user.id)}" ${Number(user.is_disabled) ? "" : "disabled"}>Enable</button>
                    <button type="button" class="secondary reset-btn" data-id="${escapeAttr(user.id)}">Reset PW</button>
                    <button type="button" class="secondary force-reset-btn" data-id="${escapeAttr(user.id)}">Force Reset</button>
                    <button type="button" class="secondary delete-btn" data-id="${escapeAttr(user.id)}">Delete</button>
                </td>
            `;

            table.appendChild(tr);
        });
    }

    function renderServices() {
        const list = document.getElementById("service-list");
        if (!list) return;

        list.innerHTML = "";

        state.services.forEach(service => {
            const row = document.createElement("div");
            row.className = "service-row";
            row.dataset.id = service.id;

            const editing = String(state.editingServiceId) === String(service.id);

            row.innerHTML = editing ? serviceEditTemplate(service) : serviceViewTemplate(service);
            list.appendChild(row);
        });
    }

    function serviceViewTemplate(service) {
        return `
            <div class="service-info view-mode">
                <strong class="service-name">${escapeHtml(service.name)}</strong>
                <div class="service-meta">
                    <span class="service-path">${escapeHtml(service.path)}</span>
                    <span class="service-role">(${escapeHtml(service.min_role || "user")})</span>
                </div>
            </div>
            <div class="service-actions">
                <button type="button" class="secondary edit-service-btn" data-id="${escapeAttr(service.id)}">Edit</button>
                <button type="button" class="secondary delete-service-btn" data-id="${escapeAttr(service.id)}">Delete</button>
            </div>
        `;
    }

    function serviceEditTemplate(service) {
        return `
            <div class="service-edit">
                <div class="field">
                    <input class="edit-name" value="${escapeAttr(service.name)}" placeholder="Name" />
                    <div class="error name-error"></div>
                </div>
                <div class="field">
                    <input class="edit-path" value="${escapeAttr(service.path)}" placeholder="Path or https://url" />
                    <div class="error path-error"></div>
                </div>
                <select class="edit-role">
                    <option value="user" ${service.min_role === "user" ? "selected" : ""}>User</option>
                    <option value="admin" ${service.min_role === "admin" ? "selected" : ""}>Admin</option>
                </select>
            </div>
            <div class="service-actions">
                <button type="button" class="secondary save-service-btn" data-id="${escapeAttr(service.id)}">Save</button>
                <button type="button" class="secondary cancel-service-btn" data-id="${escapeAttr(service.id)}">Cancel</button>
                <button type="button" class="secondary delete-service-btn" data-id="${escapeAttr(service.id)}">Delete</button>
            </div>
        `;
    }

    function setupSearch() {
        const search = document.getElementById("search");
        if (!search) return;

        state.search = search.value || "";
        search.addEventListener("input", () => {
            state.search = search.value || "";
            applySearchFilter();
        });
    }

    function applySearchFilter() {
        const term = state.search.trim().toLowerCase();
        document.querySelectorAll("#user-table tr").forEach(tr => {
            tr.style.display = !term || (tr.dataset.name || "").includes(term) ? "" : "none";
        });
    }

    function ensureOtpPanel() {
        let panel = document.getElementById("otp-panel");
        if (panel) return panel;

        const form = document.getElementById("create-user-form");
        if (!form) return null;

        panel = document.createElement("div");
        panel.id = "otp-panel";
        panel.className = "otp-panel hidden";
        panel.innerHTML = `
            <div class="otp-header">One-Time Password</div>
            <div id="otp-value" class="otp-value"></div>
            <button type="button" id="copy-otp" class="secondary">Copy</button>
            <div class="otp-warning">This password will not be shown again. Copy it before leaving or refreshing this page.</div>
        `;

        form.insertAdjacentElement("afterend", panel);
        return panel;
    }

    function showOTP(password) {
        const panel = ensureOtpPanel();
        if (!panel) return;

        panel.querySelector("#otp-value").textContent = password || "";
        panel.classList.remove("hidden");
    }

    function validateServiceValues(name, path) {
        const errors = {};
        if (!name.trim()) errors.name = "Name is required";

        const cleanPath = path.trim();
        const internal = /^\/[a-z0-9/_-]*$/i.test(cleanPath);
        let external = false;
        try {
            const url = new URL(cleanPath);
            external = url.protocol === "http:" || url.protocol === "https:";
        } catch {}

        if (!cleanPath || (!internal && !external)) {
            errors.path = "Must be /path or https://url";
        }

        return errors;
    }

    function showServiceValidation(row) {
        const nameInput = row.querySelector(".edit-name");
        const pathInput = row.querySelector(".edit-path");
        const nameError = row.querySelector(".name-error");
        const pathError = row.querySelector(".path-error");
        const errors = validateServiceValues(nameInput?.value || "", pathInput?.value || "");

        if (nameError) nameError.textContent = errors.name || "";
        if (pathError) pathError.textContent = errors.path || "";
        nameInput?.classList.toggle("invalid", Boolean(errors.name));
        pathInput?.classList.toggle("invalid", Boolean(errors.path));
        nameInput?.classList.toggle("valid", !errors.name);
        pathInput?.classList.toggle("valid", !errors.path);

        return Object.keys(errors).length === 0;
    }

    function setupForms() {
        const createUserForm = document.getElementById("create-user-form");
        if (createUserForm) {
            ensureOtpPanel();
            createUserForm.addEventListener("submit", async event => {
                event.preventDefault();
                const username = String(new FormData(createUserForm).get("username") || "").trim();
                if (!username) return;

                try {
                    const data = await api("/admin/user", { username });
                    showOTP(data.password);
                    createUserForm.reset();
                    syncSoon();
                    showToast("User created", "success");
                } catch {}
            });
        }

        const createServiceForm = document.getElementById("create-service-form");
        if (createServiceForm) {
            createServiceForm.addEventListener("submit", async event => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(createServiceForm));

                try {
                    await api("/admin/service", data);
                    createServiceForm.reset();
                    syncSoon();
                    showToast("Service created", "success");
                } catch {}
            });
        }
    }

    function setupDelegatedActions() {
        document.addEventListener("click", async event => {
            const copyBtn = event.target.closest("#copy-otp");
            if (copyBtn) {
                const text = document.getElementById("otp-value")?.textContent || "";
                if (!text) return;
                try {
                    await navigator.clipboard.writeText(text);
                    copyBtn.textContent = "Copied";
                    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
                } catch {
                    showToast(text, "info");
                }
                return;
            }

            const button = event.target.closest("button");
            if (!button) return;

            if (button.classList.contains("edit-service-btn")) {
                state.editingServiceId = button.dataset.id;
                renderServices();
                const row = document.querySelector(`.service-row[data-id="${cssEscape(button.dataset.id)}"]`);
                if (row) showServiceValidation(row);
                return;
            }

            if (button.classList.contains("cancel-service-btn")) {
                state.editingServiceId = null;
                renderServices();
                return;
            }

            if (button.classList.contains("save-service-btn")) {
                const row = button.closest(".service-row");
                if (!row || !showServiceValidation(row)) return;

                try {
                    await api("/admin/service/update", {
                        serviceId: row.dataset.id,
                        name: row.querySelector(".edit-name").value.trim(),
                        path: row.querySelector(".edit-path").value.trim(),
                        min_role: row.querySelector(".edit-role").value
                    });
                    state.editingServiceId = null;
                    syncSoon();
                    showToast("Service updated", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("delete-service-btn")) {
                if (!confirm("Delete this service?")) return;
                try {
                    await api("/admin/service/delete", { serviceId: button.dataset.id });
                    syncSoon();
                    showToast("Service deleted", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("disable-btn")) {
                try {
                    await api("/admin/user/disable", { userId: button.dataset.id, mode: "permanent" });
                    syncSoon();
                    showToast("User disabled", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("enable-btn")) {
                try {
                    await api("/admin/user/enable", { userId: button.dataset.id });
                    syncSoon();
                    showToast("User enabled", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("reset-btn")) {
                try {
                    const data = await api("/admin/user/reset-password", { userId: button.dataset.id });
                    showOTP(data.password);
                    syncSoon();
                    showToast("Password reset", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("force-reset-btn")) {
                try {
                    await api("/admin/user/force-reset", { userId: button.dataset.id });
                    syncSoon();
                    showToast("Password reset required on next login", "success");
                } catch {}
                return;
            }

            if (button.classList.contains("delete-btn")) {
                if (!confirm("Delete this user?")) return;
                try {
                    await api("/admin/user/delete", { userId: button.dataset.id });
                    syncSoon();
                    showToast("User deleted", "success");
                } catch {}
            }
        });

        document.addEventListener("change", async event => {
            if (!event.target.classList.contains("role-select")) return;
            try {
                await api("/admin/user/role", {
                    userId: event.target.dataset.id,
                    role: event.target.value
                });
                syncSoon();
                showToast("Role updated", "success");
            } catch {
                syncSoon();
            }
        });

        document.addEventListener("input", event => {
            if (event.target.matches(".edit-name, .edit-path")) {
                const row = event.target.closest(".service-row");
                if (row) showServiceValidation(row);
            }
        });
    }

    function showToast(message, type = "success") {
        if (!message) return;
        const method = ["success", "error", "info"].includes(type) ? type : "info";

        if (window.toast?.[method]) {
            window.toast[method](String(message));
        } else {
            console.log(`[${method}]`, message);
        }
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            "\"": "&quot;"
        }[ch]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }

    function cssEscape(value) {
        if (window.CSS?.escape) return CSS.escape(String(value));
        return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    document.addEventListener("DOMContentLoaded", async () => {
        setupTabs();
        setupSearch();
        setupForms();
        setupDelegatedActions();
        connectSocket();

        try {
            await loadState();
        } catch {
            showToast("Unable to load latest admin state", "error");
        }

        setInterval(() => loadState().catch(() => {}), 15000);
    });
})();
