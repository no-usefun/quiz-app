package com.quiz_app.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.ChangePasswordRequest;
import com.quiz_app.backend.dto.auth.DeleteAccountRequest;
import com.quiz_app.backend.dto.auth.LoginRequest;
import com.quiz_app.backend.dto.auth.ResendVerificationRequest;
import com.quiz_app.backend.dto.auth.SignupRequest;
import com.quiz_app.backend.dto.auth.SignupResponse;
import com.quiz_app.backend.dto.auth.UpdateProfileRequest;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.service.AuthService;
import com.quiz_app.backend.service.EmailVerificationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Authentication", description = "User registration, login and authentication APIs")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;

    public AuthController(
            AuthService authService,
            EmailVerificationService emailVerificationService) {

        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
    }

    @Operation(summary = "Register a student account", description = "Creates a student account and sends an email verification link. The account must be verified before login.")
    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        SignupResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Login user", description = "Authenticates the user and returns a JWT token.")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get current user", description = "Returns the profile of the currently authenticated user.")
    @GetMapping("/me")
    public ResponseEntity<UserSummaryResponse> getCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails) {

        if (userDetails == null) {
            throw new BadRequestException("No authenticated user found");
        }

        UserSummaryResponse response = authService.getCurrentUser(userDetails.getUsername());

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update current user profile", description = "Updates the editable profile fields of the currently authenticated user.")
    @PutMapping("/me")
    public ResponseEntity<UserSummaryResponse> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {

        if (userDetails == null) {
            throw new BadRequestException("No authenticated user found");
        }

        UserSummaryResponse response = authService.updateProfile(
                userDetails.getUsername(),
                request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(
            @RequestParam String token) {

        emailVerificationService.verifyEmail(token);

        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(
            @Valid @RequestBody ResendVerificationRequest request) {

        emailVerificationService.resendVerification(request.email());

        return ResponseEntity.ok().build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {

        authService.changePassword(
                userDetails.getUsername(),
                request);

        return ResponseEntity.ok().build();
    }

    @PostMapping("/delete-account")
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody DeleteAccountRequest request) {

        authService.deleteAccount(
                userDetails.getUsername(),
                request);

        return ResponseEntity.noContent().build();
    }
}
