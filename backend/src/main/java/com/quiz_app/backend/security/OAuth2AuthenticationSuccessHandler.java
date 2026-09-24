package com.quiz_app.backend.security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.entity.UserIdentity;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserIdentityRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2AuthenticationSuccessHandler
        implements AuthenticationSuccessHandler {

    private final UserIdentityRepository userIdentityRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtUtils jwtUtils;

    public OAuth2AuthenticationSuccessHandler(
            UserIdentityRepository userIdentityRepository,
            UserRepository userRepository,
            JwtUtils jwtUtils,
            RoleRepository roleRepository) {
        this.userIdentityRepository = userIdentityRepository;
        this.userRepository = userRepository;
        this.jwtUtils = jwtUtils;
        this.roleRepository = roleRepository;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {

        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;

        OidcUser oidcUser = (OidcUser) oauthToken.getPrincipal();

        String email = oidcUser.getAttribute("email");
        String subject = oidcUser.getSubject();
        String issuer = oidcUser.getIssuer().toString();

        Boolean emailVerified = oidcUser.getAttribute("email_verified");

        if (!Boolean.TRUE.equals(emailVerified)) {
            response.sendError(
                    HttpServletResponse.SC_FORBIDDEN,
                    "Google account email is not verified");
            return;
        }

        if (email == null || subject == null) {
            response.sendError(
                    HttpServletResponse.SC_BAD_REQUEST,
                    "SSO provider did not return required identity information");
            return;
        }

        String registrationId = oauthToken.getAuthorizedClientRegistrationId();

        /*
         * Issuer handling will be completed when the provider configuration
         * is added. Do not use email as the permanent external identity key.
         */

        User user = userIdentityRepository
                .findByIssuerAndSubject(issuer, subject)
                .map(UserIdentity::getUser)
                .orElseGet(() -> createUserFromSso(
                        email,
                        issuer,
                        subject,
                        registrationId));

        String jwt = jwtUtils.generateToken(user);

        response.setContentType("application/json");
        response.getWriter().write(
                "{\"token\":\"" + jwt + "\"}");
    }

    private User createUserFromSso(
            String email,
            String issuer,
            String subject,
            String provider) {

        String normalizedEmail = email.trim().toLowerCase();

        User user = userRepository
                .findByEmail(normalizedEmail)
                .orElseGet(() -> createNewSsoUser(
                        normalizedEmail,
                        subject));

        UserIdentity identity = new UserIdentity();
        identity.setUser(user);
        identity.setProvider(provider);
        identity.setIssuer(issuer);
        identity.setSubject(subject);

        userIdentityRepository.save(identity);

        return user;
    }

    private User createNewSsoUser(
            String email,
            String subject) {

        Role studentRole = roleRepository
                .findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "STUDENT role is not configured in the database"));

        User user = new User();

        user.setFirstName(email.substring(0, email.indexOf('@')));
        user.setLastName(null);
        user.setEmail(email);

        // Google-authenticated users do not use a local password.
        user.setPasswordHash(null);

        // Keep legacy Google fields valid for the current schema.
        user.setGoogleId(subject);
        user.setAuthProvider("GOOGLE");

        user.setRole(studentRole);

        // SSO authentication verifies the external identity.
        user.setVerified(true);
        user.setActive(true);

        // Registration number can be supplied later if required.
        user.setRegistrationNo(null);

        return userRepository.save(user);
    }
}