package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAllowedStudent;

@Repository
public interface QuizAllowedStudentRepository extends JpaRepository<QuizAllowedStudent, Long> {

    List<QuizAllowedStudent> findByQuiz(Quiz quiz);

    List<QuizAllowedStudent> findByQuizId(Long quizId);

    List<QuizAllowedStudent> findByQuizQuizCode(String quizCode);

    boolean existsByQuizId(Long quizId);

    boolean existsByQuizQuizCode(String quizCode);

    boolean existsByQuizIdAndRegistrationNumber(Long quizId, String registrationNumber);

    boolean existsByQuizQuizCodeAndRegistrationNumber(String quizCode, String registrationNumber);

    boolean existsByQuizIdAndRegistrationNumberIgnoreCase(Long quizId, String registrationNumber);

    Optional<QuizAllowedStudent> findByQuizIdAndRegistrationNumberIgnoreCase(Long quizId, String registrationNumber);

    long countByQuizId(Long quizId);

    void deleteByQuizId(Long quizId);
}
