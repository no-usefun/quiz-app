package com.quiz_app.backend.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SetPasswordRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.SignupResponse;
import com.quiz_app.backend.dto.auth.UpdateProfileRequest;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserRepository;
import com.quiz_app.backend.security.JwtUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtUtils jwtUtils;
    @Mock private EmailVerificationService emailVerificationService;

    private AuthService authService;
    private Role studentRole;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                roleRepository,
                passwordEncoder,
                jwtUtils,
                emailVerificationService);

        studentRole = new Role();
        studentRole.setName("STUDENT");
    }

    @Test
    void register_shouldCreateStudentAccount() {
        SignupRequest request = new SignupRequest(
                " Alex ", " Carter ", " ALEX@University.edu ", "secret123",
                "student", "College", "CS", " reg-1 ", "9999999999");

        when(userRepository.existsByEmail("alex@university.edu")).thenReturn(false);
        when(userRepository.existsByRegistrationNo("REG-1")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        SignupResponse response = authService.register(request);

        assertEquals("Account created successfully.", response.message());
        assertEquals("alex@university.edu", response.user().email());
        assertEquals("STUDENT", response.user().role());
        assertEquals(false, response.verificationRequired());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("encoded", captor.getValue().getPasswordHash());
        assertEquals("REG-1", captor.getValue().getRegistrationNo());
    }

    @Test
    void register_shouldRejectDuplicateEmail() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                "STUDENT", null, null, "REG-1", null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void register_shouldRequireStudentRegistrationNumber() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                "STUDENT", null, null, null, null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(studentRole));

        assertThrows(BadRequestException.class, () -> authService.register(request));
    }

    @Test
    void register_shouldRejectInvalidRole() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                "ADMIN", null, null, null, null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(request));
    }

    @Test
    void login_shouldAuthenticateMatchingRole() {
        LoginRequest request = new LoginRequest(
                " ALEX@University.edu ", "secret123", " student ");

        User user = new User();
        user.setFirstName("Alex");
        user.setEmail("alex@university.edu");
        user.setPasswordHash("encoded");
        user.setRole(studentRole);
        user.setActive(true);

        when(userRepository.findByEmail("alex@university.edu")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded")).thenReturn(true);
        when(jwtUtils.generateToken(user)).thenReturn("jwt");
        when(jwtUtils.getExpirationMs()).thenReturn(3600000L);

        AuthResponse response = authService.login(request);

        assertEquals("jwt", response.token());
        assertEquals("STUDENT", response.user().role());
    }

    @Test
    void login_shouldRejectRoleMismatch() {
        LoginRequest request = new LoginRequest(
                "alex@example.com", "secret123", "TEACHER");

        User user = new User();
        user.setEmail("alex@example.com");
        user.setPasswordHash("encoded");
        user.setRole(studentRole);
        user.setActive(true);

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));

        BadRequestException ex = assertThrows(
                BadRequestException.class, () -> authService.login(request));

        assertEquals("ROLE_MISMATCH", ex.getCode());
        verify(passwordEncoder, never()).matches(any(), any());
        verify(jwtUtils, never()).generateToken(any(User.class));
    }

    @Test
    void login_shouldRejectInvalidPassword() {
        LoginRequest request = new LoginRequest(
                "alex@example.com", "wrong", "STUDENT");

        User user = new User();
        user.setEmail("alex@example.com");
        user.setPasswordHash("encoded");
        user.setRole(studentRole);
        user.setActive(true);

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
    }

    @Test
    void getCurrentUser_shouldReturnSummary() {
        User user = new User();
        user.setFirstName("Alex");
        user.setLastName("Carter");
        user.setEmail("alex@example.com");
        user.setRole(studentRole);
        user.setActive(true);

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));

        UserSummaryResponse response = authService.getCurrentUser("alex@example.com");

        assertEquals("Alex Carter", response.fullName());
        assertEquals("STUDENT", response.role());
    }

    @Test
    void updateProfile_shouldTrimAndSaveFields() {
        User user = new User();
        user.setFirstName("Old");
        user.setEmail("alex@example.com");
        user.setRole(studentRole);

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UserSummaryResponse response = authService.updateProfile(
                "alex@example.com",
                new UpdateProfileRequest(" New ", " User ", " 123 ", " College ", " CS ", " image.png"));

        assertNotNull(response);
        assertEquals("New", user.getFirstName());
        assertEquals("User", user.getLastName());
        assertEquals("123", user.getPhone());
        assertEquals("College", user.getCollege());
        assertEquals("CS", user.getDepartment());
        assertEquals("image.png", user.getProfileImage());
        verify(userRepository).save(user);
    }

    @Test
    void setPassword_shouldSetPasswordForGoogleFirstAccount() {
        User user = new User();
        user.setEmail("google@example.com");
        user.setPasswordHash(null);

        when(userRepository.findByEmail("google@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpassword")).thenReturn("encoded-new");

        authService.setPassword(
                "google@example.com",
                new SetPasswordRequest("newpassword"));

        assertEquals("encoded-new", user.getPasswordHash());
        verify(userRepository).save(user);
    }
}
