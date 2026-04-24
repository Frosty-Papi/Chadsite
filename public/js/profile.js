document.addEventListener("DOMContentLoaded", () => {
    let cropper = null;

    const input = document.getElementById("avatarInput");
    const preview = document.getElementById("avatarPreview");
    const container = document.getElementById("avatarCropper");
    const saveBtn = document.getElementById("saveAvatar");
    const cancelBtn = document.getElementById("cancelAvatar");
    const status = document.getElementById("avatarStatus");
    const avatarBox = document.querySelector(".avatar");

    function resetCropper() {
        if (cropper) cropper.destroy();
        cropper = null;
        container?.classList.add("hidden");
        if (input) input.value = "";
        if (preview) {
            preview.removeAttribute("src");
            preview.style.display = "none";
        }
        if (status) status.textContent = "";
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Avatar";
        }
    }

    function updateAvatarImage(src) {
        if (!avatarBox || !src) return;
        let img = avatarBox.querySelector("img");
        if (!img) {
            avatarBox.innerHTML = "";
            img = document.createElement("img");
            img.alt = "Profile avatar";
            avatarBox.appendChild(img);
        }
        img.src = `${src}?t=${Date.now()}`;
    }

    input?.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please choose an image file.");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = evt => {
            if (cropper) cropper.destroy();

            preview.src = evt.target.result;
            preview.style.display = "block";
            container.classList.remove("hidden");
            if (status) status.textContent = "Pinch, wheel, or drag to position your avatar.";

            cropper = new Cropper(preview, {
                aspectRatio: 1,
                viewMode: 3,
                dragMode: "move",
                autoCropArea: 0.92,
                background: false,
                responsive: true,
                restore: false,
                guides: false,
                center: true,
                highlight: false,
                cropBoxMovable: false,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false,
                movable: true,
                zoomable: true,
                zoomOnTouch: true,
                zoomOnWheel: true,
                wheelZoomRatio: 0.08,
                minContainerWidth: 260,
                minContainerHeight: 260,
                ready() {
                    cropper.cropper.classList.add("avatar-cropper-ready");
                }
            });
        };

        reader.readAsDataURL(file);
    });

    cancelBtn?.addEventListener("click", resetCropper);

    saveBtn?.addEventListener("click", async () => {
        if (!cropper) {
            alert("Please crop an image first.");
            return;
        }

        status.textContent = "Uploading...";
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const canvas = cropper.getCroppedCanvas({
            width: 300,
            height: 300,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"
        });

        canvas.toBlob(async blob => {
            if (!blob) {
                status.textContent = "Could not prepare image.";
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Avatar";
                return;
            }

            try {
                const formData = new FormData();
                formData.append("avatar", blob, "avatar.png");

                const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

                const res = await fetch("/profile/update", {
                    method: "POST",
                    headers: {
                        "CSRF-Token": csrf,
                        "Accept": "application/json"
                    },
                    body: formData
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    status.textContent = data.error || "Upload failed";
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Save Avatar";
                    return;
                }

                updateAvatarImage(data.avatar);
                status.textContent = "Saved!";
                setTimeout(resetCropper, 350);
            } catch (error) {
                status.textContent = "Upload failed. Please try again.";
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Avatar";
            }
        }, "image/png");
    });
});
