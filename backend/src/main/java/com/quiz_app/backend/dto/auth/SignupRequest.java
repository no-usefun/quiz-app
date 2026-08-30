package com.quiz_app.backend.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "First name is required")
        @Size(max = 50, message = "First name cannot exceed 50 characters")
        String firstName,

        @Size(max = 50, message = "Last name cannot exceed 50 characters")
        String lastName,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid email address")
        @Size(max = 255, message = "Email cannot exceed 255 characters")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
        String password,

        String role, // "STUDENT" or "TEACHER"

        @Size(max = 100, message = "College cannot exceed 100 characters")
        String college,

        @Size(max = 100, message = "Department cannot exceed 100 characters")
        String department,

        @Size(max = 30, message = "Registration number cannot exceed 30 characters")
        String registrationNo,

        @Size(max = 15, message = "Phone cannot exceed 15 characters")
        String phone
) {
}
