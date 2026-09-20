package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAllowedStudent;

@Repository
public interface QuizAllowedStudentRepository
        extends JpaRepository<QuizAllowedStudent, Long> {

    List<QuizAllowedStudent> findByQuiz(Quiz quiz);

    List<QuizAllowedStudent> findByQuizId(Long quizId);

    boolean existsByQuizId(Long quizId);

    boolean existsByQuizIdAndRegistrationNumberIgnoreCase(
            Long quizId,
            String registrationNumber);

    Optional<QuizAllowedStudent> findByQuizIdAndRegistrationNumberIgnoreCase(
            Long quizId,
            String registrationNumber);

    long countByQuizId(Long quizId);

    void deleteByQuizId(Long quizId);
}