document.addEventListener("DOMContentLoaded", () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ||
        document.querySelector('input[name="_csrf"]')?.value || "";

    const trigger = document.querySelector(".profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle("open");
        });

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".profile-menu")) {
                dropdown.classList.remove("open");
            }
        });
    }

    const bell = document.getElementById("notif-bell");
    const panel = document.getElementById("notif-panel");
    const list = document.getElementById("notif-list");
    const count = document.getElementById("notif-count");

    bell?.addEventListener("click", (e) => {
        e.stopPropagation();
        panel?.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#notif-panel") && !e.target.closest("#notif-bell")) {
            panel?.classList.add("hidden");
        }
    });

    async function loadNotifications() {
        if (!bell || !list) return;

        const res = await fetch("/api/notifications", { headers: { "Accept": "application/json" } });
        if (!res.ok) return;

        const data = await res.json();
        const notifications = data.notifications || [];

        list.innerHTML = "";

        if (notifications.length === 0) {
            bell.classList.add("hidden");
            panel?.classList.add("hidden");
            if (count) count.textContent = "";
            return;
        }

        bell.classList.remove("hidden");
        if (count) count.textContent = data.unreadCount ? String(data.unreadCount) : "";

        notifications.forEach(n => {
            const li = document.createElement("li");
            if (!Number(n.is_read)) li.classList.add("notif-unread");

            if (n.type === "invite") {
                li.innerHTML = `${n.username} invited you to ${n.title} <button type="button" data-id="${n.id}" class="acceptInvite">Join</button>`;
            }

            if (n.type === "friend_request") {
                li.innerHTML = `${n.username} sent you a friend request <button type="button" data-id="${n.id}" class="acceptFriend">Accept</button>`;
            }

            li.addEventListener("click", async () => {
                await fetch("/api/notifications/read", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "CSRF-Token": csrfToken
                    },
                    body: JSON.stringify({ id: n.id, type: n.type })
                });

                li.classList.remove("notif-unread");
                loadNotifications();
            });

            list.appendChild(li);
        });
    }

    document.addEventListener("click", async (e) => {
        if (e.target.classList.contains("acceptInvite")) {
            e.stopPropagation();
            const inviteId = e.target.dataset.id;

            const res = await fetch("/api/play/invite/respond", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken
                },
                body: JSON.stringify({ inviteId })
            });

            const data = await res.json().catch(() => ({}));
            if (data.redirect) location.href = data.redirect;
        }

        if (e.target.classList.contains("acceptFriend")) {
            e.stopPropagation();
            const id = e.target.dataset.id;

            await fetch("/api/profile/friends/respond", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "CSRF-Token": csrfToken
                },
                body: JSON.stringify({ requestId: id, action: "accept" })
            });

            loadNotifications();
        }
    });

    loadNotifications();
    setInterval(loadNotifications, 10000);
});
