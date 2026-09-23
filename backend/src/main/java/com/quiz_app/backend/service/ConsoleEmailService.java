package com.quiz_app.backend.service;

import org.springframework.stereotype.Service;

@Service
public class ConsoleEmailService implements EmailService {

    @Override
    public void sendVerificationEmail(
            String recipientEmail,
            String verificationToken) {

        System.out.println();
        System.out.println("==========================================");
        System.out.println("       DYNOQUIZZ EMAIL VERIFICATION       ");
        System.out.println("==========================================");
        System.out.println("To: " + recipientEmail);
        System.out.println("Verification Token:");
        System.out.println(verificationToken);
        System.out.println("==========================================");
        System.out.println();
    }
}