package com.quiz_app.backend.dto.user;

public record CreateStudentRequest(
        String firstName,
        String lastName,
        String email,
        String registrationNo) {
}