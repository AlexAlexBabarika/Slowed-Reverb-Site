import os
from slowedreverbsite import settings
from pedalboard import Pedalboard, PitchShift, LowpassFilter, Reverb, Convolution
import numpy as np

HALL_IR = os.path.join(settings.BASE_DIR, "app", "static", "app", "ir", "hall.wav")

def ensure_float32(song: np.ndarray):
    if song.dtype != np.float32:
        song = song.astype(np.float32, copy=False)
    return song

def resample_speed(samples: np.ndarray, speed_change):
    if speed_change == 1.0:
        return samples

    n = samples.shape[0]
    idx_src = np.arange(n, dtype=np.float64)
    # Use step = speed_change so >1 speeds up (fewer samples), <1 slows down (more samples)
    idx_tgt = np.arange(0, n, speed_change, dtype=np.float64)

    if samples.ndim == 1:
        out = np.interp(idx_tgt, idx_src, samples).astype(np.float32)
    else:
        chans = []
        for ch in range(samples.shape[1]):
            chans.append(np.interp(idx_tgt, idx_src, samples[:, ch]))
        out = np.stack(chans, axis=1).astype(np.float32)
    return out

def change_speed(sr: int, samples: np.ndarray, speed_change: float):
    samples = ensure_float32(samples)
    spedup = resample_speed(samples, speed_change)
    return spedup, sr

def change_pitch(sample_rate: int, samples: np.ndarray, pitch_change_semitones: int):
    samples = ensure_float32(samples)
    if pitch_change_semitones == 0:
        return samples
    board = Pedalboard([PitchShift(semitones=float(pitch_change_semitones))])
    return board(samples, sample_rate=sample_rate)

def lowpass(sample_rate: int, samples: np.ndarray, cutoff_hz: float):
    samples = ensure_float32(samples)
    board = Pedalboard([LowpassFilter(cutoff_frequency_hz=float(cutoff_hz))])
    return board(samples, sample_rate=sample_rate)

def reverb(sample_rate: int, samples: np.ndarray):
    samples = ensure_float32(samples)

    if os.path.exists(HALL_IR):
        try:
            board = Pedalboard([Convolution(HALL_IR)])
            return board(samples, sample_rate=sample_rate)
        except Exception as e:
            print(f"Reverb IR failed ({e})")

    board = Pedalboard([Reverb(room_size=0.8, damping=0.3, wet_level=0.3, dry_level=0.7, width=0.9)])
    return board(samples, sample_rate=sample_rate)