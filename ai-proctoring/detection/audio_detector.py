import numpy as np
import logging
from config import VAD_ENERGY_THRESHOLD, VAD_SPEECH_FREQ_MIN, VAD_SPEECH_FREQ_MAX, LOUD_VOICE_RMS_THRESHOLD

logger = logging.getLogger("ai-proctoring.audio_detector")

class AudioActivityDetector:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate

    def analyze_pcm_samples(self, samples: list[float] | np.ndarray) -> dict:
        """
        Analyzes audio samples to separate:
        - MIC LEVEL: RMS amplitude normalized [0.0, 1.0]
        - VOICE ACTIVITY: Frequency-domain speech formant detection vs background noise
        - LOUD VOICE: Confirmed speech with RMS > LOUD_VOICE_RMS_THRESHOLD
        """
        if samples is None or len(samples) == 0:
            return {
                "mic_level": 0.0,
                "is_speech": False,
                "speech_confidence": 0.0,
                "is_loud": False
            }

        audio_arr = np.array(samples, dtype=np.float32)
        if len(audio_arr) < 64:
            return {
                "mic_level": 0.0,
                "is_speech": False,
                "speech_confidence": 0.0,
                "is_loud": False
            }

        # 1. Calculate RMS Mic Level
        rms = float(np.sqrt(np.mean(np.square(audio_arr))))
        mic_level = min(1.0, rms * 3.0)  # Scale for visual sensitivity

        if rms < VAD_ENERGY_THRESHOLD:
            # Below noise floor
            return {
                "mic_level": round(mic_level, 3),
                "is_speech": False,
                "speech_confidence": 0.0,
                "is_loud": False
            }

        # 2. Spectral Analysis for Speech Formants (300Hz - 3400Hz)
        fft_vals = np.abs(np.fft.rfft(audio_arr))
        freqs = np.fft.rfftfreq(len(audio_arr), 1.0 / self.sample_rate)

        total_energy = np.sum(fft_vals ** 2) + 1e-10
        speech_band_mask = (freqs >= VAD_SPEECH_FREQ_MIN) & (freqs <= VAD_SPEECH_FREQ_MAX)
        speech_energy = np.sum(fft_vals[speech_band_mask] ** 2)
        speech_ratio = float(speech_energy / total_energy)

        # 3. Zero Crossing Rate (ZCR)
        zero_crossings = np.sum(np.abs(np.diff(np.sign(audio_arr)))) / (2.0 * len(audio_arr))

        # Human speech exhibits moderate ZCR (0.04 - 0.40) and high speech-band energy ratio (> 0.35)
        is_speech_zcr = 0.03 <= zero_crossings <= 0.45
        is_speech_band = speech_ratio >= 0.30

        confidence = 0.0
        if is_speech_band and is_speech_zcr and rms >= VAD_ENERGY_THRESHOLD:
            confidence = min(1.0, (speech_ratio * 0.7) + (min(1.0, rms * 5.0) * 0.3))

        is_speech = confidence >= 0.45
        is_loud = is_speech and (mic_level >= LOUD_VOICE_RMS_THRESHOLD or rms >= 0.50)

        return {
            "mic_level": round(mic_level, 3),
            "is_speech": is_speech,
            "speech_confidence": round(confidence, 3),
            "is_loud": is_loud
        }
