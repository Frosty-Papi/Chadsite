document.addEventListener("DOMContentLoaded", () => {
    let cropper = null;

    const input = document.getElementById("avatarInput");
    const preview = document.getElementById("avatarPreview");
    const container = document.getElementById("avatarCropper");
    const saveBtn = document.getElementById("saveAvatar");
    const cancelBtn = document.getElementById("cancelAvatar");
    const status = document.getElementById("avatarStatus");
    const avatarBox = document.querySelector(".profile-card .avatar");
    const STAGE_SIZE = 300;
    const CROP_SIZE = 224;

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

    function replaceAvatar(containerEl, src, imgClass) {
        if (!containerEl || !src) return;

        const freshSrc = `${src}?t=${Date.now()}`;
        let img = containerEl.querySelector("img");

        if (!img) {
            containerEl.querySelector(".fallback, .profile-icon")?.remove();
            img = document.createElement("img");
            img.alt = "Profile avatar";
            if (imgClass) img.className = imgClass;
            containerEl.prepend(img);
        }

        img.src = freshSrc;
    }

    function updateAvatarImage(src) {
        replaceAvatar(avatarBox, src, "");
        replaceAvatar(document.querySelector(".profile-trigger"), src, "avatar-img");
    }

    function centerLockedCropBox() {
        if (!cropper) return;

        const containerData = cropper.getContainerData();
        const size = Math.min(CROP_SIZE, containerData.width, containerData.height);

        cropper.setCropBoxData({
            width: size,
            height: size,
            left: (containerData.width - size) / 2,
            top: (containerData.height - size) / 2
        });
    }

    function coverCropStage() {
        if (!cropper) return;

        const containerData = cropper.getContainerData();
        const imageData = cropper.getImageData();
        const targetWidth = containerData.width || STAGE_SIZE;
        const targetHeight = containerData.height || STAGE_SIZE;
        const scale = Math.max(targetWidth / imageData.naturalWidth, targetHeight / imageData.naturalHeight);
        const width = imageData.naturalWidth * scale;
        const height = imageData.naturalHeight * scale;

        cropper.setCanvasData({
            left: (targetWidth - width) / 2,
            top: (targetHeight - height) / 2,
            width,
            height
        });

        centerLockedCropBox();
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
                autoCrop: true,
                autoCropArea: 1,
                background: false,
                responsive: true,
                restore: false,
                guides: false,
                center: false,
                highlight: false,
                cropBoxMovable: false,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false,
                movable: true,
                zoomable: true,
                zoomOnTouch: true,
                zoomOnWheel: true,
                wheelZoomRatio: 0.08,
                minContainerWidth: STAGE_SIZE,
                minContainerHeight: STAGE_SIZE,
                ready() {
                    window.requestAnimationFrame(coverCropStage);
                    this.cropper.classList.add("avatar-cropper-ready");
                },
                cropmove() {
                    centerLockedCropBox();
                },
                zoom() {
                    window.requestAnimationFrame(centerLockedCropBox);
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
