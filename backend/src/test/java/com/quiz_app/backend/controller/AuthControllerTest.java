package com.quiz_app.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.SignupResponse;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.service.AuthService;
import com.quiz_app.backend.service.EmailVerificationService;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

        @Mock
        private AuthService authService;
        @Mock
        private EmailVerificationService emailVerificationService;
        @Mock
        private UserDetails userDetails;

        private MockMvc mockMvc;
        private ObjectMapper objectMapper;
        private SignupRequest signupRequest;
        private LoginRequest loginRequest;
        private UserSummaryResponse summary;
        private AuthResponse authResponse;

        @BeforeEach
        void setUp() {
                AuthController controller = new AuthController(authService, emailVerificationService);

                mockMvc = MockMvcBuilders.standaloneSetup(controller)
                                .setControllerAdvice(new GlobalExceptionHandler())
                                .build();

                objectMapper = new ObjectMapper();

                signupRequest = new SignupRequest(
                                "Jane", "Smith", "jane@example.com", "password123",
                                "College", "CS", null, null);

                loginRequest = new LoginRequest(
                                "jane@example.com", "password123");

                summary = new UserSummaryResponse(
                                1L, "Jane", "Smith", "Jane Smith", "jane@example.com",
                                "TEACHER", "College", "CS", null, null, "LOCAL",
                                null, true, true);

                authResponse = new AuthResponse("jwt", 3600000L, summary);
        }

        @Test
        void signup_shouldReturnCreated() throws Exception {
                when(authService.register(any(SignupRequest.class), org.mockito.ArgumentMatchers.eq("TEACHER")))
                                .thenReturn(new SignupResponse("Account created successfully. Please verify your email before logging in.", true, summary));

                mockMvc.perform(post("/api/v1/auth/signup").param("role", "TEACHER")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(signupRequest)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.message").value("Account created successfully. Please verify your email before logging in."))
                                .andExpect(jsonPath("$.verificationRequired").value(true))
                                .andExpect(jsonPath("$.user.email").value("jane@example.com"));
        }

        @Test
        void login_shouldRequireRole() throws Exception {
                mockMvc.perform(post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"email":"jane@example.com","password":"password123"}
                                                """))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).login(any(LoginRequest.class), org.mockito.ArgumentMatchers.anyString());
        }

        @Test
        void login_shouldReturnToken() throws Exception {
                when(authService.login(any(LoginRequest.class), org.mockito.ArgumentMatchers.eq("TEACHER"))).thenReturn(authResponse);

                mockMvc.perform(post("/api/v1/auth/login").param("role", "TEACHER")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(loginRequest)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.token").value("jwt"))
                                .andExpect(jsonPath("$.user.role").value("TEACHER"));
        }

        @Test
        void getCurrentUser_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                when(authService.getCurrentUser("jane@example.com")).thenReturn(summary);

                var response = new AuthController(authService, emailVerificationService)
                                .getCurrentUser(userDetails);

                assertEquals(200, response.getStatusCode().value());
                assertEquals(summary, response.getBody());
                verify(authService).getCurrentUser("jane@example.com");
        }

        @Test
        void getCurrentUser_shouldRejectMissingPrincipal() {
                assertThrowsBadRequest(
                                () -> new AuthController(authService, emailVerificationService).getCurrentUser(null));
        }

        @Test
        void verifyEmail_shouldDelegate() {
                var response = new AuthController(authService, emailVerificationService)
                                .verifyEmail("token");

                assertEquals(200, response.getStatusCode().value());
                verify(emailVerificationService).verifyEmail("token");
        }

        @Test
        void resendVerification_shouldDelegate() {
                var response = new AuthController(authService, emailVerificationService)
                                .resendVerification(
                                                new com.quiz_app.backend.dto.auth.ResendVerificationRequest(
                                                                "jane@example.com"));

                assertEquals(200, response.getStatusCode().value());
                verify(emailVerificationService).resendVerification("jane@example.com");
        }

        @Test
        void setPassword_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");

                var response = new AuthController(authService, emailVerificationService)
                                .setPassword(
                                                userDetails,
                                                new com.quiz_app.backend.dto.auth.SetPasswordRequest("password123"));

                assertEquals(200, response.getStatusCode().value());
                verify(authService).setPassword(
                                "jane@example.com",
                                new com.quiz_app.backend.dto.auth.SetPasswordRequest("password123"));
        }

        @Test
        void updateProfile_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                var request = new com.quiz_app.backend.dto.auth.UpdateProfileRequest(
                                "Jane", "Smith", null, null, null, null);
                when(authService.updateProfile("jane@example.com", request)).thenReturn(summary);

                var response = new AuthController(authService, emailVerificationService)
                                .updateProfile(userDetails, request);

                assertEquals(200, response.getStatusCode().value());
                assertEquals(summary, response.getBody());
                verify(authService).updateProfile("jane@example.com", request);
        }

        @Test
        void updateProfile_shouldRejectMissingPrincipal() {
                assertThrowsBadRequest(() -> new AuthController(authService, emailVerificationService)
                                .updateProfile(null,
                                                new com.quiz_app.backend.dto.auth.UpdateProfileRequest(
                                                                "Jane", null, null, null, null, null)));
        }

        @Test
        void changePassword_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                var request = new com.quiz_app.backend.dto.auth.ChangePasswordRequest(
                                "old-password", "new-password");

                var response = new AuthController(authService, emailVerificationService)
                                .changePassword(userDetails, request);

                assertEquals(200, response.getStatusCode().value());
                verify(authService).changePassword("jane@example.com", request);
        }

        @Test
        void deleteAccount_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                var request = new com.quiz_app.backend.dto.auth.DeleteAccountRequest("password123");

                var response = new AuthController(authService, emailVerificationService)
                                .deleteAccount(userDetails, request);

                assertEquals(204, response.getStatusCode().value());
                verify(authService).deleteAccount("jane@example.com", request);
        }

        private void assertThrowsBadRequest(Runnable action) {
                org.junit.jupiter.api.Assertions.assertThrows(
                                BadRequestException.class, action::run);
        }
}
