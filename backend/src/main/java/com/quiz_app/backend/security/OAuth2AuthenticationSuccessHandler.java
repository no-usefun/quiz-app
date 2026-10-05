package com.quiz_app.backend.security;

import java.io.IOException;
import java.util.Locale;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
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
            Authentication authentication)
            throws IOException, ServletException {

        OAuth2AuthenticationToken oauthToken =
                (OAuth2AuthenticationToken) authentication;

        OidcUser oidcUser = (OidcUser) oauthToken.getPrincipal();

        String email = oidcUser.getAttribute("email");
        String subject = oidcUser.getSubject();
        String issuer = oidcUser.getIssuer().toString();

        Boolean emailVerified =
                oidcUser.getAttribute("email_verified");

        if (!Boolean.TRUE.equals(emailVerified)) {
            response.sendError(
                    HttpServletResponse.SC_FORBIDDEN,
                    "Google account email is not verified");
            return;
        }

        if (email == null || subject == null || issuer == null) {
            response.sendError(
                    HttpServletResponse.SC_BAD_REQUEST,
                    "SSO provider did not return required identity information");
            return;
        }

        final String requestedRole;

        try {
            requestedRole =
                    RoleAwareOAuth2AuthorizationRequestResolver.extractRole(
                            request.getParameter("state"));
        } catch (IllegalArgumentException e) {
            response.sendError(
                    HttpServletResponse.SC_BAD_REQUEST,
                    "Invalid or missing SSO role state");
            return;
        }

        String registrationId =
                oauthToken.getAuthorizedClientRegistrationId();

        String normalizedEmail =
                email.trim().toLowerCase(Locale.ROOT);

        User user = userIdentityRepository
                .findByIssuerAndSubject(issuer, subject)
                .map(UserIdentity::getUser)
                .orElse(null);

        if (user != null) {
            if (user.getRole() == null
                    || !requestedRole.equalsIgnoreCase(
                            user.getRole().getName())) {
                response.sendError(
                        HttpServletResponse.SC_CONFLICT,
                        "The selected role does not match this Google account");
                return;
            }
        } else {
            if (userRepository.findByEmail(normalizedEmail).isPresent()) {
                response.sendError(
                        HttpServletResponse.SC_CONFLICT,
                        "An account with this email already exists. "
                                + "Sign in with the existing account first; "
                                + "Google linking is not automatic.");
                return;
            }

            user = createNewSsoUser(
                    normalizedEmail,
                    requestedRole);

            createIdentity(
                    user,
                    issuer,
                    subject,
                    registrationId);
        }

        String jwt = jwtUtils.generateToken(user);

        AuthResponse authResponse = new AuthResponse(
                jwt,
                jwtUtils.getExpirationMs(),
                UserSummaryResponse.fromEntity(user));

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        new ObjectMapper().writeValue(
                response.getWriter(),
                authResponse);
    }

    private void createIdentity(
            User user,
            String issuer,
            String subject,
            String provider) {

        UserIdentity identity = new UserIdentity();
        identity.setUser(user);
        identity.setProvider(provider);
        identity.setIssuer(issuer);
        identity.setSubject(subject);

        userIdentityRepository.save(identity);
    }

    private User createNewSsoUser(
            String email,
            String requestedRole) {

        Role role = roleRepository
                .findByName(requestedRole)
                .orElseThrow(() -> new IllegalStateException(
                        requestedRole
                                + " role is not configured in the database"));

        User user = new User();

        user.setFirstName(
                email.substring(0, email.indexOf('@')));
        user.setLastName(null);
        user.setEmail(email);
        user.setPasswordHash(null);
        user.setGoogleId(null);
        user.setAuthProvider("GOOGLE");
        user.setRole(role);
        user.setVerified(true);
        user.setActive(true);
        user.setRegistrationNo(null);

        return userRepository.save(user);
    }
}
