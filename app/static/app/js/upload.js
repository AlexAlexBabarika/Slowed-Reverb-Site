const speedSlider = document.getElementById('speed_slider');
const speedHidden = document.getElementById('speed_hidden');
const speedValue  = document.getElementById("speed_display");

const pitchSlider = document.getElementById('pitch_slider');
const pitchValue = document.getElementById('pitch_display');
const pitchHidden = document.getElementById('pitch_hidden');

const speedPitchValue = document.getElementById('speed_pitch_display');
const speedPitchHidden = document.getElementById("sp_hidden");

const speedReloadHidden = document.getElementById('speed_reload_hidden');
const pitchReloadHidden = document.getElementById('pitch_reload_hidden');
const speedPitchReloadHidden = document.getElementById("sp_hidden_reload");

speedSlider.addEventListener('input', () => {
    const val = parseFloat(speedSlider.value).toFixed(2);
    speedHidden.value = val;
    speedReloadHidden.value = val;
    speedValue.textContent = (parseFloat(val) * 100).toFixed(2) + "%";

    semitones = (12*Math.log2(val)).toFixed(2);
    if (semitones > 0) { semitones = "+" + semitones }
    semitones = semitones + " semitones"
    
    speedPitchHidden.value = semitones 
    speedPitchReloadHidden.value = semitones
    speedPitchValue.textContent = semitones
});

pitchSlider.addEventListener('input', () => {
    const val = parseInt(pitchSlider.value);
    pitchHidden.value = val;
    pitchReloadHidden.value = val;

    if (val > 0) {
        pitchValue.textContent = "+" + val;
    }
    else {
        pitchValue.textContent = val;
    }
});

function submitFormWithSpeed() {
    speedHidden.value = parseFloat(speedSlider.value).toFixed(2);
    pitchHidden.value = parseInt(pitchSlider.value);

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('uploadForm').submit(); 
}