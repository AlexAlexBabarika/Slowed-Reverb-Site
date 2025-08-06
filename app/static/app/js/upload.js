const speedSlider = document.getElementById('speed_slider');
const speedHidden = document.getElementById('speed_hidden');
const speedValue  = document.getElementById("speed_display");

const pitchSlider = document.getElementById('pitch_slider');
const pitchValue = document.getElementById('pitch_display');
const pitchHidden = document.getElementById('pitch_hidden');

const speedPitchValue = document.getElementById('speed_pitch_display');
const speedPitchHidden = document.getElementById("sp_hidden");

// 🎚 Speed slider updates
speedSlider.addEventListener('input', () => {
    const val = parseFloat(speedSlider.value).toFixed(2);
    speedHidden.value = val;
    speedValue.textContent = (parseFloat(val) * 100).toFixed(2) + "%";

    let semitones = (12 * Math.log2(val)).toFixed(2);
    if (parseFloat(semitones) > 0) {
        semitones = "+" + semitones;
    }
    semitones += " semitones";

    speedPitchHidden.value = semitones;
    speedPitchValue.textContent = semitones;
});

// 🎚 Pitch slider updates
pitchSlider.addEventListener('input', () => {
    const val = parseInt(pitchSlider.value);
    pitchHidden.value = val;
    pitchValue.textContent = (val > 0 ? "+" + val : val);
});

// 🔁 Reload form: inject current slider values before submit
document.querySelectorAll('.reload-form').forEach(form => {
    form.addEventListener('submit', function (e) {
        const index = form.querySelector('[name="index"]').value;

        const speed = speedSlider.value;
        const pitch = pitchSlider.value;
        const semitoneText = speedPitchValue.innerText;

        const speedReload = document.getElementById(`speed_reload_hidden_${index}`);
        const pitchReload = document.getElementById(`pitch_reload_hidden_${index}`);
        const spReload = document.getElementById(`sp_hidden_reload_${index}`);

        if (speedReload) speedReload.value = speed;
        if (pitchReload) pitchReload.value = pitch;
        if (spReload) spReload.value = semitoneText;
    });
});

// 📤 Upload form: sync hidden fields before submission
function submitFormWithSpeed() {
    speedHidden.value = parseFloat(speedSlider.value).toFixed(2);
    pitchHidden.value = parseInt(pitchSlider.value);

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('uploadForm').submit(); 
}
