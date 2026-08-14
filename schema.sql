-- Online Quiz App: clean PostgreSQL schema
-- Run this file once on a new, empty database.
-- Sample/test INSERT statements deliberately belong in a separate seed.sql file.

CREATE TABLE roles (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    google_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(20) NOT NULL CHECK (auth_provider IN ('LOCAL', 'GOOGLE')),
    phone VARCHAR(15),
    college VARCHAR(100),
    department VARCHAR(100),
    registration_no VARCHAR(30) UNIQUE,
    profile_image TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_local_user_has_password CHECK (auth_provider <> 'LOCAL' OR password_hash IS NOT NULL),
    CONSTRAINT chk_google_user_has_id CHECK (auth_provider <> 'GOOGLE' OR google_id IS NOT NULL)
);

CREATE TABLE quizzes (
    quiz_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    subject_code VARCHAR(50) NOT NULL,
    description TEXT,
    instructions TEXT,
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    total_marks DECIMAL(8,2) NOT NULL CHECK (total_marks > 0),
    total_students INTEGER CHECK (total_students >= 0),
    overall_timer_seconds INTEGER NOT NULL CHECK (overall_timer_seconds > 0),
    negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
    negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),
    time_bonus_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    random_question_order BOOLEAN NOT NULL DEFAULT FALSE,
    random_option_order BOOLEAN NOT NULL DEFAULT FALSE,
    allow_review BOOLEAN NOT NULL DEFAULT TRUE,
    allow_resume BOOLEAN NOT NULL DEFAULT TRUE,
    auto_submit BOOLEAN NOT NULL DEFAULT TRUE,
    max_tab_switch INTEGER NOT NULL DEFAULT 3 CHECK (max_tab_switch >= 0),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED')),
    exam_state VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (exam_state IN ('WAITING', 'RUNNING', 'PAUSED', 'ENDED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quiz_time_range CHECK (end_time > start_time)
);

CREATE TABLE questions (
    question_id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(quiz_id) ON UPDATE CASCADE ON DELETE CASCADE,
    question_text TEXT,
    image_url TEXT,
    explanation TEXT,
    question_type VARCHAR(20) NOT NULL DEFAULT 'MCQ' CHECK (question_type IN ('MCQ', 'MSQ', 'TRUE_FALSE')),
    marks DECIMAL(5,2) NOT NULL DEFAULT 1 CHECK (marks > 0),
    negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (negative_marks >= 0),
    question_timer_seconds INTEGER CHECK (question_timer_seconds > 0),
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    display_order INTEGER NOT NULL CHECK (display_order > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_question_content CHECK (question_text IS NOT NULL OR image_url IS NOT NULL),
    CONSTRAINT uq_question_display_order UNIQUE (quiz_id, display_order)
);

CREATE TABLE options (
    option_id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_text TEXT,
    option_image TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    option_order SMALLINT NOT NULL CHECK (option_order BETWEEN 1 AND 4),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_option_content CHECK (option_text IS NOT NULL OR option_image IS NOT NULL),
    CONSTRAINT uq_question_option_order UNIQUE (question_id, option_order)
);

CREATE TABLE quiz_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED')),
    current_question INTEGER NOT NULL DEFAULT 1 CHECK (current_question > 0),
    total_time_taken INTEGER NOT NULL DEFAULT 0 CHECK (total_time_taken >= 0),
    warnings_count INTEGER NOT NULL DEFAULT 0 CHECK (warnings_count >= 0),
    refresh_count INTEGER NOT NULL DEFAULT 0 CHECK (refresh_count >= 0),
    reconnect_count INTEGER NOT NULL DEFAULT 0 CHECK (reconnect_count >= 0),
    final_score DECIMAL(8,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_quiz_attempt UNIQUE (quiz_id, student_id)
);

CREATE TABLE student_answers (
    answer_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    answer_status VARCHAR(20) NOT NULL DEFAULT 'UNANSWERED' CHECK (answer_status IN ('ANSWERED', 'SKIPPED', 'UNANSWERED')),
    response_time_seconds INTEGER NOT NULL DEFAULT 0 CHECK (response_time_seconds >= 0),
    marks_awarded DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_correct BOOLEAN,
    answered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE TABLE student_selected_options (
    selected_option_id BIGSERIAL PRIMARY KEY,
    answer_id BIGINT NOT NULL REFERENCES student_answers(answer_id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL REFERENCES options(option_id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_answer_option UNIQUE (answer_id, option_id)
);

CREATE TABLE devices (
    device_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    browser_name VARCHAR(100),
    browser_version VARCHAR(50),
    operating_system VARCHAR(100),
    device_type VARCHAR(30) CHECK (device_type IN ('DESKTOP', 'LAPTOP', 'MOBILE', 'TABLET')),
    screen_width INTEGER CHECK (screen_width > 0),
    screen_height INTEGER CHECK (screen_height > 0),
    user_agent TEXT,
    login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
    activity_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    question_id BIGINT REFERENCES questions(question_id) ON DELETE SET NULL,
    activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN ('LOGIN', 'START_QUIZ', 'VIEW_QUESTION', 'ANSWER_SELECTED', 'ANSWER_CHANGED', 'QUESTION_SKIPPED', 'TAB_SWITCH', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'FULLSCREEN_EXIT', 'NETWORK_LOST', 'NETWORK_RESTORED', 'AUTO_SAVE', 'SUBMIT', 'AUTO_SUBMIT')),
    activity_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leaderboard_entries (
    leaderboard_id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    attempt_id BIGINT NOT NULL UNIQUE REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
    score DECIMAL(6,2) NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
    wrong_answers INTEGER NOT NULL DEFAULT 0 CHECK (wrong_answers >= 0),
    unanswered_questions INTEGER NOT NULL DEFAULT 0 CHECK (unanswered_questions >= 0),
    total_time_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
    rank INTEGER CHECK (rank > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_quizzes_teacher ON quizzes(teacher_id);
CREATE INDEX idx_quizzes_status ON quizzes(status);
CREATE INDEX idx_quizzes_start_time ON quizzes(start_time);
CREATE INDEX idx_questions_quiz ON questions(quiz_id);
CREATE INDEX idx_options_question ON options(question_id);
CREATE INDEX idx_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_attempts_student ON quiz_attempts(student_id);
CREATE INDEX idx_answers_attempt ON student_answers(attempt_id);
CREATE INDEX idx_selected_options_answer ON student_selected_options(answer_id);
CREATE INDEX idx_devices_attempt ON devices(attempt_id);
CREATE INDEX idx_activity_attempt_time ON activity_logs(attempt_id, activity_time);
CREATE INDEX idx_leaderboard_quiz_score ON leaderboard_entries(quiz_id, score DESC);
