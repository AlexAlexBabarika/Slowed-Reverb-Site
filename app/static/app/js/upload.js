window.addEventListener('DOMContentLoaded', () => {
    const speedSlider = document.getElementById('speed_slider');
    const speedValue  = document.getElementById("speed_display");

    const pitchSlider = document.getElementById('pitch_slider');
    const pitchValue  = document.getElementById('pitch_display');

    const speedPitchValue = document.getElementById('speed_pitch_display');
    const fileInput = document.getElementById('fileInput');

    if (!speedSlider || !pitchSlider) return;

    const initialSpeed = parseFloat(speedSlider.dataset.init || "1.0");
    const initialPitch = parseFloat(pitchSlider.dataset.init || "0");

    noUiSlider.create(speedSlider, {
        start: initialSpeed,
        connect: 'lower',
        range: { min: 0.1, max: 2.0 },
        step: 0.01,
        behaviour: 'tap-drag',
    });

    noUiSlider.create(pitchSlider, {
        start: initialPitch,
        connect: 'lower',
        range: { min: -12, max: 12 },
        step: 1,
        behaviour: 'tap-drag',
    });

    function getCookie(name) {
        const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? decodeURIComponent(m.pop()) : null;
    }

    async function saveControlsToSession() {
        const speed = parseFloat(speedSlider.noUiSlider.get());
        const pitch = parseFloat(pitchSlider.noUiSlider.get());

        let semitones = (12 * Math.log2(speed)).toFixed(2);
        if (parseFloat(semitones) > 0) semitones = "+" + semitones;
        const speed_pitch = `${semitones} semitones`;

        const lowpassEl = document.getElementById('lowpass-slider');
        const reverbEl = document.getElementById('reverb-slider');
        const gainEl = document.getElementById('gain-slider');

        const lowpass = parseInt(lowpassEl.noUiSlider.get());
        const reverb = parseFloat(reverbEl.noUiSlider.get());
        const gain = parseFloat(gainEl.noUiSlider.get());

        await fetch("/save_values_to_session/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
            },
            credentials: "same-origin",
            body: JSON.stringify({ speed, pitch, speed_pitch, lowpass, reverb, gain })
        });
    }

    speedSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseFloat(values[handle]);
        speedValue.textContent = (val * 100).toFixed(0) + "%";

        let semitones = (12 * Math.log2(val)).toFixed(2);
        if (parseFloat(semitones) > 0) semitones = "+" + semitones;
        speedPitchValue.textContent = `${semitones} semitones`;
    });

    pitchSlider.noUiSlider.on('update', (values, handle) => {
        const val = Math.round(values[handle]);
        pitchValue.textContent = (val > 0 ? "+" + val : val);
    });

    speedValue.textContent = (initialSpeed * 100).toFixed(0) + "%";
    pitchValue.textContent = (initialPitch > 0 ? "+" + initialPitch : initialPitch);
    {
        let semitones = (12 * Math.log2(initialSpeed)).toFixed(2);
        if (parseFloat(semitones) > 0) semitones = "+" + semitones;
        speedPitchValue.textContent = `${semitones} semitones`;
    }

    document.querySelectorAll('.reload-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        try { showLoading(); } catch (_) {}
        await saveControlsToSession();

        const fd = new FormData(form);
        const index = Number(fd.get('index'));

        const resp = await fetch(form.action, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
        });

        try { hideLoading(); } catch (_) {}
        if (!resp.ok) {
        console.error('Reload failed:', resp.status, await resp.text().catch(()=>'')); 
        return;
        }

        const audio = document.getElementById('audio');
        if (!audio) return;

        const ts = Date.now();
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audio.src = `/audio/${index}/?t=${ts}`;
        audio.load();

        const tryPlay = () => {
        audio.play()
            .then(() => {
            fetch(`/set_last_played/${index}/`, { method: 'POST' }).catch(()=>{});
            })
            .catch(err => console.warn('autoplay blocked:', err));
        };

        if (audio.readyState >= 3) {
        tryPlay();
        } else {
        audio.addEventListener('canplay', tryPlay, { once: true });
        }

        const dl = document.getElementById('download-btn');
        if (dl) dl.href = audio.src;
    });
    });

    window.submitFormWithSpeed = async function () {
        try { showLoading(); } catch (_) {}
        await saveControlsToSession();
        document.getElementById('uploadForm').submit();
    };

    window.showLoading = function () {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'flex';
    };

    window.hideLoading = function () {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    };

    if (fileInput) {
        fileInput.addEventListener('change', window.submitFormWithSpeed);
    }
});
