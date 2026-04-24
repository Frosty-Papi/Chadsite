document.addEventListener("DOMContentLoaded", () => {
    let img = new Image();
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    const input = document.getElementById("avatarInput");
    const canvas = document.getElementById("avatarCanvas");
    const ctx = canvas?.getContext("2d");
    const cropper = document.getElementById("avatarCropper");
    const zoom = document.getElementById("zoomSlider");
    const saveBtn = document.getElementById("saveAvatar");
    const cancelBtn = document.getElementById("cancelAvatar");
    const status = document.getElementById("avatarStatus");

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, 300, 300);

        const w = img.width * scale;
        const h = img.height * scale;

        ctx.drawImage(img, (300 - w) / 2 + offsetX, (300 - h) / 2 + offsetY, w, h);
    }

    input?.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            img.onload = () => {
                scale = Math.max(300 / img.width, 300 / img.height);
                offsetX = 0;
                offsetY = 0;
                cropper.classList.remove("hidden");
                draw();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    zoom?.addEventListener("input", () => {
        scale = parseFloat(zoom.value);
        draw();
    });

    canvas?.addEventListener("mousedown", e => {
        let startX = e.clientX;
        let startY = e.clientY;

        function move(ev) {
            offsetX += ev.clientX - startX;
            offsetY += ev.clientY - startY;
            startX = ev.clientX;
            startY = ev.clientY;
            draw();
        }

        function up() {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        }

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    });

    cancelBtn?.addEventListener("click", () => {
        cropper.classList.add("hidden");
        input.value = "";
    });

    saveBtn?.addEventListener("click", async () => {
        status.textContent = "Uploading...";

        canvas.toBlob(async blob => {
            const formData = new FormData();
            formData.append("avatar", blob, "avatar.png");

            const csrf = document.querySelector('meta[name="csrf-token"]').content;
            formData.append("_csrf", csrf);

            const res = await fetch("/profile/update", {
                method: "POST",
                headers: { "CSRF-Token": csrf, "Accept": "application/json" },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                status.textContent = data.error || "Upload failed";
                return;
            }

            document.querySelector(".avatar img").src = data.avatar + "?t=" + Date.now();

            status.textContent = "Saved!";
            cropper.classList.add("hidden");
        }, "image/png");
    });
});
