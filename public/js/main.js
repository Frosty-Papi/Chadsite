document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.querySelector(".profile-trigger");
    const dropdown = document.getElementById("profile-dropdown");

    if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === "block";
            dropdown.style.display = isOpen ? "none" : "block";
        });
    }

    document.addEventListener("click", (e) => {
        if (!dropdown) return;

        const insideDropdown = e.target.closest("#profile-dropdown");
        const insideTrigger = e.target.closest(".profile-trigger");

        if (!insideDropdown && !insideTrigger) {
            dropdown.style.display = "none";
        }
    });

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
