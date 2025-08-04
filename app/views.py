from django.shortcuts import render, redirect
from django.http import HttpResponse 
from django.views.decorators.csrf import csrf_exempt
import os
import ffmpeg
import tempfile
import math

format_map = {
    'mp3': 'mp3',
    'wav': 'wav',
    'flac': 'flac',
    'm4a': 'mov',  
    'aac': 'aac',
    'ogg': 'ogg',
    'opus': 'opus',
}

@csrf_exempt
def index(request):
    if request.method == 'POST' and 'audio_file' in request.FILES:
        speed_change = float(request.POST.get('speed_change_hidden', 1.0))
        pitch_change = int(request.POST.get('pitch_change_hidden', 0))
        speed_pitch_value = request.POST.get('speed_pitch_hidden', '')

        file = request.FILES['audio_file']
        filename = file.name

        ext = os.path.splitext(filename)[1].lower().replace('.', '')

        input_format = format_map.get(ext)
        if not input_format: return HttpResponse(f"Unsupported audio format: {ext}", status=400)

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp_in:
            tmp_in.write(file.read())
            tmp_in.flush()
            input_path = tmp_in.name

        original_path = input_path.replace(f".{ext}", "_original.wav")
        ffmpeg.input(input_path, format=input_format).output(original_path, format='wav').run(overwrite_output=True)
        request.session['original_audio_path'] = original_path  # ✅ store for reload use

        output_path = input_path.replace(f'.{ext}', f'_out.wav')

        sr = int(get_sample_rate(open(input_path, 'rb')))
        try:
            intermediate_path = None

            # If pitch and speed are both changed, use intermediate file
            if pitch_change != 0 and abs(speed_change - 1.0) > 1e-3:
                with tempfile.NamedTemporaryFile(suffix="_mid.wav", delete=False) as mid:
                    intermediate_path = mid.name
                change_speed(sr, input_path, intermediate_path, speed_change)
                change_pitch(sr, intermediate_path, output_path, pitch_change)
                os.remove(intermediate_path)

            elif pitch_change != 0:
                change_pitch(sr, input_path, output_path, pitch_change)
            else:
                change_speed(sr, input_path, output_path, speed_change)

        finally:
            os.remove(input_path)

        request.session['audio_file_path'] = output_path
        request.session["speed_value"] = speed_change
        request.session["pitch_value"] = pitch_change
        request.session["speed_pitch_value"] = speed_pitch_value
        
        return redirect('index')

    speed_value = request.session.get('speed_value', 1.0)
    pitch_value = request.session.get('pitch_value', 0)
    speed_pitch_value = request.session.get('speed_pitch_value', 0.0)
    audio_available = os.path.exists(request.session.get('audio_file_path', ''))

    return render(request, "app/index.html", {"audio_available": audio_available,
                                              "speed_value": speed_value,
                                              "pitch_value": pitch_value,
                                              "speed_pitch_value": speed_pitch_value})

@csrf_exempt
def reload_audio(request):
    speed_change = float(request.POST.get('speed_change_hidden', 1.0))
    pitch_change = int(request.POST.get('pitch_change_hidden', 0))
    speed_pitch_value = request.POST.get('speed_pitch_hidden', '')

    input_path = request.session.get('original_audio_path')
    if not input_path or not os.path.exists(input_path):
        return HttpResponse("Original audio not found", status=404)

    output_path = input_path.replace('_original.wav', '_reloaded.wav')
    sr = get_sample_rate(open(input_path, 'rb'))

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
        return HttpResponse(f"Reload processing failed:<br>{e.stderr.decode()}", status=500)

    request.session['audio_file_path'] = output_path
    request.session['speed_value'] = speed_change
    request.session['pitch_value'] = pitch_change
    request.session['speed_pitch_value'] = speed_pitch_value

    return redirect('index')

def change_speed(sr, input_path, output_path, speed_change):
    target_rate = int(sr * speed_change)

    ffmpeg.input(input_path) \
        .filter('asetrate', str(target_rate)) \
        .output(output_path, ar=sr, acodec='pcm_s16le', format='wav') \
        .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)

def change_pitch(sr, input_path, output_path, pitch_change):
    pitch_scale12 = math.pow(2, pitch_change / 12)

    ffmpeg.input(input_path) \
    .filter('rubberband', pitch=pitch_scale12) \
    .output(output_path, ar=sr, acodec='pcm_s16le', format='wav') \
    .run(overwrite_output=True, capture_stdout=True, capture_stderr=True)

def get_sample_rate(file_obj):
    # Save file-like object to bytes
    file_bytes = file_obj.read()
    
    # Write temp buffer to pass to probe
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp.flush()
        tmp_path = tmp.name

    # Probe with ffmpeg
    try:
        info = ffmpeg.probe(tmp_path)
        for stream in info['streams']:
            if stream['codec_type'] == 'audio':
                return int(stream['sample_rate'])
    finally:
        os.unlink(tmp_path)  # clean up

    return 44100  # fallback

def serve_audio(request):
    path = request.session.pop('audio_file_path', None)  # remove from session
    if not path or not os.path.exists(path):
        return HttpResponse(status=404)

    with open(path, 'rb') as f:
        audio_data = f.read()

    try:
        os.remove(path)  # 🔥 delete file
    except Exception as e:
        print(f"Warning: couldn't delete temp audio file: {e}")

    return HttpResponse(audio_data, content_type='audio/wav')