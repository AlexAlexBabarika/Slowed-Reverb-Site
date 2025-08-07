function setTheme(theme) {
    const customPlayer = document.querySelector(".custom-player");

    document.body.classList.remove("synthwave", "dark");
    document.querySelector(".lower-box").classList.remove("synthwave", "dark");
    document.querySelector(".lower-container").classList.remove("synthwave", "dark");
    document.querySelectorAll(".box").forEach(el => {
        el.classList.remove("synthwave", "dark");
    });

    if (customPlayer) customPlayer.classList.remove("synthwave", "dark");

    document.body.classList.add(theme);
    document.querySelector(".lower-box").classList.add(theme);
    document.querySelector(".lower-container").classList.add(theme);
    document.querySelectorAll(".box").forEach(el => {
        el.classList.add(theme);
    });

    if (customPlayer) document.querySelector(".custom-player").classList.add(theme);

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