-- AI Proctoring V2: durable event idempotency.
-- Run against the target PostgreSQL database before deploying the updated backend.
-- Existing rows remain valid because client_event_id is nullable.

ALTER TABLE public.quiz_attempt_proctoring_events
    ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proctoring_attempt_client_event
    ON public.quiz_attempt_proctoring_events (attempt_id, client_event_id);
