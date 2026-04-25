// =====================
// CSRF + API WRAPPER
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

    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) {
        showToast(data.error || "Request failed", "error");
        throw new Error(data.error || "Request failed");
    }

    if (data.message) {
        showToast(data.message, data.success ? "success" : "error");
    }

    return data;
}

// =====================
// TOAST
// =====================
function showToast(message, type = "success") {
    if (!message) return;

    const map = {
        success: "success",
        error: "error",
        info: "info"
    };

    const method = map[type] || "info";

    if (window.toast && window.toast[method]) {
        window.toast[method](String(message));
    } else {
        console.log(`[${method}]`, message);
    }
}

// =====================
// HELPERS
// =====================
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
    }[ch]));
}

function updateStatus(row, status) {
    const cell = row?.querySelector(".status-cell") || row?.children?.[2];
    if (cell) cell.textContent = status;
}

// =====================
// OTP PANEL
// =====================
function ensureOtpPanel() {
    let panel = document.getElementById("otp-panel");
    if (panel) return panel;

    const form = document.getElementById("create-user-form");

    panel = document.createElement("div");
    panel.id = "otp-panel";
    panel.className = "otp-panel hidden";
    panel.innerHTML = `
    <div class="otp-header">One-Time Password</div>
    <div id="otp-value" class="otp-value"></div>
    <button type="button" id="copy-otp">Copy</button>
    <div class="otp-warning">This password will not be shown again.</div>
    `;

    form?.insertAdjacentElement("afterend", panel);
    return panel;
}

function showOTP(password) {
    const panel = ensureOtpPanel();
    panel.querySelector("#otp-value").textContent = password || "";
    panel.classList.remove("hidden");
}

// =====================
// USER ROW ADD
// =====================
function addUserRow(user) {
    const table = document.getElementById("user-table");
    if (!table) return;

    const tr = document.createElement("tr");
    tr.dataset.id = user.id;
    tr.dataset.name = (user.username || "").toLowerCase();

    tr.innerHTML = `
    <td>${escapeHtml(user.username)}</td>
    <td>
    <select class="role-select" data-id="${user.id}">
    <option value="user" selected>User</option>
    <option value="admin">Admin</option>
    </select>
    </td>
    <td class="status-cell">Reset Required</td>
    <td class="actions-cell">
    <button class="disable-btn" data-id="${user.id}">Disable</button>
    <button class="enable-btn" data-id="${user.id}">Enable</button>
    <button class="reset-btn" data-id="${user.id}">Reset PW</button>
    <button class="force-reset-btn" data-id="${user.id}">Force Reset</button>
    <button class="delete-btn" data-id="${user.id}">Delete</button>
    </td>
    `;

    table.appendChild(tr);
}

