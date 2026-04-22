document.addEventListener("DOMContentLoaded", () => {
    let cropper = null;

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";

    const input = document.getElementById("avatarInput");
    const preview = document.getElementById("preview");
    const cropSaveBtn = document.getElementById("crop-save-btn");
    const passwordForm = document.getElementById("password-form");

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
                    if (typeof Cropper === "undefined") return;
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

                const displayNameInput = document.querySelector("input[name='display_name']");
                formData.append("display_name", displayNameInput ? displayNameInput.value : "");

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
});
