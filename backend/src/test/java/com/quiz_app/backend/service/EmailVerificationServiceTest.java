package com.quiz_app.backend.service;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.entity.EmailVerificationToken;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.EmailVerificationTokenRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

        @Mock
        private EmailVerificationTokenRepository tokenRepository;
        @Mock
        private UserRepository userRepository;
        @Mock
        private EmailService emailService;

        @Test
        void createVerificationToken_shouldPersistAndSendToken() {
                User user = user("user@example.com", false);

                when(tokenRepository.save(org.mockito.ArgumentMatchers.any(EmailVerificationToken.class)))
                                .thenAnswer(i -> i.getArgument(0));

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                String rawToken = service.createVerificationToken(user);

                assertNotNull(rawToken);
                assertFalse(rawToken.isBlank());

                ArgumentCaptor<EmailVerificationToken> captor = ArgumentCaptor.forClass(EmailVerificationToken.class);
                verify(tokenRepository).deleteByUser_IdAndUsedFalse(1L);
                verify(tokenRepository).save(captor.capture());
                verify(emailService).sendVerificationEmail("user@example.com", rawToken);

                EmailVerificationToken saved = captor.getValue();
                assertNotNull(saved.getTokenHash());
                assertNotNull(saved.getExpiresAt());
                assertFalse(saved.isUsed());
                assertTrue(saved.getExpiresAt().isAfter(LocalDateTime.now()));
        }

        @Test
        void verifyEmail_shouldMarkUserAndTokenUsed() {
                User user = user("user@example.com", false);
                EmailVerificationToken token = new EmailVerificationToken();
                token.setUser(user);
                token.setExpiresAt(LocalDateTime.now().plusMinutes(5));

                when(tokenRepository.findByTokenHashAndUsedFalse(org.mockito.ArgumentMatchers.anyString()))
                                .thenReturn(Optional.of(token));

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                service.verifyEmail("raw-token");

                assertTrue(user.isVerified());
                assertTrue(token.isUsed());
                verify(userRepository).save(user);
                verify(tokenRepository).save(token);
        }

        @Test
        void verifyEmail_shouldRejectBlankToken() {
                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                assertThrows(
                                BadRequestException.class,
                                () -> service.verifyEmail(" "));
        }

        @Test
        void verifyEmail_shouldRejectExpiredToken() {
                EmailVerificationToken token = new EmailVerificationToken();
                token.setExpiresAt(LocalDateTime.now().minusMinutes(1));

                when(tokenRepository.findByTokenHashAndUsedFalse(org.mockito.ArgumentMatchers.anyString()))
                                .thenReturn(Optional.of(token));

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                assertThrows(
                                BadRequestException.class,
                                () -> service.verifyEmail("expired"));

                assertTrue(token.isUsed());
                verify(tokenRepository).save(token);
        }

        @Test
        void resendVerification_shouldNormalizeEmailAndCreateToken() {
                User user = user("user@example.com", false);

                when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
                when(tokenRepository.save(org.mockito.ArgumentMatchers.any(EmailVerificationToken.class)))
                                .thenAnswer(i -> i.getArgument(0));

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                service.resendVerification(" USER@EXAMPLE.COM ");

                verify(userRepository).findByEmail("user@example.com");
                verify(emailService).sendVerificationEmail(
                                org.mockito.ArgumentMatchers.eq("user@example.com"),
                                org.mockito.ArgumentMatchers.anyString());
        }

        @Test
        void resendVerification_shouldRejectVerifiedUser() {
                User user = user("user@example.com", true);

                when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                assertThrows(
                                BadRequestException.class,
                                () -> service.resendVerification("user@example.com"));
        }

        @Test
        void resendVerification_shouldRejectMissingUser() {
                when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

                EmailVerificationService service = new EmailVerificationService(
                                tokenRepository, userRepository, emailService);

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> service.resendVerification("missing@example.com"));
        }

        private User user(String email, boolean verified) {
                User user = new User();
                try {
                        var field = User.class.getDeclaredField("id");
                        field.setAccessible(true);
                        field.set(user, 1L);
                } catch (ReflectiveOperationException e) {
                        throw new AssertionError(e);
                }
                user.setEmail(email);
                user.setVerified(verified);
                return user;
        }
}
