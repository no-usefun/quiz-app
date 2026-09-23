package com.quiz_app.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.entity.EmailVerificationToken;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.EmailVerificationTokenRepository;
import com.quiz_app.backend.repository.UserRepository;

@Service
public class EmailVerificationService {

    private static final int TOKEN_EXPIRATION_MINUTES = 30;

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    private final SecureRandom secureRandom = new SecureRandom();

    public EmailVerificationService(
            EmailVerificationTokenRepository tokenRepository,
            UserRepository userRepository,
            EmailService emailService) {

        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    @Transactional
    public String createVerificationToken(User user) {

        /*
         * Invalidate any previous unused tokens for this user
         * before creating a new one.
         */
        tokenRepository.deleteByUser_IdAndUsedFalse(user.getId());

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String rawToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        EmailVerificationToken verificationToken = new EmailVerificationToken();

        verificationToken.setUser(user);
        verificationToken.setTokenHash(hashToken(rawToken));
        verificationToken.setExpiresAt(
                LocalDateTime.now()
                        .plusMinutes(TOKEN_EXPIRATION_MINUTES));

        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(
                user.getEmail(),
                rawToken);

        return rawToken;
    }

    @Transactional
    public void verifyEmail(String rawToken) {

        if (rawToken == null || rawToken.isBlank()) {
            throw new BadRequestException(
                    "VERIFICATION_TOKEN_REQUIRED",
                    "Verification token is required");
        }

        String tokenHash = hashToken(rawToken);

        EmailVerificationToken verificationToken = tokenRepository
                .findByTokenHashAndUsedFalse(tokenHash)
                .orElseThrow(() -> new BadRequestException(
                        "INVALID_VERIFICATION_TOKEN",
                        "Invalid or expired verification token"));

        if (verificationToken.getExpiresAt()
                .isBefore(LocalDateTime.now())) {

            verificationToken.setUsed(true);
            tokenRepository.save(verificationToken);

            throw new BadRequestException(
                    "VERIFICATION_TOKEN_EXPIRED",
                    "Verification token has expired");
        }

        User user = verificationToken.getUser();

        if (user == null) {
            throw new ResourceNotFoundException(
                    "User associated with verification token not found");
        }

        user.setVerified(true);
        userRepository.save(user);

        verificationToken.setUsed(true);
        tokenRepository.save(verificationToken);
    }

    private String hashToken(String token) {

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8));

            return Base64.getEncoder()
                    .encodeToString(hash);

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 algorithm is not available",
                    e);
        }
    }

    @Transactional
    public void resendVerification(String email) {

        if (email == null || email.isBlank()) {
            throw new BadRequestException(
                    "EMAIL_REQUIRED",
                    "Email is required");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "USER_NOT_FOUND",
                        "User not found"));

        if (user.isVerified()) {
            throw new BadRequestException(
                    "EMAIL_ALREADY_VERIFIED",
                    "Email is already verified");
        }

        createVerificationToken(user);
    }
}