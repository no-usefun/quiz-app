package com.quiz_app.backend.service;

import java.util.Locale;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.exception.UserAlreadyExistsException;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserRepository;
import com.quiz_app.backend.security.JwtUtils;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            JwtUtils jwtUtils) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    @Transactional
    public AuthResponse register(SignupRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);

        // 1. Check duplicate email
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new UserAlreadyExistsException("An account with email " + normalizedEmail + " already exists");
        }

        // 2. Check duplicate registration number if provided
        if (request.registrationNo() != null && !request.registrationNo().isBlank()) {
            String regNo = request.registrationNo().trim();
            if (userRepository.existsByRegistrationNo(regNo)) {
                throw new UserAlreadyExistsException(
                        "Registration number " + regNo + " is already associated with an account");
            }
        }

        // 3. Resolve Role
        String targetRoleName = "STUDENT";
        if (request.role() != null && !request.role().isBlank()) {
            String roleUpper = request.role().trim().toUpperCase(Locale.ROOT);
            if (roleUpper.equals("TEACHER") || roleUpper.equals("STUDENT")) {
                targetRoleName = roleUpper;
            } else {
                throw new BadRequestException("Invalid role: " + request.role() + ". Must be 'TEACHER' or 'STUDENT'");
            }
        }

        final String roleNameToFind = targetRoleName;
        Role role = roleRepository.findByName(roleNameToFind)
                .orElseGet(() -> {
                    Role newRole = new Role();
                    newRole.setName(roleNameToFind);
                    newRole.setDescription(
                            roleNameToFind.equals("TEACHER") ? "Can create and manage quizzes" : "Can attempt quizzes");
                    return roleRepository.save(newRole);
                });

        // 4. Create and populate User entity
        User user = new User();
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName() != null ? request.lastName().trim() : null);
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setAuthProvider("LOCAL");
        user.setCollege(request.college() != null ? request.college().trim() : null);
        user.setDepartment(request.department() != null ? request.department().trim() : null);
        user.setRegistrationNo(request.registrationNo() != null && !request.registrationNo().isBlank()
                ? request.registrationNo().trim()
                : null);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setVerified(true);
        user.setActive(true);

        User savedUser = userRepository.save(user);

        // 5. Generate JWT token
        String token = jwtUtils.generateToken(savedUser);

        return new AuthResponse(
                token,
                jwtUtils.getExpirationMs(),
                UserSummaryResponse.fromEntity(savedUser));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);

        // 1. Fetch user by email
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        // 2. Validate password
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        // 3. Verify account active status
        if (!user.isActive()) {
            throw new BadRequestException("Your account is currently disabled. Please contact administration.");
        }

        // 4. Generate JWT token
        String token = jwtUtils.generateToken(user);

        return new AuthResponse(
                token,
                jwtUtils.getExpirationMs(),
                UserSummaryResponse.fromEntity(user));
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found for email: " + email));

        return UserSummaryResponse.fromEntity(user);
    }
}