// =====================
// INIT
// =====================
document.addEventListener("DOMContentLoaded", () => {

    // ---------- Tabs ----------
    document.querySelectorAll("[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
            document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));

            document.getElementById("tab-" + btn.dataset.tab)?.classList.remove("hidden");
            btn.classList.add("active");
        });
    });

    // ---------- Search ----------
    const search = document.getElementById("search");
    if (search) {
        search.addEventListener("input", () => {
            const val = search.value.toLowerCase();
            document.querySelectorAll("#user-table tr").forEach(tr => {
                tr.style.display = tr.dataset.name.includes(val) ? "" : "none";
            });
        });
    }

    // ---------- Create User ----------
    const cu = document.getElementById("create-user-form");
    if (cu) {
        ensureOtpPanel();

        cu.addEventListener("submit", async e => {
            e.preventDefault();

            const username = new FormData(cu).get("username")?.toString().trim();
            if (!username) return;

            const res = await api("/admin/user", { username });

            showOTP(res.password);
            addUserRow(res.user);

            cu.reset();
        });
    }

    // ---------- Copy OTP ----------
    document.addEventListener("click", async e => {
        if (e.target.id !== "copy-otp") return;

        const text = document.getElementById("otp-value")?.textContent;
        if (!text) return;

        await navigator.clipboard.writeText(text);
        e.target.textContent = "Copied";
        setTimeout(() => e.target.textContent = "Copy", 1500);
    });

    // ---------- User Actions ----------
    document.getElementById("user-table")?.addEventListener("click", async e => {
        const btn = e.target.closest("button[data-id]");
        if (!btn) return;

        const userId = btn.dataset.id;
        const row = btn.closest("tr");

        if (btn.classList.contains("disable-btn")) {
            await api("/admin/user/disable", { userId, mode: "permanent" });
            updateStatus(row, "Disabled");
        }

        if (btn.classList.contains("enable-btn")) {
            await api("/admin/user/enable", { userId });
            updateStatus(row, "Active");
        }

        if (btn.classList.contains("reset-btn")) {
            const res = await api("/admin/user/reset-password", { userId });
            showOTP(res.password);
            updateStatus(row, "Reset Required");
        }

        if (btn.classList.contains("force-reset-btn")) {
            await api("/admin/user/force-reset", { userId });
            updateStatus(row, "Reset Required");
        }

        if (btn.classList.contains("delete-btn")) {
            if (!confirm("Delete this user?")) return;
            await api("/admin/user/delete", { userId });
            row.remove();
        }
    });

    // ---------- Role Change ----------
    document.addEventListener("change", async e => {
        if (!e.target.classList.contains("role-select")) return;

        await api("/admin/user/role", {
            userId: e.target.dataset.id,
            role: e.target.value
        });
    });

    // ---------- Create Service ----------
    const cs = document.getElementById("create-service-form");
    if (cs) {
        cs.addEventListener("submit", async e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(cs));
            await api("/admin/service", data);
            location.reload(); // optional later: live insert
        });
    }

    // ---------- Service Actions ----------
    document.addEventListener("click", async e => {
        const row = e.target.closest(".service-row");
        if (!row) return;

        // DELETE
        if (e.target.classList.contains("delete-service-btn")) {
            if (!confirm("Delete this service?")) return;
            await api("/admin/service/delete", { serviceId: row.dataset.id });
            row.remove();
        }

        // EDIT
        if (e.target.classList.contains("edit-service-btn")) {
            row.querySelector(".view-mode").classList.add("hidden");
            row.querySelector(".service-edit").classList.remove("hidden");

            row.querySelector(".edit-service-btn").classList.add("hidden");
            row.querySelector(".save-service-btn").classList.remove("hidden");
            row.querySelector(".cancel-service-btn").classList.remove("hidden");
        }

        // CANCEL
        if (e.target.classList.contains("cancel-service-btn")) {
            row.querySelector(".view-mode").classList.remove("hidden");
            row.querySelector(".service-edit").classList.add("hidden");

            row.querySelector(".edit-service-btn").classList.remove("hidden");
            row.querySelector(".save-service-btn").classList.add("hidden");
            row.querySelector(".cancel-service-btn").classList.add("hidden");
        }

        // SAVE
        if (e.target.classList.contains("save-service-btn")) {
            const btn = e.target;

            btn.disabled = true;
            btn.textContent = "Saving...";

            const name = row.querySelector(".edit-name").value.trim();
            const path = row.querySelector(".edit-path").value.trim();

            if (!name || !path) {
                showToast("All fields are required", "error");
                btn.disabled = false;
                btn.textContent = "Save";
                return;
            }

            try {
                await api("/admin/service/update", {
                    serviceId: row.dataset.id,
                    name: row.querySelector(".edit-name").value,
                          path: row.querySelector(".edit-path").value,
                          min_role: row.querySelector(".edit-role").value
                });

                row.querySelector(".service-name").textContent = row.querySelector(".edit-name").value;
                row.querySelector(".service-path").textContent = row.querySelector(".edit-path").value;
                row.querySelector(".service-role").textContent =
                `(${row.querySelector(".edit-role").value})`;

                showToast("Service updated");

                row.querySelector(".cancel-service-btn").click();

            } catch (err) {
            }

            btn.disabled = false;
            btn.textContent = "Save";
        }
    });

});
