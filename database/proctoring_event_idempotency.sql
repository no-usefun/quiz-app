-- Add durable client-side event idempotency for AI proctoring events.
-- Existing events remain valid because client_event_id is nullable.
ALTER TABLE quiz_attempt_proctoring_events
    ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(100);

-- PostgreSQL permits multiple NULLs in a unique index, preserving legacy clients.
CREATE UNIQUE INDEX IF NOT EXISTS uq_proctoring_attempt_client_event
    ON quiz_attempt_proctoring_events (attempt_id, client_event_id);
