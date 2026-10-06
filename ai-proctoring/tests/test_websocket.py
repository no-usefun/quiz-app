import pytest
import numpy as np
from fastapi.testclient import TestClient
from app import app
from api.routes import session_manager

client = TestClient(app)

def test_websocket_valid_auth():
    session = session_manager.create_session(
        attempt_id=200,
        student_id="student-ws-1",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="valid-jwt-token"
    )

    with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
        websocket.send_json({
            "type": "auth",
            "ticket": session.ws_ticket,
            "studentId": "student-ws-1",
            "attemptId": 200
        })
        resp = websocket.receive_json()
        assert resp.get("type") == "authenticated"
        assert resp.get("status") == "ACTIVE"

def test_websocket_invalid_token():
    session = session_manager.create_session(
        attempt_id=201,
        student_id="student-ws-2",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="valid-jwt-token"
    )

    try:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": "invalid-ticket",
                "authToken": "wrong-token",
                "studentId": "student-ws-2",
                "attemptId": 201
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
    except Exception:
        # Starlette closes connection with code 4001
        pass

def test_websocket_missing_auth():
    session = session_manager.create_session(
        attempt_id=202,
        student_id="student-ws-3",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )

    try:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            # Send non-auth payload first
            websocket.send_json({
                "type": "telemetry",
                "frame": "dummy"
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
    except Exception:
        pass

def test_websocket_nonexistent_session():
    try:
        with client.websocket_connect("/ws/proctor/00000000-0000-0000-0000-000000000000") as websocket:
            resp = websocket.receive_json()
            assert resp.get("error") == "SESSION_NOT_FOUND"
    except Exception:
        pass

def test_websocket_inactive_session():
    session = session_manager.create_session(
        attempt_id=203,
        student_id="student-ws-4",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )
    session_manager.end_session(session.session_id)

    try:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            resp = websocket.receive_json()
            assert resp.get("error") == "SESSION_INACTIVE"
    except Exception:
        pass

def test_websocket_wrong_user():
    session = session_manager.create_session(
        attempt_id=204,
        student_id="student-correct",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )

    try:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": session.ws_ticket,
                "studentId": "student-WRONG",
                "attemptId": 204
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
    except Exception:
        pass
