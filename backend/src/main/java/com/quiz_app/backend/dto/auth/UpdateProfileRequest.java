package com.quiz_app.backend.dto.auth;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(

        @Size(max = 50, message = "First name cannot exceed 50 characters") String firstName,

        @Size(max = 50, message = "Last name cannot exceed 50 characters") String lastName,

        @Size(max = 15, message = "Phone cannot exceed 15 characters") String phone,

        @Size(max = 100, message = "College cannot exceed 100 characters") String college,

        @Size(max = 100, message = "Department cannot exceed 100 characters") String department,

        String profileImage) {
}