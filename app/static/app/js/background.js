function setTheme(theme) {
    const customPlayer = document.querySelector(".custom-player");
    const lowerBox = document.querySelector(".lower-box");
    const lowerContainer = document.querySelector(".lower-container")

    document.body.classList.remove("synthwave", "dark");
    document.querySelectorAll(".box").forEach(el => {
        el.classList.remove("synthwave", "dark");
    });

    if (customPlayer) customPlayer.classList.remove("synthwave", "dark");
    if (lowerBox) lowerBox.classList.remove("synthwave", "dark");
    if (lowerContainer) lowerContainer.classList.remove("synthwave", "dark");

    document.body.classList.add(theme);
    document.querySelectorAll(".box").forEach(el => {
        el.classList.add(theme);
    });
    
    if (customPlayer) customPlayer.classList.add(theme);
    if (lowerBox) lowerBox.classList.add(theme);
    if (lowerContainer) lowerContainer.classList.add(theme);
    
    localStorage.setItem("preferredTheme", theme);
}

document.getElementById("synthwave-background-btn").addEventListener("click", function () {
    setTheme("synthwave");
});

document.getElementById("dark-background-btn").addEventListener("click", function () {
    setTheme("dark");
});

window.addEventListener("DOMContentLoaded", function () {
    const savedTheme = localStorage.getItem("preferredTheme");
    if (savedTheme === "synthwave" || savedTheme === "dark") {
        setTheme(savedTheme);
    } else {
        setTheme("dark");
    }
});