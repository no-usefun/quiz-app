package com.quiz_app.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.QuizAttempt;

public interface QuizAttemptRepository
        extends JpaRepository<QuizAttempt, Long> {

    boolean existsByQuizIdAndStudentId(
            Long quizId,
            Long studentId);
}