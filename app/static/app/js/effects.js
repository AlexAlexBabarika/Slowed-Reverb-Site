document.addEventListener("DOMContentLoaded", () => {
    const lowpassSlider = document.getElementById('lowpass-slider');
    const reverbSlider = document.getElementById('reverb-slider');
    const gainSlider = document.getElementById('gain-slider');

    const lowpassDisplay = document.getElementById('lowpass-display');
    const reverbDisplay = document.getElementById('reverb-display');
    const gainDisplay = document.getElementById('gain-display');


    const lpStart = parseInt(lowpassSlider.dataset.init || "20000", 10);
    const rvStart = parseFloat(reverbSlider.dataset.init || "0.0");
    const gnStart = parseFloat(gainSlider.dataset.init || "0.0");

    noUiSlider.create(lowpassSlider, {
        start: lpStart,
        connect: 'lower',
        range: { min: 200, max: 20000 },
        step: 200,
        behaviour: 'tap-drag'
    });

    noUiSlider.create(reverbSlider, {
        start: rvStart,
        connect: 'lower',
        range: { min: 0.0, max: 1.0 },
        step: 0.01,
        behaviour: 'tap-drag'
    });

    noUiSlider.create(gainSlider, {
        start: gnStart,
        connect: 'lower',
        range: { min: 0.0, max: 20.0 },
        step: 0.1,
        behaviour: 'tap-drag'
    });

    function getCookie(name) {
        const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? decodeURIComponent(m.pop()) : null;
    }

    async function saveEffectsToSession() {
        const lowpass = parseInt(lowpassSlider.noUiSlider.get());
        const reverb = parseFloat(reverbSlider.noUiSlider.get());
        const gain = parseFloat(gainSlider.noUiSlider.get());

        const speedEl = document.getElementById('speed_slider');
        const pitchEl = document.getElementById('pitch_slider');
        const spd = speedEl?.noUiSlider ? parseFloat(speedEl.noUiSlider.get()) : undefined;
        const pch = pitchEl?.noUiSlider ? parseFloat(pitchEl.noUiSlider.get()) : undefined;

        let payload = { lowpass, reverb, gain };
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

    lowpassDisplay.textContent = lpStart.toFixed(0) + " Hz";
    reverbDisplay.textContent  = (rvStart*100).toFixed(0) + "%";
    gainDisplay.textContent  = rvStart.toFixed(2) + " db";

    lowpassSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseInt(values[handle]);
        lowpassDisplay.textContent = val.toFixed(0) + " Hz";
    });

    reverbSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseFloat(values[handle]);
        reverbDisplay.textContent = (val*100).toFixed(0) + "%";
    });

    gainSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseFloat(values[handle]);
        gainDisplay.textContent = val.toFixed(2) + " db";
    });
});
