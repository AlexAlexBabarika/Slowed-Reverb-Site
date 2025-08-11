import contextlib, logging, os, re, tempfile, time, wave, ffmpeg
from pedalboard.io import AudioFile
import numpy as np
from mutagen import File as MutagenFile

MARKERS = ("_original", "_out", "_reloaded", "_mid")
ANON_TEMP_RE = re.compile(r"^(tmp|tmp\w+|[^.]+)\.wav$", re.IGNORECASE)
FILES: set = {}

def cleanup_temp_files(active_paths=(), max_age_seconds=0):
    temp_dir = tempfile.gettempdir()
    now = time.time()

    protected = set()
    for p in active_paths:
        try:
            if p:
                protected.add(os.path.realpath(p))
        except Exception:
            pass

    deleted, kept = 0, 0

    for fname in os.listdir(temp_dir):
        fpath = os.path.join(temp_dir, fname)
        try:
            if not os.path.isfile(fpath):
                continue

            ext = os.path.splitext(fname)[1].lower()
            if ext not in (".wav", ".mp3"):
                continue

            if os.path.realpath(fpath) in protected:
                kept += 1
                continue

            age = now - os.path.getmtime(fpath)
            if age < max_age_seconds:
                kept += 1
                continue

            looks_like_ours = (
                any(m in fname for m in MARKERS) or
                ANON_TEMP_RE.match(fname) or
                re.match(r"^[0-9a-f-]{36}", fname)
            )

            if not looks_like_ours:
                kept += 1
                continue

            os.remove(fpath)
            print(f"🧹 Deleted: {fpath}")
            deleted += 1

        except Exception as e:
            print(f"⚠️ Could not delete {fpath}: {e}")

    print(f"Cleanup complete. Deleted={deleted}, Kept={kept}")

def clear_all_sessions():
    from django.contrib.sessions.models import Session
    Session.objects.all().delete()
    print("✅ All Django sessions wiped from database.")

def get_sample_rate(file_obj):
    file_bytes = file_obj.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        path = tmp.name
    try:
        probe = ffmpeg.probe(path)
        for stream in probe["streams"]:
            if stream["codec_type"] == "audio":
                return int(stream["sample_rate"])
    finally:
        os.unlink(path)
    return 44100

def get_audio_duration(path: str) -> int:
    try:
        with AudioFile(path) as f:
            sr = f.samplerate or 0
            frames = getattr(f, "frames", None)
            if isinstance(frames, int) and frames > 0:
                pass  # use it
            else:
                total = 0
                while True:
                    buf = f.read(262144)
                    if buf.size == 0:
                        break
                    total += buf.shape[0]
                frames = total
            if sr > 0:
                return int(round(frames / float(sr)))
    except Exception:
        pass

    # 2) WAV fallback
    try:
        with contextlib.closing(wave.open(path, 'rb')) as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            if rate > 0:
                return int(round(frames / float(rate)))
    except Exception:
        pass

    # 3) Mutagen metadata
    try:
        mf = MutagenFile(path)
        if mf and mf.info and getattr(mf.info, "length", None):
            return int(round(mf.info.length))
    except Exception:
        pass

    return 0

def to_wav_with_pedalboard(in_path: str, out_path: str):
    """Decode any supported audio to WAV using Pedalboard; fallback to ffmpeg on failure.
    Adds robust dtype normalization (float32) and shape validation to avoid native crashes.
    """
    try:
        with AudioFile(in_path) as f:
            sr = f.samplerate
            frames = getattr(f, "frames", None)
            if isinstance(frames, int) and frames > 0:
                samples = f.read(frames)
                num_channels = 1 if samples.ndim == 1 else samples.shape[1]
            else:
                chunks = []
                while True:
                    buf = f.read(262144)
                    if buf.size == 0:
                        break
                    chunks.append(buf)
                if not chunks:
                    raise ValueError("No audio data read (empty file or unsupported format)")
                # Concatenate along first axis (frames)
                samples = chunks[0] if len(chunks) == 1 else np.concatenate(chunks, axis=0)
                num_channels = 1 if samples.ndim == 1 else samples.shape[1]
        if samples.size == 0:
            raise ValueError("Decoded audio has zero samples")

        # Ensure shape is (frames,) or (frames, channels)
        if samples.ndim == 2 and samples.shape[0] < samples.shape[1]:
            # Some decoders might give (channels, frames)
            samples = np.transpose(samples)
            num_channels = samples.shape[1]
        elif samples.ndim == 1:
            num_channels = 1
        else:
            num_channels = samples.shape[1]

        # Normalize dtype to float32
        if samples.dtype != np.float32:
            if np.issubdtype(samples.dtype, np.integer):
                max_val = float(np.iinfo(samples.dtype).max)
                samples = (samples.astype(np.float32) / max_val)
            else:
                samples = samples.astype(np.float32)

        # Guard against NaNs / infs
        if not np.isfinite(samples).all():
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)

        # Final sanity check
        if samples.ndim == 2 and samples.shape[1] == 0:
            raise ValueError("Zero channel audio after normalization")

        with AudioFile(out_path, 'w', samplerate=sr or 44100, num_channels=num_channels) as g:
            g.write(samples)
    except Exception as e:
        # Fallback to ffmpeg for robust decoding
        try:
            tmp_wav = out_path + "._ffmpeg_tmp.wav"
            (
                ffmpeg
                .input(in_path)
                .output(tmp_wav, acodec='pcm_s16le', ac=2, ar=44100, loglevel='error')
                .overwrite_output()
                .run()
            )
            os.replace(tmp_wav, out_path)
        except Exception as e2:
            raise RuntimeError(f"Both pedalboard and ffmpeg decode failed: {e} / {e2}")