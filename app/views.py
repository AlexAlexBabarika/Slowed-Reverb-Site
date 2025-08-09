import uuid
from django.shortcuts import render, redirect
from django.http import HttpResponse, FileResponse, HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from mutagen import File as MutagenFile
import os, ffmpeg, tempfile, math, time
import yt_dlp

format_map = {
    'mp3': 'mp3', 'wav': 'wav', 'flac': 'flac', 'm4a': 'mov',
    'aac': 'aac', 'ogg': 'ogg', 'opus': 'opus',
}

@csrf_exempt
def index(request):
    if request.method == 'POST' and request.FILES.getlist('audio_file'):
        speed_change = float(request.POST.get('speed_change_hidden', 1.0))
        pitch_change = int(request.POST.get('pitch_change_hidden', 0))
        speed_pitch_value = request.POST.get('speed_pitch_hidden', '')

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

            artist = ""
            try:
                audio_meta = MutagenFile(input_path, easy=True)
                if (audio_meta):
                    artist = audio_meta.get("artist", ["Unknown"])[0]
            except Exception as e:
                print("Metadata error:", e)
                artist = "Unknown"

            original_path = input_path.replace(f".{ext}", "_original.wav")
            ffmpeg.input(input_path, format=input_format).\
                output(original_path, format='wav').\
                run(overwrite_output=True)
            output_path = original_path.replace('_original.wav', '_out.wav')

            # sr = int(get_sample_rate(open(input_path, 'rb')))
            # process_audio(sr, input_path, output_path, speed_change, pitch_change)

            os.remove(input_path)
            playlist.append({
                "filename": filename,
                "output_path": output_path,
                "original_path": original_path,
                "duration": get_audio_duration(original_path),
                "artist": artist
            })

        request.session["playlist"] = playlist
        request.session["speed_value"] = speed_change
        request.session["pitch_value"] = pitch_change
        request.session["speed_pitch_value"] = speed_pitch_value
        if "last_played_index" not in request.session:
            request.session["last_played_index"] = 0  # First upload
        return redirect('index')

    # GET
    speed_value = request.session.get('speed_value', 1.0)
    pitch_value = request.session.get('pitch_value', 0)
    speed_pitch_value = request.session.get('speed_pitch_value', '0.00 semitones')
    playlist = request.session.get("playlist", [])
    audio_available = any(os.path.exists(song["output_path"]) for song in playlist)
    last_played_index = request.session.get('last_played_index', None)

    return render(request, "app/index.html", {
        "audio_available": audio_available,
        "speed_value": speed_value,
        "pitch_value": pitch_value,
        "speed_pitch_value": speed_pitch_value,
        "playlist": playlist,
        "timestamp": int(time.time()),
        "last_played_index": last_played_index
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

    speed_change = float(request.POST.get('speed_change_hidden', 1.0))
    pitch_change = int(request.POST.get('pitch_change_hidden', 0))
    speed_pitch_value = request.POST.get('speed_pitch_hidden', '')

    output_path = input_path.replace('_original.wav', '_reloaded.wav')
    sr = int(get_sample_rate(open(input_path, 'rb')))
    process_audio(sr, input_path, output_path, speed_change, pitch_change)

    song["output_path"] = output_path
    song["duration"] = get_audio_duration(output_path)
    playlist[index] = song

    request.session['playlist'] = playlist
    request.session['speed_value'] = speed_change
    request.session['pitch_value'] = pitch_change
    request.session['speed_pitch_value'] = speed_pitch_value
    request.session['last_played_index'] = index

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

    speed = float(request.session.get('speed_value', 1.0))
    pitch = int(request.session.get('pitch_value', 0))

    with open(orig, 'rb') as f:
        sr = int(get_sample_rate(f))
    tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    process_audio(sr, orig, tmp_out, speed, pitch)

    song["output_path"] = tmp_out
    song["duration"] = get_audio_duration(tmp_out)
    playlist[idx] = song
    request.session['playlist'] = playlist
    request.session['last_played_index'] = idx
    request.session.modified = True

    return FileResponse(open(tmp_out, 'rb'), content_type='audio/wav')

@csrf_exempt
def download_from_youtube(request):
    if request.method != "POST":
        return HttpResponse("Invalid request", status=405)

    url = request.POST.get("youtube_url")
    if not url:
        return HttpResponse("No URL provided", status=400)

    # Generate unique base name
    uid = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    download_base = os.path.join(temp_dir, uid)  # no extension
    download_template = f"{download_base}.%(ext)s"
    final_mp3 = f"{download_base}.mp3"
    original_path = f"{download_base}_original.wav"
    output_path = f"{download_base}_out.wav"

    # yt-dlp options with browser cookies
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

    # Verify file exists
    if not os.path.exists(final_mp3):
        return HttpResponse(f"Download failed. File not found: {final_mp3}", status=500)

    # Convert to WAV
    try:
        ffmpeg.input(final_mp3).output(original_path, format='wav').run(overwrite_output=True)
    except Exception as e:
        return HttpResponse(f"FFmpeg conversion failed: {e}", status=500)

    # Process audio
    sr = int(get_sample_rate(open(final_mp3, 'rb')))
    speed_change = float(request.POST.get('speed_change_hidden', 1.0))
    pitch_change = int(request.POST.get('pitch_change_hidden', 0))
    speed_pitch_value = request.POST.get('speed_pitch_hidden', '')
    process_audio(sr, original_path, output_path, speed_change, pitch_change)

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
    request.session["speed_value"] = speed_change
    request.session["pitch_value"] = pitch_change
    request.session["speed_pitch_value"] = speed_pitch_value
    request.session["last_played_index"] = len(playlist) - 1

    # Clean up intermediate mp3
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

def process_audio(sr, input_path, output_path, speed_change, pitch_change):
    try:
        if pitch_change != 0 and abs(speed_change - 1.0) > 1e-3:
            with tempfile.NamedTemporaryFile(suffix="_mid.wav", delete=False) as mid:
                mid_path = mid.name
            change_speed(sr, input_path, mid_path, speed_change)
            change_pitch(sr, mid_path, output_path, pitch_change)
            os.remove(mid_path)
        elif pitch_change != 0:
            change_pitch(sr, input_path, output_path, pitch_change)
        else:
            change_speed(sr, input_path, output_path, speed_change)
    except ffmpeg.Error as e:
        return HttpResponse(f"Reload error: {e.stderr.decode()}", status=500)

def change_speed(sr, input_path, output_path, speed_change):
    ffmpeg.input(input_path) \
        .filter('asetrate', int(sr * speed_change)) \
        .output(output_path, ar=sr, acodec='pcm_s16le', format='wav') \
        .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)

def change_pitch(sr, input_path, output_path, pitch_change):
    pitch_ratio = math.pow(2, pitch_change / 12)
    ffmpeg.input(input_path) \
        .filter('rubberband', pitch=pitch_ratio) \
        .output(output_path, ar=sr, acodec='pcm_s16le', format='wav') \
        .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)

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

def get_audio_duration(path):
    probe = ffmpeg.probe(path)
    for stream in probe["streams"]:
        if stream["codec_type"] == "audio":
            return round(float(stream["duration"]))
    return 0

def build_variant_path(original_path, speed_change, pitch_change):
    base, _ = os.path.splitext(original_path)
    speed_tag = int(round(speed_change * 1000))
    return f"{base}_s{speed_tag}_p{pitch_change}.wav"