document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio');
    const sliderContainer = document.getElementById('seek-slider');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const playPauseBtn = document.getElementById('playPause');

    if (!audio || !sliderContainer) return;

    noUiSlider.create(sliderContainer, {
        start: 0,
        connect: 'lower',
        range: { min: 0, max: 100 },
        behaviour: 'tap-drag',
    });

    let isSeeking = false;
    let userInitiatedSeek = false;

    sliderContainer.noUiSlider.on('start', () => {
        isSeeking = true;
        userInitiatedSeek = true;
    });

    sliderContainer.noUiSlider.on('end', (values, handle) => {
        const seekTo = parseFloat(values[handle]);
        if (!isNaN(seekTo) && audio.duration) {
            audio.currentTime = seekTo;
        }
        isSeeking = false;
        userInitiatedSeek = false;
    });

    sliderContainer.addEventListener('click', (e) => {
        if (!audio.duration) return;

        const rect = sliderContainer.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percent = offsetX / rect.width;
        const seekTime = percent * audio.duration;

        // Set both slider and audio time manually
        sliderContainer.noUiSlider.set(seekTime);
        audio.currentTime = seekTime;
    });

    audio.addEventListener('loadedmetadata', () => {
        sliderContainer.noUiSlider.updateOptions({
            range: { min: 0, max: audio.duration },
            start: 0
        });
        durationDisplay.textContent = formatTime(audio.duration || 0);

        if (window.pendingSeek !== undefined) {
            audio.currentTime = window.pendingSeek;
            window.pendingSeek = undefined;
        }
    });

    audio.addEventListener('timeupdate', () => {
        if (!isSeeking && audio.duration) {
            sliderContainer.noUiSlider.set(audio.currentTime);
        }

        currentTimeDisplay.textContent = formatTime(audio.currentTime);
        durationDisplay.textContent = formatTime(audio.duration);
    });

    playPauseBtn.addEventListener('click', () => {
        if (audio.paused) {    
            setTimeout(() => {
                    audio.play().then(() => {
                        playPauseBtn.textContent = '⏸';
                        console.log("▶️ Playing!");
                    }).catch(err => {
                        console.warn("🚫 Autoplay blocked:", err);
                    });
                    }, 10); // slight delay is important!
        } else {
            audio.pause();
            playPauseBtn.textContent = '▶';
        }
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
});
