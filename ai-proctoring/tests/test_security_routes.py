import pytest
import numpy as np
import base64
import cv2
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app import app
from api.routes import session_manager, malpractice_detector

client = TestClient(app)

def create_synthetic_face_image_b64() -> str:
    """Create a basic synthetic 200x200 image for testing."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    # Draw simple shapes
    cv2.circle(img, (100, 100), 50, (200, 200, 200), -1)
    _, buf = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

@pytest.fixture(autouse=True)
def clean_sessions():
    session_manager.sessions.clear()
    yield
    session_manager.sessions.clear()

def test_start_session_valid():
    fake_b64 = create_synthetic_face_image_b64()
    mock_validation = {
        "success": True,
        "status_code": 200,
        "attemptId": 501,
        "studentId": "student-sec-1",
        "testCode": "CS101",
        "status": "IN_PROGRESS",
        "valid": True,
        "message": "Access authorized"
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_validation)), \
         patch("api.routes.face_detector.detect_faces", return_value=([{"landmarks": []}], [np.array([50, 50, 100, 100])])), \
         patch("api.routes.face_recognizer.extract_embedding", return_value=np.ones((1, 128), dtype=np.float32)):

        resp = client.post("/proctor/start", json={
            "attemptId": 501,
            "studentId": "student-sec-1",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "test-jwt-token"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "INITIALIZED"
        assert data["faceDetected"] is True
        assert data["referenceRegistered"] is True
        assert data["biometricReady"] is True
        assert "sessionId" in data
        assert "wsTicket" in data

def test_start_session_unauthorized_missing_token():
    fake_b64 = create_synthetic_face_image_b64()
    resp = client.post("/proctor/start", json={
        "attemptId": 502,
        "studentId": "student-sec-2",
        "testCode": "CS101",
        "referenceImage": fake_b64
    })
    assert resp.status_code == 401
    assert "MISSING_AUTH_TOKEN" in resp.json()["detail"]

def test_start_session_wrong_jwt_rejected_by_backend():
    fake_b64 = create_synthetic_face_image_b64()
    mock_validation = {
        "success": False,
        "status_code": 403,
        "error": "UNAUTHORIZED_ATTEMPT",
        "detail": "Authenticated user does not have permission for this attempt."
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_validation)):
        resp = client.post("/proctor/start", json={
            "attemptId": 503,
            "studentId": "student-sec-3",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "wrong-jwt-token"
        })
        assert resp.status_code == 403
        assert "UNAUTHORIZED_ATTEMPT" in resp.json()["detail"]

def test_start_session_wrong_student_id_mismatch():
    fake_b64 = create_synthetic_face_image_b64()
    mock_validation = {
        "success": True,
        "status_code": 200,
        "attemptId": 504,
        "studentId": "student-backend-authoritative",
        "testCode": "CS101",
        "status": "IN_PROGRESS",
        "valid": True
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_validation)):
        resp = client.post("/proctor/start", json={
            "attemptId": 504,
            "studentId": "student-spoofed-browser-id",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "token-123"
        })
        assert resp.status_code == 403
        assert "STUDENT_ID_MISMATCH" in resp.json()["detail"]

def test_start_session_wrong_attempt_not_found():
    fake_b64 = create_synthetic_face_image_b64()
    mock_validation = {
        "success": False,
        "status_code": 404,
        "error": "ATTEMPT_NOT_FOUND",
        "detail": "Attempt not found on authoritative backend."
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_validation)):
        resp = client.post("/proctor/start", json={
            "attemptId": 99999,
            "studentId": "student-sec-4",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "token-123"
        })
        assert resp.status_code == 404
        assert "ATTEMPT_NOT_FOUND" in resp.json()["detail"]

def test_start_session_attempt_inactive():
    fake_b64 = create_synthetic_face_image_b64()
    mock_validation = {
        "success": True,
        "status_code": 200,
        "attemptId": 505,
        "studentId": "student-sec-5",
        "testCode": "CS101",
        "status": "SUBMITTED",
        "valid": False
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_validation)):
        resp = client.post("/proctor/start", json={
            "attemptId": 505,
            "studentId": "student-sec-5",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "token-123"
        })
        assert resp.status_code == 403
        assert "ATTEMPT_INACTIVE" in resp.json()["detail"]

def test_analyze_frame_valid_with_ticket():
    session = session_manager.create_session(
        attempt_id=601,
        student_id="student-frame-1",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-frame-1"
    )

    resp = client.post("/proctor/analyze-frame", json={
        "sessionId": session.session_id,
        "ticket": session.ws_ticket,
        "studentId": "student-frame-1",
        "attemptId": 601
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ACTIVE"

def test_analyze_frame_valid_with_bearer_token():
    session = session_manager.create_session(
        attempt_id=602,
        student_id="student-frame-2",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-frame-2"
    )

    resp = client.post(
        "/proctor/analyze-frame",
        json={"sessionId": session.session_id},
        headers={"Authorization": "Bearer jwt-frame-2"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ACTIVE"

def test_analyze_frame_unauthorized_missing_credentials():
    session = session_manager.create_session(
        attempt_id=603,
        student_id="student-frame-3",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-frame-3"
    )

    # Calling with only sessionId
    resp = client.post("/proctor/analyze-frame", json={
        "sessionId": session.session_id
    })
    assert resp.status_code == 401
    assert "INVALID_CREDENTIALS" in resp.json()["detail"]

def test_analyze_frame_wrong_student_session():
    session = session_manager.create_session(
        attempt_id=604,
        student_id="student-owner",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-owner"
    )

    resp = client.post("/proctor/analyze-frame", json={
        "sessionId": session.session_id,
        "ticket": session.ws_ticket,
        "studentId": "student-attacker",
        "attemptId": 604
    })
    assert resp.status_code == 403
    assert "STUDENT_MISMATCH" in resp.json()["detail"]

def test_analyze_frame_inactive_session():
    session = session_manager.create_session(
        attempt_id=605,
        student_id="student-frame-5",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-frame-5"
    )
    session_manager.end_session(session.session_id)

    resp = client.post("/proctor/analyze-frame", json={
        "sessionId": session.session_id,
        "ticket": session.ws_ticket
    })
    assert resp.status_code == 403
    assert "SESSION_INACTIVE" in resp.json()["detail"]

def test_stop_session_valid():
    session = session_manager.create_session(
        attempt_id=701,
        student_id="student-stop-1",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-stop-1"
    )

    with patch.object(malpractice_detector, "dispatch_session_summary", new=AsyncMock()) as mock_dispatch:
        resp = client.post("/proctor/stop", json={
            "sessionId": session.session_id,
            "ticket": session.ws_ticket,
            "studentId": "student-stop-1",
            "attemptId": 701
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "STOPPED"
        assert session.is_active is False
        mock_dispatch.assert_called_once()

def test_stop_session_unauthorized_missing_credentials():
    session = session_manager.create_session(
        attempt_id=702,
        student_id="student-stop-2",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-stop-2"
    )

    resp = client.post("/proctor/stop", json={
        "sessionId": session.session_id
    })
    assert resp.status_code == 401
    assert "INVALID_CREDENTIALS" in resp.json()["detail"]

def test_stop_session_another_student():
    session = session_manager.create_session(
        attempt_id=703,
        student_id="student-legit",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-legit"
    )

    resp = client.post("/proctor/stop", json={
        "sessionId": session.session_id,
        "ticket": session.ws_ticket,
        "studentId": "student-imposter"
    })
    assert resp.status_code == 403
    assert "STUDENT_MISMATCH" in resp.json()["detail"]

def test_stop_session_duplicate_idempotent():
    session = session_manager.create_session(
        attempt_id=704,
        student_id="student-stop-dup",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-stop-dup"
    )

    with patch.object(malpractice_detector, "dispatch_session_summary", new=AsyncMock()) as mock_dispatch:
        # First stop
        resp1 = client.post("/proctor/stop", json={
            "sessionId": session.session_id,
            "ticket": session.ws_ticket
        })
        assert resp1.status_code == 200
        assert mock_dispatch.call_count == 1

        # Second stop (idempotent)
        resp2 = client.post("/proctor/stop", json={
            "sessionId": session.session_id,
            "ticket": session.ws_ticket
        })
        assert resp2.status_code == 200
        # Exactly one session summary dispatched!
        assert mock_dispatch.call_count == 1

def test_session_endpoint_authorized_and_sanitized():
    session = session_manager.create_session(
        attempt_id=801,
        student_id="student-get-1",
        test_code="CS101",
        reference_embedding=np.ones((1, 128), dtype=np.float32),
        reference_image_b64="data:image/jpeg;base64,SECRET_IMAGE",
        auth_token="super-secret-jwt"
    )

    resp = client.get(
        f"/proctor/session/{session.session_id}?ticket={session.ws_ticket}&student_id=student-get-1&attempt_id=801"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == session.session_id
    assert data["attemptId"] == 801
    assert data["studentId"] == "student-get-1"
    assert data["isActive"] is True

    # Critical Privacy & Security Checks: Secrets and raw embeddings MUST NOT be present
    assert "wsTicket" not in data
    assert "authToken" not in data
    assert "reference_embedding" not in data
    assert "referenceEmbedding" not in data
    assert "referenceImage" not in data
    assert "reference_image_b64" not in data

def test_session_endpoint_unauthorized():
    session = session_manager.create_session(
        attempt_id=802,
        student_id="student-get-2",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-get-2"
    )

    # Calling without any ticket or token
    resp = client.get(f"/proctor/session/{session.session_id}")
    assert resp.status_code == 401
    assert "INVALID_CREDENTIALS" in resp.json()["detail"]

def test_session_endpoint_nonexistent():
    resp = client.get("/proctor/session/00000000-0000-0000-0000-000000000000?ticket=fake-ticket")
    assert resp.status_code == 404

# ============================================================================
# EXPLICIT ATTACK SCENARIO TESTS (A - L)
# ============================================================================

def test_attack_scenario_a_student_a_cannot_access_student_b_session():
    """Attack A: Student A attempts to access Student B's session with Student A's credentials."""
    session_b = session_manager.create_session(
        attempt_id=901,
        student_id="student_B",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_B"
    )

    # Student A tries to get details using Student A's token
    resp = client.get(
        f"/proctor/session/{session_b.session_id}",
        headers={"Authorization": "Bearer jwt_student_A"}
    )
    assert resp.status_code in [401, 403]
    assert "INVALID_CREDENTIALS" in resp.json()["detail"] or "STUDENT_MISMATCH" in resp.json()["detail"]

def test_attack_scenario_b_student_a_cannot_analyze_frames_for_student_b():
    """Attack B: Student A attempts to inject analyze-frame into Student B's session."""
    session_b = session_manager.create_session(
        attempt_id=902,
        student_id="student_B",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_B"
    )

    resp = client.post(
        "/proctor/analyze-frame",
        json={
            "sessionId": session_b.session_id,
            "studentId": "student_A",
            "attemptId": 902
        },
        headers={"Authorization": "Bearer jwt_student_A"}
    )
    assert resp.status_code in [401, 403]

