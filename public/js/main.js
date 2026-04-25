document.addEventListener("DOMContentLoaded", () => {

    const bell = document.getElementById("notif-bell");
    const panel = document.getElementById("notif-panel");
    const list = document.getElementById("notif-list");
    const count = document.getElementById("notif-count");

    bell?.addEventListener("click", () => {
        panel.classList.toggle("hidden");
    });

    async function loadNotifications() {
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
        if (count) count.textContent = data.unreadCount || "";

        notifications.forEach(n => {
            const li = document.createElement("li");
            if (!n.is_read) li.classList.add("notif-unread");

            if (n.type === "invite") {
                li.innerHTML = `${n.username} invited you to ${n.title} <button data-id="${n.id}" class="acceptInvite">Join</button>`;
            }

            if (n.type === "friend_request") {
                li.innerHTML = `${n.username} sent you a friend request <button data-id="${n.id}" class="acceptFriend">Accept</button>`;
            }

            li.addEventListener("click", async () => {
                await fetch("/api/notifications/read", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "CSRF-Token": document.querySelector('input[name="_csrf"]')?.value
                    },
                    body: JSON.stringify({ id: n.id, type: n.type })
                });

                li.classList.remove("notif-unread");
            });

            list.appendChild(li);
        });
    }

    setInterval(loadNotifications, 10000);
    loadNotifications();

    // accept invite
    document.addEventListener("click", async (e) => {
        if (e.target.classList.contains("acceptInvite")) {
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
        }

        if (e.target.classList.contains("acceptFriend")) {
            const id = e.target.dataset.id;

            await fetch("/api/profile/friends/respond", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": document.querySelector('input[name="_csrf"]')?.value
                },
                body: JSON.stringify({ requestId: id, action: "accept" })
            });

            loadNotifications();
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        const trigger = document.querySelector(".profile-trigger");
        const dropdown = document.getElementById("profile-dropdown");

        if (!trigger || !dropdown) return;

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("open");
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".profile-menu")) {
                dropdown.classList.remove("open");
            }
        });
    });

});
