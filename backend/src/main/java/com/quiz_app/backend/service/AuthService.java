package com.quiz_app.backend.service;

import java.util.Locale;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.SignupResponse;
import com.quiz_app.backend.dto.auth.UpdateProfileRequest;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserRepository;
import com.quiz_app.backend.security.JwtUtils;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final EmailVerificationService emailVerificationService;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            JwtUtils jwtUtils,
            EmailVerificationService emailVerificationService) {

        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public SignupResponse register(SignupRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);

        // 1. Check duplicate email
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("An account with email " + normalizedEmail + " already exists");
        }

        // 2. Check duplicate registration number if provided
        if (request.registrationNo() != null && !request.registrationNo().isBlank()) {
            String regNo = request.registrationNo().trim();
            if (userRepository.existsByRegistrationNo(regNo)) {
                throw new ConflictException(
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
        user.setVerified(false); // Initially not verified; can be updated later based on your verification logic
        user.setActive(true);

        User savedUser = userRepository.save(user);

        // 5. Create email verification token and send email
        emailVerificationService.createVerificationToken(savedUser);

        return new SignupResponse(
                "Account created. Please verify your email before logging in.",
                true,
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

        if (!user.isVerified()) {
            throw new BadRequestException(
                    "EMAIL_NOT_VERIFIED",
                    "Please verify your email before logging in");
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

    @Transactional
    public UserSummaryResponse updateProfile(
            String email,
            UpdateProfileRequest request) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (request.firstName() != null) {
            if (request.firstName().isBlank()) {
                throw new BadRequestException("First name cannot be blank");
            }
            user.setFirstName(request.firstName().trim());
        }

        if (request.lastName() != null) {
            user.setLastName(
                    request.lastName().isBlank()
                            ? null
                            : request.lastName().trim());
        }

        if (request.phone() != null) {
            user.setPhone(
                    request.phone().isBlank()
                            ? null
                            : request.phone().trim());
        }

        if (request.college() != null) {
            user.setCollege(
                    request.college().isBlank()
                            ? null
                            : request.college().trim());
        }

        if (request.department() != null) {
            user.setDepartment(
                    request.department().isBlank()
                            ? null
                            : request.department().trim());
        }

        if (request.profileImage() != null) {
            user.setProfileImage(
                    request.profileImage().isBlank()
                            ? null
                            : request.profileImage().trim());
        }

        User savedUser = userRepository.save(user);

        return UserSummaryResponse.fromEntity(savedUser);
    }
}
