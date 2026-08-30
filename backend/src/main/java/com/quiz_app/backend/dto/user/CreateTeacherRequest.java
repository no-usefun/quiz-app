package com.quiz_app.backend.dto.user;

public record CreateTeacherRequest(
                String firstName,
                String lastName,
                String email,
                String password,
                String registrationNo) {
}