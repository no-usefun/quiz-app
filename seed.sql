-- Optional development-only data. Do not store real accounts or passwords here.

INSERT INTO roles (role_name, description)
VALUES
    ('TEACHER', 'Can create and manage quizzes'),
    ('STUDENT', 'Can attempt quizzes')
ON CONFLICT (role_name) DO NOTHING;
