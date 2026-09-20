package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.QuizAllowedStudent;

@Repository
public interface QuizAllowedStudentRepository extends JpaRepository<QuizAllowedStudent, Long> {

    boolean existsByQuizIdAndRegistrationNumber(Long quizId, String registrationNumber);

    boolean existsByQuizQuizCodeAndRegistrationNumber(String quizCode, String registrationNumber);

    boolean existsByQuizId(Long quizId);

    boolean existsByQuizQuizCode(String quizCode);

    List<QuizAllowedStudent> findByQuizId(Long quizId);

    List<QuizAllowedStudent> findByQuizQuizCode(String quizCode);
}
