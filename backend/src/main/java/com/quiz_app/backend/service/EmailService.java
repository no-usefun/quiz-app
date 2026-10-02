package com.quiz_app.backend.service;

public interface EmailService {

    void sendVerificationEmail(
            String recipientEmail,
            String verificationToken);
}