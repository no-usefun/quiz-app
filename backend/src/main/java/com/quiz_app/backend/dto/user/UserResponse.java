package com.quiz_app.backend.dto.user;

public record UserResponse(
        Long userId,
        String firstName,
        String lastName,
        String email,
        String registrationNo,
        String role) {
}