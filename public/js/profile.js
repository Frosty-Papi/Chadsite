document.addEventListener("DOMContentLoaded", () => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

  async function api(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": csrfToken,
        "Accept": "application/json"
      },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  document.querySelectorAll(".friends-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.friendsTab;
      document.querySelectorAll(".friends-tab-btn").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".friends-tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `friends-tab-${tab}`);
      });
    });
  });

  const passwordForm = document.getElementById("password-form");
  passwordForm?.addEventListener("submit", e => {
    const next = passwordForm.querySelector('input[name="new"]')?.value || "";
    const confirm = passwordForm.querySelector('input[name="confirm"]')?.value || "";
    if (next !== confirm) {
      e.preventDefault();
      alert("Passwords do not match");
    }
  });

  const friendForm = document.getElementById("friend-request-form");
  friendForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const username = String(new FormData(friendForm).get("username") || "").trim();
    try {
      await api("/api/profile/friends/request", { username });
      friendForm.reset();
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });

  document.addEventListener("click", async e => {
    const requestItem = e.target.closest(".request-item");
    if (requestItem && (e.target.closest(".accept-request-btn") || e.target.closest(".reject-request-btn"))) {
      const action = e.target.closest(".accept-request-btn") ? "accept" : "reject";
      try {
        await api("/api/profile/friends/respond", { requestId: requestItem.dataset.requestId, action });
        location.reload();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    const removeBtn = e.target.closest(".remove-friend-btn");
    if (removeBtn) {
      const row = removeBtn.closest(".friend-row");
      if (!row || !confirm("Remove this friend?")) return;
      try {
        await api("/api/friends/remove", { userId: row.dataset.userId });
        row.remove();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  let cropper = null;
  const input = document.getElementById("avatarInput");
  const preview = document.getElementById("avatarPreview");
  const cropperBox = document.getElementById("avatarCropper");
  const saveAvatar = document.getElementById("saveAvatar");
  const cancelAvatar = document.getElementById("cancelAvatar");
  const status = document.getElementById("avatarStatus");

  function resetCropper() {
    if (cropper) cropper.destroy();
    cropper = null;
    cropperBox?.classList.add("hidden");
    if (input) input.value = "";
    if (preview) {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
    if (status) status.textContent = "";
  }

  input?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      input.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      if (cropper) cropper.destroy();
      preview.src = event.target.result;
      preview.style.display = "block";
      cropperBox?.classList.remove("hidden");
      cropper = new Cropper(preview, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        background: false
      });
    };
    reader.readAsDataURL(file);
  });

  cancelAvatar?.addEventListener("click", resetCropper);

  saveAvatar?.addEventListener("click", async () => {
    if (!cropper) return alert("Please choose an image first.");
    if (status) status.textContent = "Uploading...";

    const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
    canvas.toBlob(async blob => {
      if (!blob) return;
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.png");

      const res = await fetch("/profile/update", {
        method: "POST",
        headers: { "CSRF-Token": csrfToken, "Accept": "application/json" },
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (status) status.textContent = data.error || "Upload failed";
        return;
      }

      location.reload();
    }, "image/png");
  });
});
