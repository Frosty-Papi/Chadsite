function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
    const tab = document.getElementById(`tab-${name}`);
    if (tab) tab.classList.remove("hidden");
}

function filterUsers() {
    const input = document.getElementById("search");
    const val = (input?.value || "").toLowerCase();

    document.querySelectorAll("#user-table tr").forEach((r) => {
        r.style.display = r.dataset.name.includes(val) ? "" : "none";
    });
}

async function api(url, body) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "CSRF-Token": window.csrfToken
        },
        body: JSON.stringify(body)
    });
}

async function createUser(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await api("/admin/user", data);

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to create user");
        return;
    }

    location.reload();
}

async function deleteUser(id) {
    if (!confirm("Delete user?")) return;
    const res = await api("/admin/user/delete", { userId: id });

    if (!res.ok) {
        alert(await res.text());
        return;
    }

    location.reload();
}

async function setRole(id, role) {
    const res = await api("/admin/user/role", { userId: id, role });
    if (!res.ok) alert("Failed to update role");
}

async function disableUser(id) {
    const res = await api("/admin/user/disable", {
        userId: id,
        mode: "permanent"
    });

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to disable user");
        return;
    }

    location.reload();
}

async function enableUser(id) {
    const res = await api("/admin/user/enable", { userId: id });

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to enable user");
        return;
    }

    location.reload();
}

async function resetPassword(id) {
    const res = await api("/admin/user/reset-password", { userId: id });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
        alert(json.error || "Failed to reset password");
        return;
    }

    alert(`Temp password: ${json.password}`);
}

async function forceReset(id) {
    const res = await api("/admin/user/force-reset", { userId: id });

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to force reset");
        return;
    }

    alert("User will reset password on next login");
}

async function createService(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await api("/admin/service", data);

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to create service");
        return;
    }

    location.reload();
}

async function deleteService(id) {
    const res = await api("/admin/service/delete", { serviceId: id });

    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || "Failed to delete service");
        return;
    }

    location.reload();
}

window.showTab = showTab;
window.deleteUser = deleteUser;
window.setRole = setRole;
window.disableUser = disableUser;
window.enableUser = enableUser;
window.resetPassword = resetPassword;
window.forceReset = forceReset;
window.deleteService = deleteService;

document.addEventListener("DOMContentLoaded", () => {
    const search = document.getElementById("search");
    if (search) {
        search.addEventListener("input", filterUsers);
    }

    const createUserForm = document.getElementById("create-user-form");
    if (createUserForm) {
        createUserForm.addEventListener("submit", createUser);
    }

    const createServiceForm = document.getElementById("create-service-form");
    if (createServiceForm) {
        createServiceForm.addEventListener("submit", createService);
    }
});
