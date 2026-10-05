package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.quiz_app.backend.dto.auth.NotificationPreferencesResponse;
import com.quiz_app.backend.dto.auth.UpdateNotificationPreferencesRequest;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.service.NotificationPreferencesService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/auth/me/notification-preferences")
public class NotificationPreferencesController {

    private final NotificationPreferencesService service;

    public NotificationPreferencesController(NotificationPreferencesService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<NotificationPreferencesResponse> get(
            @AuthenticationPrincipal UserDetails userDetails) {
        requireUser(userDetails);
        return ResponseEntity.ok(service.get(userDetails.getUsername()));
    }

    @PutMapping
    public ResponseEntity<NotificationPreferencesResponse> update(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateNotificationPreferencesRequest request) {
        requireUser(userDetails);
        return ResponseEntity.ok(service.update(userDetails.getUsername(), request));
    }

    private void requireUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new BadRequestException("No authenticated user found");
        }
    }
}
