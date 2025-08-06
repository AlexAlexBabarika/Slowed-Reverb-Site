document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio');
    const volumeSlider = document.getElementById('volumeControl');
    
    if (volumeSlider && audio) {
        volumeSlider.addEventListener('input', () => {
            audio.volume = parseFloat(volumeSlider.value);
        });
    }
});