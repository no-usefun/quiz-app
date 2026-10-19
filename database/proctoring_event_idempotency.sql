-- Quizly AI Proctoring additive migration.
-- Apply to a DEVELOPMENT/TEST database before running the feature/backend backend.
-- Safe for databases where the legacy event table/attempt columns already exist.

-- The clean database/schema.sql currently does not create this table.
-- Existing online_quiz_dev databases may already have it via update_online_quiz_dev.sql.
CREATE TABLE IF NOT EXISTS quiz_attempt_proctoring_events (
    event_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL
        REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_time
    ON quiz_attempt_proctoring_events(attempt_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_type
    ON quiz_attempt_proctoring_events(attempt_id, event_type);

-- Proctoring fields used by the current JPA entities/services.
ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS warnings_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refresh_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reconnect_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS final_score DECIMAL(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(50);

-- Stable client-provided event key makes retries idempotent.
-- NULL is allowed for legacy clients; PostgreSQL unique indexes allow multiple NULL values.
ALTER TABLE quiz_attempt_proctoring_events
    ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_proctoring_attempt_client_event
    ON quiz_attempt_proctoring_events(attempt_id, client_event_id);
