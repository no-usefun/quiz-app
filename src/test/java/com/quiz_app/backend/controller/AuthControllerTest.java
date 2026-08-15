package com.quiz_app.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.Principal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.service.AuthService;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController authController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(authController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void testSignupEndpointSuccess() throws Exception {
        SignupRequest request = new SignupRequest(
                "Jane", "Smith", "jane@university.edu", "password123",
                "TEACHER", "Science College", "CS", "REG-999", "1234567890");

        UserSummaryResponse summary = new UserSummaryResponse(
                1L, "Jane", "Smith", "Jane Smith", "jane@university.edu",
                "TEACHER", "Science College", "CS", "REG-999", "1234567890",
                "LOCAL", null, true, true);

        AuthResponse authResponse = new AuthResponse("mock.jwt.token", 86400000L, summary);

        when(authService.register(any(SignupRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("mock.jwt.token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("jane@university.edu"))
                .andExpect(jsonPath("$.user.role").value("TEACHER"));
    }

    @Test
    void testSignupValidationFailure() throws Exception {
        // Missing required first name, invalid email, short password
        SignupRequest request = new SignupRequest(
                "", "", "not-an-email", "123",
                "STUDENT", null, null, null, null);

        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Validation Failed"));
    }

    @Test
    void testLoginEndpointSuccess() throws Exception {
        LoginRequest request = new LoginRequest("jane@university.edu", "password123");

        UserSummaryResponse summary = new UserSummaryResponse(
                1L, "Jane", "Smith", "Jane Smith", "jane@university.edu",
                "TEACHER", null, null, null, null,
                "LOCAL", null, true, true);

        AuthResponse authResponse = new AuthResponse("mock.jwt.token", 86400000L, summary);

        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("jane@university.edu"));
    }

    @Test
    void testLoginInvalidCredentials() throws Exception {
        LoginRequest request = new LoginRequest("jane@university.edu", "wrongpass");

        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void testGetCurrentUserEndpoint() throws Exception {
        UserSummaryResponse summary = new UserSummaryResponse(
                1L, "Jane", "Smith", "Jane Smith", "jane@university.edu",
                "TEACHER", null, null, null, null,
                "LOCAL", null, true, true);

        when(authService.getCurrentUser("jane@university.edu")).thenReturn(summary);

        UserDetails userDetails = mock(UserDetails.class);
        when(userDetails.getUsername()).thenReturn("jane@university.edu");

        authController.getCurrentUser(userDetails);
    }
}
