document.addEventListener("DOMContentLoaded", () => {
    let cropper = null;

    const input = document.getElementById("avatarInput");
    const preview = document.getElementById("avatarPreview");
    const container = document.getElementById("avatarCropper");
    const saveBtn = document.getElementById("saveAvatar");
    const cancelBtn = document.getElementById("cancelAvatar");
    const status = document.getElementById("avatarStatus");

    input?.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = evt => {
            preview.src = evt.target.result;
            preview.style.display = "block";

            container.classList.remove("hidden");

            if (cropper) cropper.destroy();

            cropper = new Cropper(preview, {
                aspectRatio: 1,
                viewMode: 1
            });
        };

        reader.readAsDataURL(file);
    });

    cancelBtn?.addEventListener("click", () => {
        container.classList.add("hidden");
        input.value = "";
        if (cropper) cropper.destroy();
        cropper = null;
    });

    saveBtn?.addEventListener("click", async () => {
        if (!cropper) {
            alert("Please crop an image first.");
            return;
        }

        status.textContent = "Uploading...";

        const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });

        canvas.toBlob(async blob => {
            const formData = new FormData();
            formData.append("avatar", blob, "avatar.png");

            const csrf = document.querySelector('meta[name="csrf-token"]').content;

            const res = await fetch("/profile/update", {
                method: "POST",
                headers: {
                    "CSRF-Token": csrf,
                    "Accept": "application/json"
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                status.textContent = data.error || "Upload failed";
                return;
            }

            document.querySelector(".avatar img").src = data.avatar + "?t=" + Date.now();

            status.textContent = "Saved!";
            container.classList.add("hidden");
        }, "image/png");
    });
});
