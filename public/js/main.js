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
});
