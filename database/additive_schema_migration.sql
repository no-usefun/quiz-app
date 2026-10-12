-- ============================================================================
-- QUIZLY Neon Database — Additive Schema Updates
-- Compatible with Render live deployment and PostgreSQL 15/16
-- STRICTLY ADDITIVE: No drops, no renames, no deletions.
-- ============================================================================

-- =========================================================
-- 1. QUIZZES: add required columns only when missing
-- =========================================================
ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS quiz_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS subject VARCHAR(100) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50) NOT NULL DEFAULT 'GEN-101',
    ADD COLUMN IF NOT EXISTS total_students INTEGER,
    ADD COLUMN IF NOT EXISTS result_visibility VARCHAR(20) NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accepted_email_domain VARCHAR(255);

-- Add constraints only if an equivalent named constraint is not present.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_quizzes_quiz_code'
          AND conrelid = 'public.quizzes'::regclass
    ) THEN
        ALTER TABLE public.quizzes
            ADD CONSTRAINT uq_quizzes_quiz_code UNIQUE (quiz_code);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_quizzes_total_students_nonnegative'
          AND conrelid = 'public.quizzes'::regclass
    ) THEN
        ALTER TABLE public.quizzes
            ADD CONSTRAINT chk_quizzes_total_students_nonnegative
            CHECK (total_students IS NULL OR total_students >= 0) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_quizzes_result_visibility_additive'
          AND conrelid = 'public.quizzes'::regclass
    ) THEN
        ALTER TABLE public.quizzes
            ADD CONSTRAINT chk_quizzes_result_visibility_additive
            CHECK (result_visibility IN ('NONE', 'LEADERBOARD', 'QUESTION_WISE', 'BOTH')) NOT VALID;
    END IF;
END $$;

-- =========================================================
-- 2. USERS: add registration_no only if it is missing
-- =========================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100);

-- =========================================================
-- 3. QUIZ ALLOWED STUDENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS quiz_allowed_students (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(quiz_id) ON UPDATE CASCADE ON DELETE CASCADE,
    registration_number VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_quiz_allowed_students UNIQUE (quiz_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_quiz_allowed_students_lookup
    ON quiz_allowed_students(quiz_id, registration_number);

-- =========================================================
-- 4. EMAIL VERIFICATION TOKENS
-- =========================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
    ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expiry
    ON email_verification_tokens(expires_at);

-- =========================================================
-- 5. USER IDENTITIES / OIDC SSO
-- =========================================================
CREATE TABLE IF NOT EXISTS user_identities (
    identity_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    issuer VARCHAR(500) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_identity UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
    ON user_identities(user_id);

-- =========================================================
-- 6. PASSWORD RESET TOKENS
-- =========================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
    ON password_reset_tokens(expires_at);

-- =========================================================
-- 7. USER NOTIFICATION PREFERENCES
-- =========================================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    preference_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    assessment_results BOOLEAN NOT NULL DEFAULT TRUE,
    upcoming_assessments BOOLEAN NOT NULL DEFAULT TRUE,
    proctoring_reports BOOLEAN NOT NULL DEFAULT FALSE,
    browser_push BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================================
-- 8. OFFLINE EXAMS
-- =========================================================
CREATE TABLE IF NOT EXISTS offline_exams (
    offline_exam_id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL UNIQUE REFERENCES quizzes(quiz_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PREPARING', 'READY', 'RUNNING', 'ENDED')),
    prepared_at TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offline_exams_status
    ON offline_exams(status);

-- =========================================================
-- 9. PROCTORING EVENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS quiz_attempt_proctoring_events (
    event_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id)
        ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_time
    ON quiz_attempt_proctoring_events(attempt_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_type
    ON quiz_attempt_proctoring_events(attempt_id, event_type);

-- =========================================================
-- 10. QUIZ ATTEMPTS: add termination_reason if absent
-- =========================================================
ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(50);

-- =========================================================
-- 11. OPTIONS: add positive-order check without dropping any existing checks
-- =========================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_option_order_positive'
          AND conrelid = 'public.options'::regclass
    ) THEN
        ALTER TABLE public.options
            ADD CONSTRAINT chk_option_order_positive
            CHECK (option_order > 0) NOT VALID;
    END IF;
END $$;