def test_attack_scenario_c_student_a_cannot_stop_student_b_session():
    """Attack C: Student A attempts to maliciously stop Student B's session."""
    session_b = session_manager.create_session(
        attempt_id=903,
        student_id="student_B",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_B"
    )

    resp = client.post(
        "/proctor/stop",
        json={
            "sessionId": session_b.session_id,
            "studentId": "student_A"
        },
        headers={"Authorization": "Bearer jwt_student_A"}
    )
    assert resp.status_code in [401, 403]
    # Session B should remain active
    assert session_b.is_active is True

def test_attack_scenario_d_student_a_cannot_retrieve_student_b_session_details():
    """Attack D: Student A tries to query Student B's session endpoint with spoofed studentId."""
    session_b = session_manager.create_session(
        attempt_id=904,
        student_id="student_B",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_B"
    )

    resp = client.get(
        f"/proctor/session/{session_b.session_id}?student_id=student_B",
        headers={"Authorization": "Bearer jwt_student_A"}
    )
    assert resp.status_code in [401, 403]

def test_attack_scenario_e_student_a_jwt_with_student_b_attempt_id():
    """Attack E: Student A uses Student A's valid JWT but targets Student B's attempt ID."""
    fake_b64 = create_synthetic_face_image_b64()
    mock_backend_response = {
        "success": False,
        "status_code": 403,
        "error": "ACCESS_DENIED",
        "detail": "Authenticated user (Student A) is not the owner of attempt 905 (Student B)."
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_backend_response)):
        resp = client.post("/proctor/start", json={
            "attemptId": 905,
            "studentId": "student_A",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "jwt_student_A"
        })
        assert resp.status_code == 403
        assert "ACCESS_DENIED" in resp.json()["detail"]

