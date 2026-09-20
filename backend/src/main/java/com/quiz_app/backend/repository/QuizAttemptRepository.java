package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.QuizAttempt;

public interface QuizAttemptRepository
                extends JpaRepository<QuizAttempt, Long> {

        boolean existsByQuizQuizCodeAndStudentId(
                        String quizCode,
                        Long studentId);

        List<QuizAttempt> findByQuizId(Long quizId);

        List<QuizAttempt> findByStudentIdAndStatusInOrderBySubmittedAtDesc(
                        Long studentId,
                        List<AttemptStatus> statuses);
}