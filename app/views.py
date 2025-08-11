import shutil
from django.shortcuts import render, redirect
from django.http import HttpResponse, FileResponse, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from mutagen import File as MutagenFile
import os, tempfile, time, yt_dlp, uuid, json

from pedalboard.io import AudioFile
import numpy as np
from .misc import *
from .effects import * 

format_map = {
    'mp3': 'mp3', 'wav': 'wav', 'flac': 'flac', 'm4a': 'm4a',
    'aac': 'aac', 'ogg': 'ogg', 'opus': 'opus',
}

@csrf_exempt
def index(request):
    if request.method == 'POST' and request.FILES.getlist('audio_file'):
        playlist = request.session.get("playlist", [])

        for file in request.FILES.getlist('audio_file'):
            filename = file.name
            ext = os.path.splitext(filename)[1].lower().replace('.', '')
            input_format = format_map.get(ext)
            if not input_format:
                continue

            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_in:
                tmp_in.write(file.read())
                tmp_in.flush()
                input_path = tmp_in.name

            # Try to read metadata (artist)
            artist = ""
            try:
                audio_meta = MutagenFile(input_path, easy=True)
                if audio_meta:
                    artist = audio_meta.get("artist", ["Unknown"])[0]
            except Exception as e:
                print("Metadata error:", e)
                artist = "Unknown"

            # Convert to WAV "original"
            original_path = input_path.replace(f".{ext}", "_original.wav")
            try:
                to_wav_with_pedalboard(input_path, original_path)
            except Exception as e:
                # If conversion fails, skip this file
                print(f"Pedalboard read/write failed: {e}")
                try:
                    os.remove(input_path)
                except:
                    pass
                continue

            output_path = original_path.replace('_original.wav', '_out.wav')

            try:
                os.remove(input_path)
            except:
                pass

            playlist.append({
                "filename": filename,
                "output_path": output_path,
                "original_path": original_path,
                "duration": get_audio_duration(original_path),
                "artist": artist
            })

        request.session["playlist"] = playlist
        if "last_played_index" not in request.session:
            request.session["last_played_index"] = 0
        return redirect('index')

    speed_value = request.session.get('speed', 1.0)
    pitch_value = request.session.get('pitch', 0.0)
    speed_pitch_value = request.session.get('speed_pitch', '0.00 semitones')
    playlist = request.session.get("playlist", [])
    audio_available = any(os.path.exists(song["output_path"]) for song in playlist)
    last_played_index = request.session.get('last_played_index', None)
    lowpass_hz = int(request.session.get('lowpass', 20000))
    reverb_amt = float(request.session.get('reverb', 0.0))

    return render(request, "app/index.html", {
        "audio_available": audio_available,
        "speed_value": speed_value,
        "pitch_value": pitch_value,
        "speed_pitch_value": speed_pitch_value,
        "playlist": playlist,
        "timestamp": int(time.time()),
        "last_played_index": last_played_index, 
        "lowpass": lowpass_hz,
        "reverb": reverb_amt
    })

@csrf_exempt
def reload_audio(request):
    try:
        index = int(request.POST.get('index'))
    except (TypeError, ValueError):
        return HttpResponse("Invalid index", status=400)

    playlist = request.session.get('playlist', [])
    if index < 0 or index >= len(playlist):
        return HttpResponse("Index out of range", status=400)

    song = playlist[index]
    input_path = song.get('original_path')
    if not input_path or not os.path.exists(input_path):
        return HttpResponse("Original file missing", status=404)

    # speed = float(request.session.get('speed', 1.0))
    # pitch = float(request.session.get('pitch', 0.0))
    # lowpass_hz = int(request.session.get('lowpass', 20000))
    # reverb = float(request.session.get('reverb', 0.0))

    output_path = input_path.replace('_original.wav', '_out.wav')
    shutil.copyfile(input_path, output_path)
                    
    # try:
    #     process_audio(input_path, output_path, speed, pitch, lowpass_hz, reverb)
    # except Exception as e:
    #     return HttpResponse(f"Reload error: {e}", status=500)

    song["output_path"] = output_path
    song["duration"] = get_audio_duration(output_path)
    playlist[index] = song

    request.session['playlist'] = playlist
    request.session['last_played_index'] = index
    request.session.modified = True

    return redirect('index')

@csrf_exempt
def delete_from_playlist(request):
    if request.method == 'POST':
        index = int(request.POST.get('index', -1))
        playlist = request.session.get('playlist', [])
        if 0 <= index < len(playlist):
            try:
                os.remove(playlist[index]['output_path'])
            except:
                pass
            del playlist[index]
            request.session['playlist'] = playlist
    return redirect('index')

@csrf_exempt
def serve_audio(request, index):
    playlist = request.session.get('playlist', [])

    try:
        idx = int(index)
    except (TypeError, ValueError):
        return HttpResponse("Bad index", status=400)
    if not (0 <= idx < len(playlist)):
        return HttpResponse("Index out of range", status=400)

    song = playlist[idx]
    orig = song.get('original_path')
    if not orig or not os.path.exists(orig):
        return HttpResponse("Original file missing", status=404)

    speed = float(request.session.get('speed', 1.0))
    pitch = float(request.session.get('pitch', 0.0))
    lowpass_hz = int(request.session.get('lowpass', 20000))
    reverb = float(request.session.get('reverb', 0.0))

    tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        process_audio(orig, tmp_out, speed, pitch, lowpass_hz, reverb)
    except Exception as e:
        return HttpResponse(f"Processing error: {e}", status=500)

    song["output_path"] = tmp_out
    song["duration"] = get_audio_duration(tmp_out)
    playlist[idx] = song
    request.session['playlist'] = playlist
    request.session['last_played_index'] = idx
    request.session.modified = True

    return FileResponse(open(tmp_out, 'rb'), content_type='audio/wav')