def test_attack_scenario_f_spoofed_browser_studentid_cannot_override_backend():
    """Attack F: Student sends spoofed studentId in request payload, but Spring Boot returns actual studentId."""
    fake_b64 = create_synthetic_face_image_b64()
    mock_backend_response = {
        "success": True,
        "status_code": 200,
        "attemptId": 906,
        "studentId": "real_student_42",
        "testCode": "CS101",
        "status": "IN_PROGRESS",
        "valid": True
    }

    with patch.object(malpractice_detector, "verify_backend_attempt_access", new=AsyncMock(return_value=mock_backend_response)):
        resp = client.post("/proctor/start", json={
            "attemptId": 906,
            "studentId": "spoofed_student_999",
            "testCode": "CS101",
            "referenceImage": fake_b64,
            "authToken": "jwt_real_student_42"
        })
        # Must be rejected because request studentId doesn't match authoritative backend studentId
        assert resp.status_code == 403
        assert "STUDENT_ID_MISMATCH" in resp.json()["detail"]

def test_attack_scenario_i_cross_session_ticket_reuse():
    """Attack I: Valid ticket belonging to Session A cannot be reused on Session B."""
    session_a = session_manager.create_session(
        attempt_id=907,
        student_id="student_A",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_A"
    )
    session_b = session_manager.create_session(
        attempt_id=908,
        student_id="student_B",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt_student_B"
    )

    ticket_a = session_a.ws_ticket

    # Attempt to analyze frame on Session B using Ticket A
    resp_analyze = client.post("/proctor/analyze-frame", json={
        "sessionId": session_b.session_id,
        "ticket": ticket_a
    })
    assert resp_analyze.status_code in [401, 403]

    # Attempt to stop Session B using Ticket A
    resp_stop = client.post("/proctor/stop", json={
        "sessionId": session_b.session_id,
        "ticket": ticket_a
    })
    assert resp_stop.status_code in [401, 403]

    # Attempt to get Session B details using Ticket A
    resp_get = client.get(f"/proctor/session/{session_b.session_id}?ticket={ticket_a}")
    assert resp_get.status_code in [401, 403]

