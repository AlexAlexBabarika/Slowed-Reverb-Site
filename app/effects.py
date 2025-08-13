import os
from slowedreverbsite import settings
from pedalboard import Pedalboard, PitchShift, LowpassFilter, Reverb, Convolution, Gain
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

def change_pitch(board: Pedalboard, samples: np.ndarray, pitch_change_semitones: int):
    samples = ensure_float32(samples)
    if pitch_change_semitones == 0:
        return samples

    board.append(PitchShift(semitones=float(pitch_change_semitones)))

def lowpass(board: Pedalboard, samples: np.ndarray, cutoff_hz: float):
    samples = ensure_float32(samples)
    board.append(LowpassFilter(cutoff_frequency_hz=float(cutoff_hz)))

def reverb(board: Pedalboard, sample_rate: int, samples: np.ndarray, amount: float = 0.3):
    samples = ensure_float32(samples)
    amount = float(max(0.0, min(1.0, amount)))

    if amount == 0.0: return samples
    dry = samples

    if os.path.exists(HALL_IR):
        try:
            wet = Pedalboard([Convolution(HALL_IR)])(samples, sample_rate=sample_rate)
            return (dry * (1.0 - amount) + wet * amount).astype(np.float32)
        except Exception as e:
            print(f"Reverb IR failed ({e})")

    wet_level = amount
    dry_level = 1.0 - amount

    board.append(Reverb(
            room_size=0.8,
            damping=0.3,
            wet_level=wet_level,
            dry_level=dry_level,
            width=0.9
        ))

def gain(board: Pedalboard, samples: np.ndarray, amount: float = 0):
    samples = ensure_float32(samples)
    board.append(Gain(gain_db=amount))

# def bitcrush(sample_rate: int, samples: np.ndarray):
#     samples = ensure_float32(samples)

#     board = Pedalboard([Bitcrush(bit_depth=2)])
#     return board(samples, sample_rate=sample_rate)
