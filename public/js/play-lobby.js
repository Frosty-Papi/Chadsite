function getCSRFToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

const container = document.querySelector(".lobby-actions");

if (container) {
  const sessionId = container.dataset.sessionId;

  const startBtn = document.getElementById("start-lobby-btn");
  const closeBtn = document.getElementById("close-lobby-btn");

  startBtn?.addEventListener("click", async () => {
    const res = await fetch(`/api/play/sessions/${sessionId}/start`, {
      method: "POST",
      headers: {
        "CSRF-Token": getCSRFToken()
      }
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to start session");
      return;
    }

    location.reload();
  });

  closeBtn?.addEventListener("click", async () => {
    const res = await fetch(`/api/play/sessions/${sessionId}/terminate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": getCSRFToken()
      },
      body: JSON.stringify({ outcome: "abandoned" })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to close lobby");
      return;
    }

    location.href = data.redirectUrl || "/play";
  });
}

document.getElementById("inviteBtn")?.addEventListener("click", async () => {
  const friendId = document.getElementById("inviteFriend").value;

  await fetch("/api/play/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CSRF-Token": getCSRFToken()
    },
    body: JSON.stringify({
      sessionId: document.querySelector(".lobby-actions").dataset.sessionId,
                         friendId
    })
  });

  alert("Invite sent");
});
