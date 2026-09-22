-- Run this once in the existing, empty online_quiz_dev database.
-- Do not run schema.sql again: its tables already exist.

ALTER TABLE quizzes
    DROP COLUMN IF EXISTS passing_marks,
    ALTER COLUMN total_marks TYPE DECIMAL(8,2) USING total_marks::DECIMAL(8,2),
    ADD COLUMN IF NOT EXISTS quiz_code VARCHAR(10) UNIQUE,
    ADD COLUMN IF NOT EXISTS subject VARCHAR(100) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50) NOT NULL DEFAULT 'GEN-101',
    ADD COLUMN IF NOT EXISTS total_students INTEGER CHECK (total_students >= 0),
    ADD COLUMN IF NOT EXISTS result_visibility VARCHAR(20) NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE;

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

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS accepted_email_domain VARCHAR(255);

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

