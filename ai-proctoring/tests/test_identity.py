import pytest
import numpy as np
from detection.face_recognition import BiometricFaceRecognizer

def test_biometric_recognizer_init():
    recognizer = BiometricFaceRecognizer()
    assert recognizer is not None

def test_biometric_matching_identical():
    recognizer = BiometricFaceRecognizer()
    emb1 = np.random.randn(1, 128).astype(np.float32)
    emb1 = emb1 / np.linalg.norm(emb1)
    
    is_match, score = recognizer.match(emb1, emb1)
    assert is_match is True
    assert score > 0.99

def test_biometric_matching_different():
    recognizer = BiometricFaceRecognizer()
    emb1 = np.zeros((1, 128), dtype=np.float32)
    emb1[0, 0] = 1.0
    
    emb2 = np.zeros((1, 128), dtype=np.float32)
    emb2[0, 1] = 1.0  # Orthogonal vector
    
    is_match, score = recognizer.match(emb1, emb2)
    assert is_match is False
    assert score < 0.1

def test_biometric_none_inputs_never_match():
    recognizer = BiometricFaceRecognizer()
    assert recognizer.match(None, None) == (False, 0.0)
    emb = np.random.randn(1, 128).astype(np.float32)
    assert recognizer.match(emb, None) == (False, 0.0)
    assert recognizer.match(None, emb) == (False, 0.0)

def test_biometric_extract_embedding_invalid_inputs():
    recognizer = BiometricFaceRecognizer()
    assert recognizer.extract_embedding(None, None) is None
    assert recognizer.extract_embedding(np.zeros((10, 10, 3), dtype=np.uint8), None) is None
