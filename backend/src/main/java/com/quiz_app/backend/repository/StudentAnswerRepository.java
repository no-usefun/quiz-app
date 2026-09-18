package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.StudentAnswer;

public interface StudentAnswerRepository
                extends JpaRepository<StudentAnswer, Long> {

        Optional<StudentAnswer> findByAttemptIdAndQuestionId(
                        Long attemptId,
                        Long questionId);

        List<StudentAnswer> findByAttemptId(Long attemptId);
}