package com.quiz_app.backend.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
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

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtils jwtUtils;
    @Mock
    private EmailVerificationService emailVerificationService;

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
                "College", "CS", " reg-1 ", "9999999999");

        when(userRepository.existsByEmail("alex@university.edu")).thenReturn(false);
        when(userRepository.existsByRegistrationNo("REG-1")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        SignupResponse response = authService.register(request, "student");

        assertEquals("Account created successfully. Please verify your email before logging in.", response.message());
        assertEquals("alex@university.edu", response.user().email());
        assertEquals("STUDENT", response.user().role());
        assertEquals(true, response.verificationRequired());
        verify(emailVerificationService).createVerificationToken(any(User.class));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("encoded", captor.getValue().getPasswordHash());
        assertEquals("REG-1", captor.getValue().getRegistrationNo());
    }

    @Test
    void register_shouldSkipEmailVerificationWhenDisabled() {
        AuthService noVerificationAuthService = new AuthService(
                userRepository,
                roleRepository,
                passwordEncoder,
                jwtUtils,
                emailVerificationService,
                false);

        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                "College", "CS", "REG-1", null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);
        when(userRepository.existsByRegistrationNo("REG-1")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        SignupResponse response = noVerificationAuthService.register(request, "STUDENT");

        assertEquals(false, response.verificationRequired());
        assertEquals("Account created successfully. You can log in immediately.", response.message());
        verify(emailVerificationService, never()).createVerificationToken(any(User.class));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals(true, captor.getValue().isVerified());
    }

    @Test
    void register_shouldRejectDuplicateEmail() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                null, null, "REG-1", null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request, "STUDENT"));
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void register_shouldRequireStudentRegistrationNumber() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                null, null, null, null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(studentRole));

        assertThrows(BadRequestException.class, () -> authService.register(request, "STUDENT"));
    }

    @Test
    void register_shouldRejectInvalidRole() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@example.com", "secret123",
                null, null, null, null);

        when(userRepository.existsByEmail("alex@example.com")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(request, "ADMIN"));
    }

    @Test
    void login_shouldAuthenticateMatchingRole() {
        LoginRequest request = new LoginRequest(
                " ALEX@University.edu ", "secret123");

        User user = new User();
        user.setFirstName("Alex");
        user.setEmail("alex@university.edu");
        user.setPasswordHash("encoded");
        user.setRole(studentRole);
        user.setActive(true);
        user.setVerified(true);

        when(userRepository.findByEmail("alex@university.edu")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded")).thenReturn(true);
        when(jwtUtils.generateToken(user)).thenReturn("jwt");
        when(jwtUtils.getExpirationMs()).thenReturn(3600000L);

        AuthResponse response = authService.login(request);

        assertEquals("jwt", response.token());
        assertEquals("STUDENT", response.user().role());
    }

    @Test
    void login_shouldRejectUnverifiedUser() {
        LoginRequest request = new LoginRequest("alex@example.com", "secret123");

        User user = new User();
        user.setEmail("alex@example.com");
        user.setPasswordHash("encoded");
        user.setRole(studentRole);
        user.setActive(true);
        user.setVerified(false);

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded")).thenReturn(true);

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> authService.login(request));

        assertEquals("EMAIL_NOT_VERIFIED", ex.getCode());
        verify(jwtUtils, never()).generateToken(any(User.class));
    }

    @Test
    void login_shouldRejectInvalidPassword() {
        LoginRequest request = new LoginRequest(
                "alex@example.com", "wrong");

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
    void setPassword_shouldRejectWhenPasswordAlreadyExists() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("existing");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> authService.setPassword(
                        "user@example.com",
                        new SetPasswordRequest("newpassword")));

        assertEquals("PASSWORD_ALREADY_SET", ex.getCode());
        verify(passwordEncoder, never()).encode(any());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void changePassword_shouldUpdatePassword() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("old-hash");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("new-password", "old-hash")).thenReturn(false);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        authService.changePassword(
                "user@example.com",
                new com.quiz_app.backend.dto.auth.ChangePasswordRequest(
                        "old-password", "new-password"));

        assertEquals("new-hash", user.getPasswordHash());
        verify(userRepository).save(user);
    }

    @Test
    void changePassword_shouldRejectWrongCurrentPassword() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("old-hash");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "old-hash")).thenReturn(false);

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> authService.changePassword(
                        "user@example.com",
                        new com.quiz_app.backend.dto.auth.ChangePasswordRequest(
                                "wrong", "new-password")));

        assertEquals("INVALID_CURRENT_PASSWORD", ex.getCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void changePassword_shouldRejectSamePassword() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("old-hash");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> authService.changePassword(
                        "user@example.com",
                        new com.quiz_app.backend.dto.auth.ChangePasswordRequest(
                                "old-password", "old-password")));

        assertEquals("PASSWORD_UNCHANGED", ex.getCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void deleteAccount_shouldDeactivateAccount() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hash");
        user.setActive(true);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "hash")).thenReturn(true);

        authService.deleteAccount(
                "user@example.com",
                new com.quiz_app.backend.dto.auth.DeleteAccountRequest("password"));

        assertEquals(false, user.isActive());
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
