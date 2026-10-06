package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.QuizAttemptProctoringEvent;

@Repository
public interface QuizAttemptProctoringEventRepository extends JpaRepository<QuizAttemptProctoringEvent, Long> {

    long countByAttemptIdAndEventType(Long attemptId, String eventType);

    List<QuizAttemptProctoringEvent> findByAttemptId(Long attemptId);

    List<QuizAttemptProctoringEvent> findByAttemptIdOrderByOccurredAtAsc(Long attemptId);
}
