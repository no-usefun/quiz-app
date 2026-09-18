package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.ActivityLog;
import com.quiz_app.backend.entity.ActivityType;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByAttemptIdOrderByActivityTimeAsc(Long attemptId);

    List<ActivityLog> findByAttemptIdAndActivityTypeInOrderByActivityTimeDesc(Long attemptId, List<ActivityType> types);

    long countByAttemptIdAndActivityType(Long attemptId, ActivityType activityType);

    long countByAttemptIdAndActivityTypeIn(Long attemptId, List<ActivityType> types);
}
