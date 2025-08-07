window.addEventListener('DOMContentLoaded', () => {
    const speedSlider = document.getElementById('speed_slider');
    const speedHidden = document.getElementById('speed_hidden');
    const speedValue  = document.getElementById("speed_display");

    const pitchSlider = document.getElementById('pitch_slider');
    const pitchHidden = document.getElementById('pitch_hidden');
    const pitchValue = document.getElementById('pitch_display');

    const speedPitchValue = document.getElementById('speed_pitch_display');
    const speedPitchHidden = document.getElementById("sp_hidden");

    const fileInput = document.getElementById('fileInput');

    noUiSlider.create(speedSlider, {
        start: 1.0,
        connect: 'lower',
        range: { min: 0.1, max: 2.0 },
        step: 0.01,
        behaviour: 'tap-drag',
    });

    noUiSlider.create(pitchSlider, {
        start: 0,
        connect: 'lower',
        range: { min: -12, max: 12 },
        step: 1,
        behaviour: 'tap-drag',
    });

    const initialSpeed = parseFloat(speedHidden.value || "1.00");
    const initialPitch = parseInt(pitchHidden.value || "0");
    speedSlider.noUiSlider.set(initialSpeed);
    pitchSlider.noUiSlider.set(initialPitch);


    // 🎚 Speed slider updates
    speedSlider.noUiSlider.on('update', (values, handle) => {
        const val = parseFloat(values[handle]).toFixed(2);
        speedHidden.value = val;
        speedValue.textContent = (val * 100).toFixed(0) + "%";

        let semitones = (12 * Math.log2(val)).toFixed(2);
        if (parseFloat(semitones) > 0) {
            semitones = "+" + semitones;
        }
        semitones += " semitones";

        speedPitchHidden.value = semitones;
        speedPitchValue.textContent = semitones;
    });

    // 🎚 Pitch slider updates
    pitchSlider.noUiSlider.on('update', (values, handle) => {
        const val = Math.round(values[handle]);
        pitchHidden.value = val;
        pitchValue.textContent = (val > 0 ? "+" + val : val);
    });

    speedValue.textContent = (initialSpeed * 100).toFixed(0) + "%";
    pitchValue.textContent = (initialPitch > 0 ? "+" + initialPitch : initialPitch);

    let semitones = (12 * Math.log2(initialSpeed)).toFixed(2);
    if (parseFloat(semitones) > 0) semitones = "+" + semitones;
    semitones += " semitones";
    speedPitchValue.textContent = semitones;
    speedPitchHidden.value = semitones;

    // 🔁 Reload form: inject current slider values before submit
    document.querySelectorAll('.reload-form').forEach(form => {
        form.addEventListener('submit', function () {
            const index = form.querySelector('[name="index"]').value;

            const speed = speedSlider.noUiSlider.get();
            const pitch = Math.round(parseFloat(pitchSlider.noUiSlider.get()));
            const semitoneText = speedPitchValue.innerText;

            const speedReload = document.getElementById(`speed_reload_hidden_${index}`);
            const pitchReload = document.getElementById(`pitch_reload_hidden_${index}`);
            const spReload = document.getElementById(`sp_hidden_reload_${index}`);

            if (speedReload) speedReload.value = speed;
            if (pitchReload) pitchReload.value = pitch;
            if (spReload) spReload.value = semitoneText;
        });
    });

    window.submitFormWithSpeed = function () {
        const speed = parseFloat(speedSlider.noUiSlider.get()).toFixed(2);
        const pitch = Math.round(parseFloat(pitchSlider.noUiSlider.get()));

        let semitones = (12 * Math.log2(speed)).toFixed(2);
        if (parseFloat(semitones) > 0) semitones = "+" + semitones;
        semitones += " semitones";

        speedHidden.value = speed;
        pitchHidden.value = pitch;
        speedPitchHidden.value = semitones;

        showLoading();
        document.getElementById('uploadForm').submit();
    };

    window.showLoading = function () {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    if (fileInput) {
        fileInput.addEventListener('change', submitFormWithSpeed);
    }
});
