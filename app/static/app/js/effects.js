document.addEventListener("DOMContentLoaded", () => {
    const lowpassSlider = document.getElementById('lowpass-slider');
    const reverbSlider  = document.getElementById('reverb-slider');

    const lowpassDisplay = document.getElementById('lowpass-display');
    const reverbDisplay  = document.getElementById('reverb-display');

    if (!lowpassSlider || !reverbSlider) return;

    noUiSlider.create(lowpassSlider, {
        start: 20000,
        connect: 'lower',
        range: { min: 200, max: 20000 },
        step: 200,
        behaviour: 'tap-drag'
    });

    noUiSlider.create(reverbSlider, {
        start: 0.0,
        connect: 'lower',
        range: { min: 0.0, max: 1.0 },
        step: 0.01,
        behaviour: 'tap-drag'
    });

    function getCookie(name) {
        const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? decodeURIComponent(m.pop()) : null;
    }

    async function saveEffectsToSession() {
        const lowpass = parseInt(lowpassSlider.noUiSlider.get());
        const reverb  = parseFloat(reverbSlider.noUiSlider.get());

        // Include current speed/pitch if available so session stays consistent
        const speedEl = document.getElementById('speed_slider');
        const pitchEl = document.getElementById('pitch_slider');
        const spd = speedEl?.noUiSlider ? parseFloat(speedEl.noUiSlider.get()) : undefined;
        const pch = pitchEl?.noUiSlider ? parseFloat(pitchEl.noUiSlider.get()) : undefined;

        let payload = { lowpass, reverb };
        if (typeof spd === 'number') {
            let semitones = (12 * Math.log2(spd)).toFixed(2);
            if (parseFloat(semitones) > 0) semitones = "+" + semitones;
            payload.speed = spd;
            payload.pitch = typeof pch === 'number' ? pch : 0.0;
            payload.speed_pitch = `${semitones} semitones`;
        }

        await fetch("/save_values_to_session/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });
    }

    // const debounce = (fn, ms=150) => {
    //     let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    // };
    // const debouncedSave = debounce(saveEffectsToSession, 150);

    lowpassSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseInt(values[handle]);
        lowpassDisplay.textContent = val.toFixed(0);
        // debouncedSave();
    });

    reverbSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseFloat(values[handle]);
        reverbDisplay.textContent = val.toFixed(2);
        // debouncedSave();
    });
});
