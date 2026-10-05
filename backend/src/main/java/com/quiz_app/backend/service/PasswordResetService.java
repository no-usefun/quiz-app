package com.quiz_app.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.entity.PasswordResetToken;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.repository.PasswordResetTokenRepository;
import com.quiz_app.backend.repository.UserRepository;

@Service
public class PasswordResetService {

    private static final int TOKEN_EXPIRATION_MINUTES = 15;

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    @Transactional
    public void requestReset(String email) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            tokenRepository.deleteByUser_IdAndUsedFalse(user.getId());

            byte[] bytes = new byte[32];
            secureRandom.nextBytes(bytes);
            String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

            PasswordResetToken token = new PasswordResetToken();
            token.setUser(user);
            token.setTokenHash(hashToken(rawToken));
            token.setExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_EXPIRATION_MINUTES));
            tokenRepository.save(token);

            emailService.sendPasswordResetEmail(user.getEmail(), rawToken);
        });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new BadRequestException("RESET_TOKEN_REQUIRED", "Reset token is required");
        }

        PasswordResetToken token = tokenRepository.findByTokenHashAndUsedFalse(hashToken(rawToken))
                .orElseThrow(() -> new BadRequestException(
                        "INVALID_RESET_TOKEN",
                        "Invalid or expired password reset token"));

        if (!token.getExpiresAt().isAfter(LocalDateTime.now())) {
            token.setUsed(true);
            tokenRepository.save(token);
            throw new BadRequestException(
                    "RESET_TOKEN_EXPIRED",
                    "Invalid or expired password reset token");
        }

        User user = token.getUser();
        if (user == null || !user.isActive()) {
            throw new BadRequestException(
                    "INVALID_RESET_TOKEN",
                    "Invalid or expired password reset token");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        token.setUsed(true);
        tokenRepository.save(token);
        tokenRepository.deleteByUser_IdAndUsedFalse(user.getId());
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(
                    digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is not available", e);
        }
    }
}
