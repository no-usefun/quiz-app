package com.quiz_app.backend.service;

public interface EmailService {

    void sendVerificationEmail(
            String recipientEmail,
            String verificationToken);

    default void sendPasswordResetEmail(
            String recipientEmail,
            String resetToken) {
        System.out.println("Password reset token for " + recipientEmail + ": " + resetToken);
    }
}