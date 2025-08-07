document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio');
    const volumeSlider = document.getElementById('volume-slider');

    noUiSlider.create(volumeSlider, {
        start: 1.0,
        connect: 'lower',
        range: { min: 0.0, max: 1.0 },
        step: 0.01,
        behaviour: 'tap-drag',
    });
    
    if (volumeSlider && audio) {
        volumeSlider.noUiSlider.on('update', (values, handle) => {
            audio.volume = parseFloat(values[handle]);
        });
    }
});