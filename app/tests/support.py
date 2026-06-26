import ffmpeg


def make_test_audio(path: str, seconds: float = 1.0) -> None:
    """Synthesize a sine-wave audio file at `path` using ffmpeg's lavfi source."""
    (
        ffmpeg.input(f"sine=frequency=440:duration={seconds}", f="lavfi")
        .output(path, loglevel="error")
        .overwrite_output()
        .run()
    )
