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

    const res = await fetch("/api/notifications");
    if (!res.ok) return;

    const data = await res.json();
    const notifications = data.notifications || [];

    list.innerHTML = "";

    if (notifications.length === 0) {
        bell.classList.add("hidden");
        return;
    }

    bell.classList.remove("hidden");

    notifications.sort((a, b) => b.id - a.id);

    notifications.forEach(n => {
        const li = document.createElement("li");

        if (n.type === "invite") {
            li.innerHTML = `
            ${n.username} invited you to ${n.title}
            <button data-id="${n.id}" class="acceptInvite">Join</button>
            `;
        }

        if (n.type === "friend_request") {
            li.innerHTML = `
            ${n.username} sent you a friend request
            <button data-id="${n.id}" class="acceptFriend">Accept</button>
            `;
        }

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

document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("acceptFriend")) {
        const id = e.target.dataset.id;

        await fetch("/api/profile/friends/respond", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "CSRF-Token": document.querySelector('input[name="_csrf"]').value
            },
            body: JSON.stringify({ requestId: id, action: "accept" })
        });

        loadNotifications();
    }
});
