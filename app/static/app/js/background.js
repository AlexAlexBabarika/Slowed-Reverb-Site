function setTheme(theme) {
    document.body.classList.remove("synthwave", "dark");
    document.body.classList.add(theme);
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