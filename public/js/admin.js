function getCSRF() {
    return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

async function api(url, body) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "CSRF-Token": getCSRF()
        },
        body: JSON.stringify(body)
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
            document.getElementById("tab-" + btn.dataset.tab)?.classList.remove("hidden");
        });
    });

    document.querySelectorAll(".role-select").forEach(sel => {
        sel.addEventListener("change", () => api("/admin/user/role", { userId: sel.dataset.id, role: sel.value }));
    });

    document.querySelectorAll(".disable-btn").forEach(btn => {
        btn.addEventListener("click", () => api("/admin/user/disable", { userId: btn.dataset.id, mode: "permanent" }).then(()=>location.reload()));
    });

    document.querySelectorAll(".enable-btn").forEach(btn => {
        btn.addEventListener("click", () => api("/admin/user/enable", { userId: btn.dataset.id }).then(()=>location.reload()));
    });

    document.querySelectorAll(".reset-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const res = await api("/admin/user/reset-password", { userId: btn.dataset.id });
            const json = await res.json();
            alert(json.password || "Failed");
        });
    });

    document.querySelectorAll(".force-reset-btn").forEach(btn => {
        btn.addEventListener("click", () => api("/admin/user/force-reset", { userId: btn.dataset.id }));
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => api("/admin/user/delete", { userId: btn.dataset.id }).then(()=>location.reload()));
    });

    document.querySelectorAll(".delete-service-btn").forEach(btn => {
        btn.addEventListener("click", () => api("/admin/service/delete", { serviceId: btn.dataset.id }).then(()=>location.reload()));
    });

    const createUserForm = document.getElementById("create-user-form");
    if (createUserForm) {
        createUserForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(createUserForm));
            await api("/admin/user", data);
            location.reload();
        });
    }

    const createServiceForm = document.getElementById("create-service-form");
    if (createServiceForm) {
        createServiceForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(createServiceForm));
            await api("/admin/service", data);
            location.reload();
        });
    }
});
