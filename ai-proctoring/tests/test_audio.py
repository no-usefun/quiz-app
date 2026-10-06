import pytest
import numpy as np
from detection.audio_detector import AudioActivityDetector

def test_audio_detector_init():
    detector = AudioActivityDetector()
    assert detector is not None

def test_audio_silence():
    detector = AudioActivityDetector(sample_rate=16000)
    silence = [0.0] * 1024
    res = detector.analyze_pcm_samples(silence)
    assert res["mic_level"] == 0.0
    assert res["is_speech"] is False
    assert res["is_loud"] is False

def test_audio_speech_tone():
    detector = AudioActivityDetector(sample_rate=16000)
    # Generate 1000Hz tone (in human speech band 300Hz-3400Hz)
    t = np.linspace(0, 0.1, 1600, endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 1000 * t)
    res = detector.analyze_pcm_samples(tone.tolist())
    assert res["mic_level"] > 0.1
    assert res["is_speech"] is True

def test_audio_loud_voice():
    detector = AudioActivityDetector(sample_rate=16000)
    t = np.linspace(0, 0.1, 1600, endpoint=False)
    loud_tone = 0.95 * np.sin(2 * np.pi * 1000 * t)
    res = detector.analyze_pcm_samples(loud_tone.tolist())
    assert res["is_loud"] is True
