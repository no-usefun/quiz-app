package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.Quiz;

public interface QuizRepository extends JpaRepository<Quiz, Long> {

    boolean existsByQuizCode(String quizCode);

    Optional<Quiz> findByQuizCode(String quizCode);

    List<Quiz> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);
}