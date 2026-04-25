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

<<<<<<< Updated upstream
  // TAB SYSTEM
  document.querySelectorAll(".friends-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.friendsTab;
      document.querySelectorAll(".friends-tab-btn")
        .forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".friends-tab-panel")
        .forEach(p => p.classList.toggle("active", p.id === `friends-tab-${tab}`));
=======
        if (!res.ok) {
            throw new Error(data.error || "Request failed");
        }

        return data;
    }

    const input = document.getElementById("avatarInput");
    const preview = document.getElementById("preview");
    const cropSaveBtn = document.getElementById("crop-save-btn");
    const passwordForm = document.getElementById("password-form");
    const friendForm = document.getElementById("friend-request-form");
    const incomingRequestList = document.getElementById("incoming-request-list");

    if (input && preview) {
        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (evt) => {
                preview.src = evt.target.result;
                preview.style.display = "block";

                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }

                preview.onload = () => {
                    if (typeof Cropper === "undefined") {
                        alert("Image cropper failed to load. Please refresh.");
                        return;
                    }
                    cropper = new Cropper(preview, {
                        aspectRatio: 1,
                        viewMode: 1
                    });
                };
            };

            reader.readAsDataURL(file);
        });
    }

    if (cropSaveBtn) {
        cropSaveBtn.addEventListener("click", async () => {
            if (!cropper) {
                alert("Please select and crop an image first.");
                return;
            }

            const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });

            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append("avatar", blob, "avatar.png");

                const csrf = document.querySelector('input[name="_csrf"]').value;
                formData.append("_csrf", csrf);

                const res = await fetch("/profile/update", {
                    method: "POST",
                    headers: {
                        "CSRF-Token": csrf
                    },
                    body: formData
                });

                if (!res.ok) {
                    alert("Upload failed");
                    return;
                }

                location.reload();
            }, "image/png");
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener("submit", (e) => {
            const newPass = passwordForm.querySelector("input[name='new']").value;
            const confirm = passwordForm.querySelector("input[name='confirm']").value;

            if (newPass !== confirm) {
                e.preventDefault();
                alert("Passwords do not match");
            }
        });
    }

    if (friendForm) {
        friendForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const data = Object.fromEntries(new FormData(friendForm));

            try {
                await api("/api/profile/friends/request", data);
                location.reload();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (incomingRequestList) {
        incomingRequestList.addEventListener("click", async (e) => {
            const item = e.target.closest(".request-item");
            if (!item) return;

            const requestId = Number(item.dataset.requestId);
            if (!Number.isInteger(requestId)) return;

            try {
                if (e.target.closest(".accept-request-btn")) {
                    await api("/api/profile/friends/respond", { requestId, action: "accept" });
                    location.reload();
                }

                if (e.target.closest(".reject-request-btn")) {
                    await api("/api/profile/friends/respond", { requestId, action: "reject" });
                    location.reload();
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    document.querySelectorAll(".friends-tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".friends-tab-btn").forEach((el) => el.classList.remove("active"));
            document.querySelectorAll(".friends-tab-panel").forEach((el) => el.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(`friends-tab-${btn.dataset.friendsTab}`)?.classList.add("active");
        });
>>>>>>> Stashed changes
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
