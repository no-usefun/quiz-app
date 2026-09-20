package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.QuizAllowedStudent;

public interface QuizAllowedStudentRepository
        extends JpaRepository<QuizAllowedStudent, Long> {

    boolean existsByQuizId(Long quizId);

    boolean existsByQuizIdAndRegistrationNumber(
            Long quizId,
            String registrationNumber);

    List<QuizAllowedStudent> findByQuizId(Long quizId);

    void deleteByQuizId(Long quizId);
}