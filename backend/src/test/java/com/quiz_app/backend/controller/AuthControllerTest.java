package com.quiz_app.backend.controller;

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
import org.springframework.security.authentication.BadCredentialsException;
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
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.service.AuthService;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

        private MockMvc mockMvc;

        @Mock
        private AuthService authService;

        private AuthController authController;

        private final ObjectMapper objectMapper = new ObjectMapper();

        private SignupRequest validSignupRequest;
        private LoginRequest validLoginRequest;
        private UserSummaryResponse teacherSummary;
        private AuthResponse authResponse;

        @BeforeEach
        void setUp() {

                authController = new AuthController(authService);

                mockMvc = MockMvcBuilders
                                .standaloneSetup(authController)
                                .setControllerAdvice(new GlobalExceptionHandler())
                                .build();

                validSignupRequest = new SignupRequest(
                                "Jane",
                                "Smith",
                                "jane@university.edu",
                                "password123",
                                "TEACHER",
                                "Science College",
                                "CS",
                                "REG-999",
                                "1234567890");

                validLoginRequest = new LoginRequest(
                                "jane@university.edu",
                                "password123");

                teacherSummary = new UserSummaryResponse(
                                1L,
                                "Jane",
                                "Smith",
                                "Jane Smith",
                                "jane@university.edu",
                                "TEACHER",
                                null,
                                null,
                                null,
                                null,
                                "LOCAL",
                                null,
                                true,
                                true);

                authResponse = new AuthResponse(
                                "mock.jwt.token",
                                86400000L,
                                teacherSummary);
        }

        // =========================================================
        // SIGNUP TESTS
        // =========================================================

        @Test
        void testSignupEndpointSuccess() throws Exception {

                when(authService.register(any(SignupRequest.class)))
                                .thenReturn(authResponse);

                mockMvc.perform(
                                post("/api/v1/auth/signup")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(validSignupRequest)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.token").value("mock.jwt.token"))
                                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                                .andExpect(jsonPath("$.user.email")
                                                .value("jane@university.edu"))
                                .andExpect(jsonPath("$.user.role")
                                                .value("TEACHER"));

                verify(authService).register(any(SignupRequest.class));
        }

        @Test
        void testSignupValidationFailure() throws Exception {

                SignupRequest invalidRequest = new SignupRequest(
                                "",
                                "",
                                "not-an-email",
                                "123",
                                "STUDENT",
                                null,
                                null,
                                null,
                                null);

                mockMvc.perform(
                                post("/api/v1/auth/signup")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.status").value(400))
                                .andExpect(jsonPath("$.error").value("Validation Failed"));

                verify(authService, never())
                                .register(any(SignupRequest.class));
        }

        @Test
        void testSignupInvalidEmail() throws Exception {

                SignupRequest invalidRequest = new SignupRequest(
                                "Jane",
                                "Smith",
                                "invalid-email",
                                "password123",
                                "STUDENT",
                                null,
                                null,
                                null,
                                null);

                mockMvc.perform(
                                post("/api/v1/auth/signup")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest());

                verify(authService, never())
                                .register(any(SignupRequest.class));
        }

        @Test
        void testSignupShortPassword() throws Exception {

                SignupRequest invalidRequest = new SignupRequest(
                                "Jane",
                                "Smith",
                                "jane@university.edu",
                                "123",
                                "STUDENT",
                                null,
                                null,
                                null,
                                null);

                mockMvc.perform(
                                post("/api/v1/auth/signup")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest());

                verify(authService, never())
                                .register(any(SignupRequest.class));
        }

        @Test
        void testSignupServiceBadRequest() throws Exception {

                when(authService.register(any(SignupRequest.class)))
                                .thenThrow(new BadRequestException("Email already exists"));

                mockMvc.perform(
                                post("/api/v1/auth/signup")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(validSignupRequest)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Email already exists"));

                verify(authService).register(any(SignupRequest.class));
        }

        // =========================================================
        // LOGIN TESTS
        // =========================================================

        @Test
        void testLoginEndpointSuccess() throws Exception {

                when(authService.login(any(LoginRequest.class)))
                                .thenReturn(authResponse);

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(validLoginRequest)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.token")
                                                .value("mock.jwt.token"))
                                .andExpect(jsonPath("$.tokenType")
                                                .value("Bearer"))
                                .andExpect(jsonPath("$.user.email")
                                                .value("jane@university.edu"))
                                .andExpect(jsonPath("$.user.role")
                                                .value("TEACHER"));

                verify(authService).login(any(LoginRequest.class));
        }

        @Test
        void testLoginInvalidCredentials() throws Exception {

                LoginRequest invalidLogin = new LoginRequest(
                                "jane@university.edu",
                                "wrongpass");

                when(authService.login(any(LoginRequest.class)))
                                .thenThrow(
                                                new BadCredentialsException(
                                                                "Invalid email or password"));

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidLogin)))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.status").value(401))
                                .andExpect(jsonPath("$.message")
                                                .value("Invalid email or password"));

                verify(authService).login(any(LoginRequest.class));
        }

        @Test
        void testLoginInvalidEmail() throws Exception {

                LoginRequest invalidRequest = new LoginRequest(
                                "not-an-email",
                                "password123");

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest());

                verify(authService, never())
                                .login(any(LoginRequest.class));
        }

        @Test
        void testLoginBlankEmail() throws Exception {

                LoginRequest invalidRequest = new LoginRequest(
                                "",
                                "password123");

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest());

                verify(authService, never())
                                .login(any(LoginRequest.class));
        }

        @Test
        void testLoginBlankPassword() throws Exception {

                LoginRequest invalidRequest = new LoginRequest(
                                "jane@university.edu",
                                "");

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(invalidRequest)))
                                .andExpect(status().isBadRequest());

                verify(authService, never())
                                .login(any(LoginRequest.class));
        }

        @Test
        void testLoginServiceBadRequest() throws Exception {

                when(authService.login(any(LoginRequest.class)))
                                .thenThrow(
                                                new BadRequestException(
                                                                "Account is not active"));

                mockMvc.perform(
                                post("/api/v1/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(objectMapper.writeValueAsString(validLoginRequest)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message")
                                                .value("Account is not active"));

                verify(authService).login(any(LoginRequest.class));
        }

        // =========================================================
        // GET CURRENT USER (/me)
        // =========================================================

        @Test
        void testGetCurrentUserSuccess() {

                when(authService.getCurrentUser("jane@university.edu"))
                                .thenReturn(teacherSummary);

                UserDetails userDetails = org.mockito.Mockito.mock(UserDetails.class);
                when(userDetails.getUsername()).thenReturn("jane@university.edu");

                var response = authController.getCurrentUser(userDetails);

                org.junit.jupiter.api.Assertions.assertEquals(
                                200,
                                response.getStatusCode().value());

                org.junit.jupiter.api.Assertions.assertNotNull(
                                response.getBody());

                org.junit.jupiter.api.Assertions.assertEquals(
                                "jane@university.edu",
                                response.getBody().email());

                org.junit.jupiter.api.Assertions.assertEquals(
                                "TEACHER",
                                response.getBody().role());

                verify(authService)
                                .getCurrentUser("jane@university.edu");
        }

        /*
         * @Test
         * void testGetCurrentUserNoAuthenticatedUser() {
         * UserDetails userDetails = org.mockito.Mockito.mock(UserDetails.class);
         * when(userDetails.getUsername()).thenReturn("jane@university.edu");
         * 
         * var response = authController.getCurrentUser(userDetails);
         * org.junit.jupiter.api.Assertions.assertThrows(
         * BadRequestException.class,
         * () -> authController.getCurrentUser(null));
         * 
         * verify(authService, never())
         * .getCurrentUser(any());
         * }
         * 
         * @Test
         * void testGetCurrentUserBlankEmail() {
         * 
         * org.junit.jupiter.api.Assertions.assertThrows(
         * BadRequestException.class,
         * () -> authController.getCurrentUser(""));
         * 
         * verify(authService, never())
         * .getCurrentUser(any());
         * }
         * 
         * @Test
         * void testGetCurrentUserServiceFailure() {
         * 
         * when(authService.getCurrentUser("jane@university.edu"))
         * .thenThrow(
         * new BadRequestException(
         * "User not found"));
         * 
         * org.junit.jupiter.api.Assertions.assertThrows(
         * BadRequestException.class,
         * () -> authController.getCurrentUser(
         * "jane@university.edu"));
         * 
         * verify(authService)
         * .getCurrentUser("jane@university.edu");
         * }
         */
}
