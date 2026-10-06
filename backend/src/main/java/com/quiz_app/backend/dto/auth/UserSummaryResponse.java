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
        boolean active,
        boolean profileComplete) {

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
                user.isActive(),
                isProfileComplete(user));
    }

    private static boolean isProfileComplete(User user) {
        if (user.getRole() == null) {
            return false;
        }

        if (isBlank(user.getCollege())
                || isBlank(user.getDepartment())
                || isBlank(user.getPhone())) {
            return false;
        }

        if ("STUDENT".equalsIgnoreCase(user.getRole().getName())
                && isBlank(user.getRegistrationNo())) {
            return false;
        }

        return true;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
