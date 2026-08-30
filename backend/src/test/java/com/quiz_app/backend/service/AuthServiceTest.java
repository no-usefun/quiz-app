package com.quiz_app.backend.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
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

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, roleRepository, passwordEncoder, jwtUtils);
    }

    @Test
    void testRegisterStudentSuccess() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@university.edu", "secret123",
                "STUDENT", "Tech Institute", "CS", "REG-1234", "9876543210");

        Role role = new Role();
        role.setName("STUDENT");

        when(userRepository.existsByEmail("alex@university.edu")).thenReturn(false);
        when(userRepository.existsByRegistrationNo("REG-1234")).thenReturn(false);
        when(roleRepository.findByName("STUDENT")).thenReturn(Optional.of(role));
        when(passwordEncoder.encode("secret123")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtUtils.generateToken(any(User.class))).thenReturn("mock.jwt.token");
        when(jwtUtils.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mock.jwt.token", response.token());
        assertEquals("alex@university.edu", response.user().email());
        assertEquals("STUDENT", response.user().role());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void testRegisterDuplicateEmailThrowsException() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@university.edu", "secret123",
                "STUDENT", null, null, null, null);

        when(userRepository.existsByEmail("alex@university.edu")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request));
    }

    @Test
    void testRegisterInvalidRoleThrowsException() {
        SignupRequest request = new SignupRequest(
                "Alex", "Carter", "alex@university.edu", "secret123",
                "SUPERADMIN", null, null, null, null);

        when(userRepository.existsByEmail("alex@university.edu")).thenReturn(false);

        assertThrows(BadRequestException.class, () -> authService.register(request));
    }

    @Test
    void testLoginSuccess() {
        LoginRequest request = new LoginRequest("alex@university.edu", "secret123");

        Role role = new Role();
        role.setName("STUDENT");

        User user = new User();
        user.setFirstName("Alex");
        user.setEmail("alex@university.edu");
        user.setPasswordHash("encodedPassword");
        user.setRole(role);
        user.setActive(true);

        when(userRepository.findByEmail("alex@university.edu")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encodedPassword")).thenReturn(true);
        when(jwtUtils.generateToken(user)).thenReturn("mock.jwt.token");
        when(jwtUtils.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock.jwt.token", response.token());
        assertEquals("alex@university.edu", response.user().email());
    }

    @Test
    void testLoginWrongPasswordThrowsException() {
        LoginRequest request = new LoginRequest("alex@university.edu", "wrongPassword");

        User user = new User();
        user.setEmail("alex@university.edu");
        user.setPasswordHash("encodedPassword");
        user.setActive(true);

        when(userRepository.findByEmail("alex@university.edu")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
    }

    @Test
    void testLoginUserNotFoundThrowsException() {
        LoginRequest request = new LoginRequest("nonexistent@university.edu", "password");

        when(userRepository.findByEmail("nonexistent@university.edu")).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
    }

    @Test
    void testGetCurrentUserSuccess() {
        Role role = new Role();
        role.setName("TEACHER");

        User user = new User();
        user.setFirstName("Prof");
        user.setLastName("Smith");
        user.setEmail("prof.smith@university.edu");
        user.setRole(role);
        user.setActive(true);

        when(userRepository.findByEmail("prof.smith@university.edu")).thenReturn(Optional.of(user));

        UserSummaryResponse response = authService.getCurrentUser("prof.smith@university.edu");

        assertNotNull(response);
        assertEquals("Prof Smith", response.fullName());
        assertEquals("TEACHER", response.role());
    }
}
