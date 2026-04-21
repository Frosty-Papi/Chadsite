window.deleteUser = async function(userId, username) {
    if (!confirm(`Delete ${username}?`)) return;

    const res = await fetch("/admin/user/delete", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ userId })
    });

    if (!res.ok) {
        alert(await res.text());
        return;
    }

    location.reload();
};

let editingServiceId = null;
let pendingDelete = null;

//GLOBAL FUNCTIONS (IMPORTANT)

window.editService = function(id, name, path, icon, isExternal) {
    editingServiceId = id;

    document.getElementById("edit-name").value = name;
    document.getElementById("edit-path").value = path;
    document.getElementById("edit-icon").value = icon;
    document.getElementById("edit-external").checked = !!isExternal;

    document.getElementById("edit-modal").classList.remove("hidden");
};

window.closeEdit = function () {
    document.getElementById("edit-modal").classList.add("hidden");
    editingServiceId = null;
};

window.saveEdit = async function () {
    await fetch("/admin/service/update", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            id: editingServiceId,
            name: document.getElementById("edit-name").value,
                             path: document.getElementById("edit-path").value,
                             icon: document.getElementById("edit-icon").value,
                             is_external: document.getElementById("edit-external").checked
        })
    });

    location.reload();
};

window.deleteService = async function(serviceId) {
    if (!confirm("Delete this service?")) return;

    await fetch("/admin/service/delete", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ serviceId })
    });

    location.reload();
};

window.closeModal = function () {
    pendingDelete = null;
    document.getElementById("modal").classList.add("hidden");
};

window.confirmAction = async function () {
    if (!pendingDelete) return;

    await fetch("/admin/service/delete", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ serviceId: pendingDelete })
    });

    location.reload();
};

window.filterUsers = function () {
    const value = document.getElementById("user-search").value.toLowerCase();

    document.querySelectorAll(".user-block").forEach(el => {
        el.style.display =
        el.dataset.username.includes(value) ? "" : "none";
    });
};

document.getElementById("create-user-form")
?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    const res = await fetch("/admin/user", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    const json = await res.json();

    if (!res.ok) {
        alert(json.error);
        return;
    }

    addUserToUI(json.user);
    form.reset();
});

document.getElementById("create-service-form")
?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    data.is_external = !!data.is_external;

    const res = await fetch("/admin/service", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    const json = await res.json();

    if (!res.ok) {
        alert(json.error);
        return;
    }

    addServiceToUI(json.service);
    form.reset();
});

