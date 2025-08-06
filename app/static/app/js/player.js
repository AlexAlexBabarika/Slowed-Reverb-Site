const audio = document.getElementById('audio');
const playPause = document.getElementById('playPause');
const seekBar = document.getElementById('seekBar');
const volumeControl = document.getElementById('volumeControl');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');

let isDragging = false;

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

audio.addEventListener('timeupdate', () => {
    if (!isDragging && audio.duration) {
        seekBar.value = (audio.currentTime / audio.duration) * 100;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
    }
});

seekBar.addEventListener('change', () => {
    if (audio.duration) {
        const value = seekBar.value;
        audio.currentTime = (value / 100) * audio.duration;
    }
    isDragging = false;
});

seekBar.addEventListener('input', () => {
    isDragging = true;
});

playPause.addEventListener('click', () => {
    if (audio.paused) {
        audio.play();
        playPause.textContent = '⏸️';
    } else {
        audio.pause();
        playPause.textContent = '▶️';
    }
});

audio.addEventListener('loadedmetadata', () => {
    durationDisplay.textContent = formatTime(audio.duration);
});

volumeControl.addEventListener('input', () => {
    audio.volume = volumeControl.value;
});