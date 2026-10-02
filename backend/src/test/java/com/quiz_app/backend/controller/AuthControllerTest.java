package com.quiz_app.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock private AuthService authService;
    @Mock private EmailVerificationService emailVerificationService;
    @Mock private UserDetails userDetails;

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
                "TEACHER", "College", "CS", null, null);

        loginRequest = new LoginRequest(
                "jane@example.com", "password123", "TEACHER");

        summary = new UserSummaryResponse(
                1L, "Jane", "Smith", "Jane Smith", "jane@example.com",
                "TEACHER", null, null, null, null, null, "LOCAL",
                null, true, true);

        authResponse = new AuthResponse("jwt", 3600000L, summary);
    }

    @Test
    void signup_shouldReturnCreated() throws Exception {
        when(authService.register(any(SignupRequest.class)))
                .thenReturn(new SignupResponse("Account created successfully.", false, summary));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(signupRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Account created successfully."))
                .andExpect(jsonPath("$.verificationRequired").value(false))
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

        verify(authService, never()).login(any(LoginRequest.class));
    }

    @Test
    void login_shouldReturnToken() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/login")
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
        assertThrowsBadRequest(() ->
                new AuthController(authService, emailVerificationService).getCurrentUser(null));
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
                        new com.quiz_app.backend.dto.auth.ResendVerificationRequest("jane@example.com"));

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

    private void assertThrowsBadRequest(Runnable action) {
        org.junit.jupiter.api.Assertions.assertThrows(
                BadRequestException.class, action::run);
    }
}
