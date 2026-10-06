import pytest
import numpy as np
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
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
        assert resp.get("sessionId") == session.session_id

def test_websocket_invalid_ticket():
    session = session_manager.create_session(
        attempt_id=201,
        student_id="student-ws-2",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="valid-jwt-token"
    )

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": "completely-invalid-ticket",
                "authToken": "wrong-token",
                "studentId": "student-ws-2",
                "attemptId": 201
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

def test_websocket_invalid_jwt():
    session = session_manager.create_session(
        attempt_id=202,
        student_id="student-ws-jwt",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="expected-token-abc"
    )

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "authToken": "unmatched-token-xyz",
                "studentId": "student-ws-jwt",
                "attemptId": 202
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

def test_websocket_wrong_student():
    session = session_manager.create_session(
        attempt_id=203,
        student_id="student-real",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="valid-jwt"
    )

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": session.ws_ticket,
                "studentId": "student-imposter",
                "attemptId": 203
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

def test_websocket_wrong_attempt():
    session = session_manager.create_session(
        attempt_id=204,
        student_id="student-attempt-test",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="valid-jwt"
    )

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": session.ws_ticket,
                "studentId": "student-attempt-test",
                "attemptId": 99999
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

def test_websocket_missing_auth():
    session = session_manager.create_session(
        attempt_id=205,
        student_id="student-noauth",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            websocket.send_json({
                "type": "telemetry",
                "frame": "dummy"
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

def test_websocket_nonexistent_session():
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/proctor/00000000-0000-0000-0000-000000000000") as websocket:
            resp = websocket.receive_json()
            assert resp.get("error") == "SESSION_NOT_FOUND"
            websocket.receive_text()
    assert excinfo.value.code == 4004

def test_websocket_inactive_session():
    session = session_manager.create_session(
        attempt_id=206,
        student_id="student-inactive",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )
    session_manager.end_session(session.session_id)

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session.session_id}") as websocket:
            resp = websocket.receive_json()
            assert resp.get("error") == "SESSION_INACTIVE"
            websocket.receive_text()
    assert excinfo.value.code == 4003

def test_websocket_cross_session_ticket_reuse():
    """Attack I: Valid ticket of Session A cannot authenticate Session B WebSocket."""
    session_a = session_manager.create_session(
        attempt_id=207,
        student_id="student-ws-a",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-a"
    )
    session_b = session_manager.create_session(
        attempt_id=208,
        student_id="student-ws-b",
        test_code="TEST101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32),
        auth_token="jwt-b"
    )

    ticket_a = session_a.ws_ticket

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/ws/proctor/{session_b.session_id}") as websocket:
            websocket.send_json({
                "type": "auth",
                "ticket": ticket_a,
                "studentId": "student-ws-b",
                "attemptId": 208
            })
            resp = websocket.receive_json()
            assert resp.get("error") == "UNAUTHORIZED"
            websocket.receive_text()
    assert excinfo.value.code == 4001

