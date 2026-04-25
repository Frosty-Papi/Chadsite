(function () {
    function show(message, type = "success", duration = 2500) {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icon = {
            success: "✔",
            error: "✖",
            info: "ℹ"
        }[type] || "";

        toast.textContent = `${icon} ${message}`;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    // expose globally
    window.toast = {
        success: (msg) => show(msg, "success"),
 error: (msg) => show(msg, "error"),
 info: (msg) => show(msg, "info")
    };
})();
