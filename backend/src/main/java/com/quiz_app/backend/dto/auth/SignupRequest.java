package com.quiz_app.backend.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
                @NotBlank(message = "First name is required") @Size(max = 50) String firstName,

                @Size(max = 50) String lastName,

                @NotBlank(message = "Email is required") @Email(message = "Email must be valid") @Size(max = 255) String email,

                @NotBlank(message = "Password is required") @Size(min = 6, max = 100) String password,

                @NotBlank(message = "Role is required") String role,

                @Size(max = 100) String college,

                @Size(max = 100) String department,

                @Size(max = 30) String registrationNo,

                @Size(max = 15) String phone) {
}