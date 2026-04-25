const bell = document.getElementById("notif-bell");
const panel = document.getElementById("notif-panel");
const list = document.getElementById("notif-list");


bell?.addEventListener("click", () => {
    panel.classList.toggle("hidden");
});

async function loadNotifications() {
    const bell = document.getElementById("notif-bell");
    const list = document.getElementById("notif-list");

    if (!bell || !list) return;

    const res = await fetch("/api/play/invites");
    const data = await res.json();

    const count = document.getElementById("notif-count");
    count.textContent = data.invites.length;

    list.innerHTML = "";

    if (!data.invites || data.invites.length === 0) {
        // 🔥 hide bell if no notifications
        bell.classList.add("hidden");
        return;
    }

    // 🔥 show bell if notifications exist
    bell.classList.remove("hidden");

    data.invites.forEach(invite => {
        const li = document.createElement("li");
        li.innerHTML = `
        ${invite.username} invited you to ${invite.title}
        <button data-id="${invite.id}" class="acceptInvite">Join</button>
        `;
        list.appendChild(li);
    });
}

document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("acceptInvite")) return;

    const inviteId = e.target.dataset.id;

    const res = await fetch("/api/play/invite/respond", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "CSRF-Token": document.querySelector('input[name="_csrf"]')?.value
        },
        body: JSON.stringify({ inviteId })
    });

    const data = await res.json();
    if (data.redirect) location.href = data.redirect;
});

setInterval(loadNotifications, 10000);
loadNotifications();

document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.querySelector(".profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === "block";
            dropdown.style.display = isOpen ? "none" : "block";
        });
    }

    document.addEventListener("click", (e) => {
        if (!dropdown) return;

        const insideDropdown = e.target.closest("#profile-dropdown");
        const insideTrigger = e.target.closest(".profile-trigger");

        if (!insideDropdown && !insideTrigger) {
            dropdown.style.display = "none";
        }
    });
});
