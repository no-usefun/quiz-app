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

def test_audio_empty_and_none_input():
    detector = AudioActivityDetector(sample_rate=16000)
    res_none = detector.analyze_pcm_samples(None)
    assert res_none["mic_level"] == 0.0
    assert res_none["is_speech"] is False
    assert res_none["is_loud"] is False

    res_empty = detector.analyze_pcm_samples([])
    assert res_empty["mic_level"] == 0.0
    assert res_empty["is_speech"] is False

    res_short = detector.analyze_pcm_samples([0.5] * 32)
    assert res_short["mic_level"] == 0.0
    assert res_short["is_speech"] is False

def test_audio_nan_and_inf_handling():
    detector = AudioActivityDetector(sample_rate=16000)
    dirty_samples = [np.nan, np.inf, -np.inf, 0.1, 0.2] * 200
    res = detector.analyze_pcm_samples(dirty_samples)
    assert np.isfinite(res["mic_level"])
    assert isinstance(res["is_speech"], bool)
    assert isinstance(res["is_loud"], bool)

def test_audio_low_volume_whisper():
    detector = AudioActivityDetector(sample_rate=16000)
    t = np.linspace(0, 0.1, 1600, endpoint=False)
    # Very faint tone below energy threshold
    faint_tone = 0.005 * np.sin(2 * np.pi * 1000 * t)
    res = detector.analyze_pcm_samples(faint_tone.tolist())
    assert res["is_speech"] is False
    assert res["is_loud"] is False

def test_audio_dynamic_browser_sample_rates():
    detector = AudioActivityDetector(sample_rate=16000)
    # Test with 48kHz audio (standard browser Web Audio sample rate)
    sr_48k = 48000
    t_48k = np.linspace(0, 0.1, 4800, endpoint=False)
    tone_48k = 0.6 * np.sin(2 * np.pi * 1000 * t_48k)
    res_48k = detector.analyze_pcm_samples(tone_48k.tolist(), sample_rate=sr_48k)
    assert res_48k["is_speech"] is True
    assert res_48k["mic_level"] > 0.1

    # Test with 44.1kHz audio
    sr_44k = 44100
    t_44k = np.linspace(0, 0.1, 4410, endpoint=False)
    tone_44k = 0.6 * np.sin(2 * np.pi * 1000 * t_44k)
    res_44k = detector.analyze_pcm_samples(tone_44k.tolist(), sample_rate=sr_44k)
    assert res_44k["is_speech"] is True
