-- Run this once in the existing, empty online_quiz_dev database.
-- Do not run schema.sql again: its tables already exist.

ALTER TABLE quizzes
    DROP COLUMN IF EXISTS passing_marks,
    ALTER COLUMN total_marks TYPE DECIMAL(8,2) USING total_marks::DECIMAL(8,2),
    ADD COLUMN subject VARCHAR(100) NOT NULL,
    ADD COLUMN subject_code VARCHAR(50) NOT NULL,
    ADD COLUMN total_students INTEGER CHECK (total_students >= 0);
