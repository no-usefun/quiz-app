package com.quiz_app.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.OfflineExam;
import com.quiz_app.backend.entity.OfflineExamStatus;

public interface OfflineExamRepository extends JpaRepository<OfflineExam, Long> {
    Optional<OfflineExam> findByQuizId(Long quizId);
    Optional<OfflineExam> findFirstByStatus(OfflineExamStatus status);
}
