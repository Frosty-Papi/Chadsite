document.addEventListener("DOMContentLoaded", () => {
  let cropper = null;

  const input = document.getElementById("avatarInput");
  const preview = document.getElementById("avatarPreview");
  const container = document.getElementById("avatarCropper");
  const saveBtn = document.getElementById("saveAvatar");
  const cancelBtn = document.getElementById("cancelAvatar");
  const status = document.getElementById("avatarStatus");

  function resetCropper() {
    if (cropper) cropper.destroy();
    cropper = null;
    container?.classList.add("hidden");
    if (input) input.value = "";
    if (preview) preview.style.display = "none";
  }

  cancelBtn?.addEventListener("click", resetCropper);

  // TAB SYSTEM
  document.querySelectorAll(".friends-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.friendsTab;
      document.querySelectorAll(".friends-tab-btn")
        .forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".friends-tab-panel")
        .forEach(p => p.classList.toggle("active", p.id === `friends-tab-${tab}`));
    });
  });

  // SEND REQUEST
  const form = document.getElementById("friend-request-form");
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    const username = form.username.value;
    const res = await fetch("/api/profile/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    alert(data.error || "Request sent");
  });

  // ACCEPT / REJECT
  document.addEventListener("click", async e => {
    const row = e.target.closest(".request-item");
    if (!row) return;
    const id = row.dataset.requestId;

    if (e.target.classList.contains("accept-request-btn")) {
      await fetch("/api/profile/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action: "accept" })
      });
      row.remove();
    }

    if (e.target.classList.contains("reject-request-btn")) {
      await fetch("/api/profile/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action: "reject" })
      });
      row.remove();
    }
  });

  // REMOVE FRIEND
  document.addEventListener("click", async e => {
    if (!e.target.classList.contains("remove-friend-btn")) return;
    const row = e.target.closest(".friend-row");
    const userId = row.dataset.userId;

    await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });

    row.remove();
  });
});
