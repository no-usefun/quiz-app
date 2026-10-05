package com.quiz_app.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.auth.NotificationPreferencesResponse;
import com.quiz_app.backend.dto.auth.UpdateNotificationPreferencesRequest;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.entity.UserNotificationPreferences;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.UserNotificationPreferencesRepository;
import com.quiz_app.backend.repository.UserRepository;

@Service
public class NotificationPreferencesService {

    private final UserRepository userRepository;
    private final UserNotificationPreferencesRepository repository;

    public NotificationPreferencesService(
            UserRepository userRepository,
            UserNotificationPreferencesRepository repository) {
        this.userRepository = userRepository;
        this.repository = repository;
    }

    @Transactional
    public NotificationPreferencesResponse get(String email) {
        User user = findUser(email);
        UserNotificationPreferences preferences = repository.findByUserId(user.getId())
                .orElseGet(() -> createDefaults(user));
        return toResponse(preferences);
    }

    @Transactional
    public NotificationPreferencesResponse update(
            String email,
            UpdateNotificationPreferencesRequest request) {
        User user = findUser(email);
        UserNotificationPreferences preferences = repository.findByUserId(user.getId())
                .orElseGet(() -> createDefaults(user));

        if (request.assessmentResults() != null) {
            preferences.setAssessmentResults(request.assessmentResults());
        }
        if (request.upcomingAssessments() != null) {
            preferences.setUpcomingAssessments(request.upcomingAssessments());
        }
        if (request.proctoringReports() != null) {
            preferences.setProctoringReports(request.proctoringReports());
        }
        if (request.browserPush() != null) {
            preferences.setBrowserPush(request.browserPush());
        }

        return toResponse(repository.save(preferences));
    }

    private UserNotificationPreferences createDefaults(User user) {
        UserNotificationPreferences preferences = new UserNotificationPreferences();
        preferences.setUser(user);
        return repository.save(preferences);
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("USER_NOT_FOUND", "User not found"));
    }

    private NotificationPreferencesResponse toResponse(UserNotificationPreferences p) {
        return new NotificationPreferencesResponse(
                p.isAssessmentResults(),
                p.isUpcomingAssessments(),
                p.isProctoringReports(),
                p.isBrowserPush());
    }
}
