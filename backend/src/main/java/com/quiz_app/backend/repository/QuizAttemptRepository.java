package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.QuizAttempt;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    boolean existsByQuizQuizCodeAndStudentId(String quizCode, Long studentId);

    List<QuizAttempt> findByQuizId(Long quizId);

    List<QuizAttempt> findByQuizQuizCode(String quizCode);

    List<QuizAttempt> findByStudentId(Long studentId);

    List<QuizAttempt> findByStudentIdAndStatusInOrderBySubmittedAtDesc(
            Long studentId,
            List<AttemptStatus> statuses);

    Optional<QuizAttempt> findByQuizQuizCodeAndStudentId(
            String quizCode,
            Long studentId);
}