@require_POST
def save_values_to_session(request):
    data = json.loads(request.body.decode("utf-8"))

    request.session['speed'] = float(data.get('speed', 1.0))
    request.session['pitch'] = int(data.get('pitch', 0))
    request.session['speed_pitch'] = data.get('speed_pitch', '')

    request.session['lowpass'] = int(data.get('lowpass', 20000))
    request.session['reverb'] = float(data.get('reverb', 0.0))
    request.session.modified = True

    return JsonResponse({"ok": True})

@csrf_exempt
def download_from_youtube(request):
    if request.method != "POST":
        return HttpResponse("Invalid request", status=405)

    url = request.POST.get("youtube_url")
    if not url:
        return HttpResponse("No URL provided", status=400)

    uid = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    download_base = os.path.join(temp_dir, uid)
    download_template = f"{download_base}.%(ext)s"
    final_mp3 = f"{download_base}.mp3"
    original_path = f"{download_base}_original.wav"
    output_path = f"{download_base}_out.wav"

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': download_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'encoding': 'utf-8',
        'cookiesfrombrowser': ('chrome',)
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_title = info.get("title", "Unknown Title")
            author_name = info.get("uploader", "Unknown Author")
    except Exception as e:
        return HttpResponse(f"yt-dlp failed: {e}", status=500)

    if not os.path.exists(final_mp3):
        return HttpResponse(f"Download failed. File not found: {final_mp3}", status=500)

    # Convert mp3 → wav via Pedalboard
    try:
        to_wav_with_pedalboard(final_mp3, original_path)
    except Exception as e:
        return HttpResponse(f"Conversion failed: {e}", status=500)

    speed = float(request.session.get('speed', 1.0))
    pitch = float(request.session.get('pitch', 0.0))
    lowpass_hz = int(request.session.get('lowpass', 20000))
    reverb = float(request.session.get('reverb', 0.0))

    try:
        process_audio(original_path, output_path, speed, pitch, lowpass_hz, reverb)
    except Exception as e:
        return HttpResponse(f"Processing failed: {e}", status=500)

    # Add to session playlist
    playlist = request.session.get("playlist", [])
    playlist.append({
        "filename": video_title,
        "output_path": output_path,
        "original_path": original_path,
        "duration": get_audio_duration(output_path),
        "artist": author_name,
    })
    request.session["playlist"] = playlist
    request.session["last_played_index"] = len(playlist) - 1

    try:
        os.remove(final_mp3)
    except:
        pass

    return redirect('index')

@csrf_exempt
def set_last_played(request, index):
    if request.method != "POST":
        return HttpResponseBadRequest("Invalid request method")
    try:
        index = int(index)
    except ValueError:
        return HttpResponseBadRequest("Invalid index")

    request.session['last_played_index'] = index
    request.session.modified = True
    return JsonResponse({"status": "ok", "last_played_index": index})

@csrf_exempt
def cleanup_view(request):
    active = collect_active_paths_from_session(request)
    cleanup_temp_files(active_paths=active)
    return JsonResponse({"status": "ok"})

def process_audio(in_path: str, out_path: str,
                speed_change: float, pitch_change: int,
                lowpass_hz: int, reverb_amount: float):
    try:
        with AudioFile(in_path) as f:
            sr = f.samplerate or 44100
            frames = getattr(f, "frames", None)
            if isinstance(frames, int) and frames > 0:
                samples = f.read(frames)
            else:
                chunks = []
                while True:
                    buf = f.read(262144)
                    if buf.size == 0:
                        break
                    chunks.append(buf)
                if not chunks:
                    raise ValueError("No audio data read (empty file or unsupported format)")
                samples = chunks[0] if len(chunks) == 1 else np.concatenate(chunks, axis=0)

    except:
        print("Failed reading audio via pedalboard")

    try:
        if samples.size == 0:
            raise ValueError("Decoded audio has zero samples")
        if samples.ndim == 2 and samples.shape[0] < samples.shape[1]:
            samples = samples.T
        if samples.dtype != np.float32:
            if np.issubdtype(samples.dtype, np.integer):
                samples = samples.astype(np.float32) / float(np.iinfo(samples.dtype).max)
            else:
                samples = samples.astype(np.float32)
        if not np.isfinite(samples).all():
            samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    except:
        print("Normalization failed")

    if pitch_change != 0 and abs(speed_change - 1.0) > 1e-3:
        samples, _ = change_speed(sr, samples, speed_change)
        samples = change_pitch(sr, samples, pitch_change)
    elif pitch_change != 0:
        samples = change_pitch(sr, samples, pitch_change)
    else: 
        samples, _ = change_speed(sr, samples, speed_change)

    try:
        if lowpass_hz and lowpass_hz < 20000:
            samples = lowpass(sr, samples, lowpass_hz)
        if reverb_amount and reverb_amount > 0.0:
            samples = reverb(sr, samples, reverb_amount)
    except Exception as e:
        print("Effect stage failed:", e)

    try:
        num_channels = 1 if samples.ndim == 1 else samples.shape[1]
        with AudioFile(out_path, 'w', samplerate=sr, num_channels=num_channels) as g:
            g.write(samples.astype(np.float32, copy=False))

        print(f"Processed:\n -Speed: {speed_change}\n\
            -Pitch: {pitch_change}\n\
            -Lowpass: {lowpass_hz}\n -Reverb: {reverb_amount}")

    except Exception as e:
        print("writing output failed")

def collect_active_paths_from_session(request):
    active = []
    for song in request.session.get("playlist", []):
        for key in ("original_path", "output_path"):
            p = song.get(key)
            if p and os.path.exists(p):
                active.append(p)
    return active
