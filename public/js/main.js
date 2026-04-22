function toggleDropdown() {
    const el = document.getElementById("profile-dropdown");
    if (!el) return;
    el.style.display = el.style.display === "block" ? "none" : "block";
}

window.toggleDropdown = toggleDropdown;

document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("profile-dropdown");
    if (!dropdown) return;

    const trigger = e.target.closest(".profile-trigger");
    const insideDropdown = e.target.closest("#profile-dropdown");

    if (!trigger && !insideDropdown) {
        dropdown.style.display = "none";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    let lastScrollY = window.scrollY;
    let timeout;

    const nav = document.getElementById("top-nav");
    if (!nav) return;

    function showNav() {
        nav.classList.remove("nav-hidden");
    }

    function hideNav() {
        nav.classList.add("nav-hidden");
    }

    window.addEventListener("scroll", () => {
        const currentY = window.scrollY;

        if (currentY < lastScrollY) {
            showNav();
        } else if (currentY > 80) {
            hideNav();
        }

        lastScrollY = currentY;
    });

    document.addEventListener("mousemove", (e) => {
        if (e.clientY < 60) {
            showNav();
        }
    });

    function resetTimer() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            hideNav();
        }, 2500);
    }

    document.addEventListener("mousemove", resetTimer);
    document.addEventListener("scroll", resetTimer);
    resetTimer();
});
