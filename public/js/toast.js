(function () {

    function normalize(message) {
        if (message === true || message === "true") return "Success";
        if (message === false) return "Failed";

        if (typeof message === "object") {
            return message?.message || JSON.stringify(message);
        }

        return String(message);
    }

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

        toast.textContent = `${icon} ${normalize(message)}`;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    // LOW-LEVEL ONLY
    window.toast = {
        _show: show
    };

})();
