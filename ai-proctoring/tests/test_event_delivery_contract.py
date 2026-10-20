import httpx
import pytest

from detection.malpractice_detector import MalpracticeDetector
from sessions.session_manager import SessionManager


class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class SequencedClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def post(self, url, *, json, headers):
        self.calls.append({"url": url, "json": dict(json), "headers": dict(headers)})
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@pytest.mark.asyncio
async def test_event_retry_reuses_event_id_and_epoch_seconds_timestamp():
    detector = MalpracticeDetector()
    session = SessionManager().create_session(
        attempt_id=123,
        student_id="student-123",
        test_code="TEST123",
        spring_boot_url="https://backend.example",
        auth_token="test-token",
    )
    client = SequencedClient([
        httpx.ConnectError("temporary network failure", request=httpx.Request("POST", "https://backend.example/events")),
        FakeResponse(200, {"recorded": True, "warningCount": 1, "autoSubmitted": False}),
    ])
    detector.http_client = client

    result = await detector._dispatch_to_spring_boot(
        session=session,
        event_type="PHONE_DETECTED",
        details="A mobile phone was detected.",
        severity="CRITICAL",
        confidence=0.94,
        event_id="123:PHONE_DETECTED:stable-test-id",
        frame_timestamp=1792508400.0,
    )

    assert result["recorded"] is True
    assert len(client.calls) == 2
    first = client.calls[0]["json"]
    second = client.calls[1]["json"]
    assert first == second
    assert first["eventId"] == "123:PHONE_DETECTED:stable-test-id"
    assert first["frameTimestamp"] == 1792508400.0
    assert first["confidence"] == 0.94
    assert client.calls[0]["headers"]["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_permanent_auth_failure_is_not_retried():
    detector = MalpracticeDetector()
    session = SessionManager().create_session(
        attempt_id=124,
        student_id="student-124",
        test_code="TEST124",
        spring_boot_url="https://backend.example",
        auth_token="test-token",
    )
    client = SequencedClient([FakeResponse(401, {"message": "unauthorized"})])
    detector.http_client = client

    result = await detector._dispatch_to_spring_boot(
        session=session,
        event_type="FACE_NOT_DETECTED",
        details="No face detected.",
        severity="HIGH",
        confidence=0.95,
        event_id="124:FACE_NOT_DETECTED:stable-test-id",
    )

    assert result is None
    assert len(client.calls) == 1
    assert "frameTimestamp" not in client.calls[0]["json"]
