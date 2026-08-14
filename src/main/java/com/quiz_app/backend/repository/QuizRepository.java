package com.quiz_app.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.Quiz;

public interface QuizRepository extends JpaRepository<Quiz, Long> {
}