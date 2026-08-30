package com.quiz_app.backend.dto.auth;

import com.quiz_app.backend.entity.User;

public record UserSummaryResponse(
        Long id,
        String firstName,
        String lastName,
        String fullName,
        String email,
        String role,
        String college,
        String department,
        String registrationNo,
        String phone,
        String authProvider,
        String profileImage,
        boolean verified,
        boolean active) {
    public static UserSummaryResponse fromEntity(User user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getFullName(),
                user.getEmail(),
                user.getRole() != null ? user.getRole().getName() : null,
                user.getCollege(),
                user.getDepartment(),
                user.getRegistrationNo(),
                user.getPhone(),
                user.getAuthProvider(),
                user.getProfileImage(),
                user.isVerified(),
                user.isActive());
    }
}
