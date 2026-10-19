package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.QuizAttempt;

public interface QuizAttemptRepository
                extends JpaRepository<QuizAttempt, Long> {

        boolean existsByQuizQuizCodeAndStudentId(
                        String quizCode,
                        Long studentId);

        boolean existsByQuizId(Long quizId);

        List<QuizAttempt> findByQuizId(Long quizId);

        List<QuizAttempt> findByStudentIdAndStatusInOrderBySubmittedAtDesc(
                        Long studentId,
                        List<AttemptStatus> statuses);

        Optional<QuizAttempt> findByQuizQuizCodeAndStudentId(
                        String quizCode,
                        Long studentId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select a from QuizAttempt a where a.id = :attemptId")
        Optional<QuizAttempt> findByIdForUpdate(@Param("attemptId") Long attemptId);
}