-- Run this once in the existing online_quiz_dev database.
-- Do not run schema.sql again: its tables already exist.

ALTER TABLE quizzes
    DROP COLUMN IF EXISTS passing_marks,
    ALTER COLUMN total_marks TYPE DECIMAL(8,2) USING total_marks::DECIMAL(8,2),
    ADD COLUMN IF NOT EXISTS quiz_code VARCHAR(10) UNIQUE,
    ADD COLUMN IF NOT EXISTS subject VARCHAR(100) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50) NOT NULL DEFAULT 'GEN-101',
    ADD COLUMN IF NOT EXISTS total_students INTEGER CHECK (total_students >= 0),
    ADD COLUMN IF NOT EXISTS result_visibility VARCHAR(20) NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS accepted_email_domain VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_quizzes_result_visibility'
    ) THEN
        ALTER TABLE quizzes DROP CONSTRAINT chk_quizzes_result_visibility;
    END IF;
END $$;

ALTER TABLE quizzes
ADD CONSTRAINT chk_quizzes_result_visibility
CHECK (
    result_visibility IN (
        'NONE',
        'LEADERBOARD',
        'QUESTION_WISE',
        'BOTH'
    )
);

-- =========================================================
-- Eligibility: Email Domain & Allowed Student Whitelist
-- =========================================================

ALTER TABLE users
    ALTER COLUMN registration_no TYPE VARCHAR(100);

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
-- Variable Options: Remove 1-4 Cap, Enforce Positive Order
-- =========================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'options' AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%option_order%'
    ) LOOP
        EXECUTE 'ALTER TABLE options DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE options
ADD CONSTRAINT chk_option_order_positive
CHECK (option_order > 0);

-- =========================================================
-- Email Verification Tokens
-- =========================================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
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
-- AI Proctoring: ID Photo & Full Event Classification
-- =========================================================

ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS id_photo_data TEXT;

ALTER TABLE activity_logs
    DROP CONSTRAINT IF EXISTS activity_logs_activity_type_check;

ALTER TABLE activity_logs
    ADD CONSTRAINT activity_logs_activity_type_check
    CHECK (activity_type IN (
        'LOGIN', 'START_QUIZ', 'VIEW_QUESTION', 'ANSWER_SELECTED', 'ANSWER_CHANGED', 
        'QUESTION_SKIPPED', 'TAB_SWITCH', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'FULLSCREEN_EXIT', 
        'NETWORK_LOST', 'NETWORK_RESTORED', 'AUTO_SAVE', 'SUBMIT', 'AUTO_SUBMIT',
        'FACE_NOT_DETECTED', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'VOICE_DETECTED', 
        'SUSPICIOUS_OBJECT', 'DEVICE_SWITCH', 'RIGHT_CLICK', 'COPY_ATTEMPT'
    ));

