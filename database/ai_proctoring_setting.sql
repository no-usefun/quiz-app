-- AI proctoring policy for each quiz.
-- Existing quizzes are deliberately backfilled as standard-mode (FALSE);
-- teachers can explicitly enable AI proctoring in quiz settings.
ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS ai_proctoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
