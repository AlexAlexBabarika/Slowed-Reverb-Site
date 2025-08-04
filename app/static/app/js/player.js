const audio = document.getElementById('audio');
const playPause = document.getElementById('playPause');
const seekBar = document.getElementById('seekBar');
const volumeControl = document.getElementById('volumeControl');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

playPause.addEventListener('click', () => {
    if (audio.paused) {
        audio.play();
        playPause.textContent = '⏸️';
    } else {
        audio.pause();
        playPause.textContent = '▶️';
    }
});

audio.addEventListener('timeupdate', () => {
    seekBar.value = (audio.currentTime / audio.duration) * 100;
    currentTimeDisplay.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
    durationDisplay.textContent = formatTime(audio.duration);
});

seekBar.addEventListener('input', () => {
    const percent = seekBar.value;
    audio.currentTime = (percent / 100) * audio.duration;
});

volumeControl.addEventListener('input', () => {
    audio.volume = volumeControl.value;
});