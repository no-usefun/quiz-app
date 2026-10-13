package com.quiz_app.backend.security;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.auth.AuthResponse;
import com.quiz_app.backend.dto.auth.UserSummaryResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.entity.UserIdentity;
import com.quiz_app.backend.exception.ErrorResponse;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserIdentityRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Profile("online")
public class OAuth2AuthenticationSuccessHandler
                implements AuthenticationSuccessHandler {

        private static final Logger logger = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

        private final UserIdentityRepository userIdentityRepository;
        private final UserRepository userRepository;
        private final RoleRepository roleRepository;
        private final JwtUtils jwtUtils;
        private final String frontendUrl;

        public OAuth2AuthenticationSuccessHandler(
                        UserIdentityRepository userIdentityRepository,
                        UserRepository userRepository,
                        JwtUtils jwtUtils,
                        RoleRepository roleRepository,
                        @Value("${app.frontend-url:}") String frontendUrl) {
                this.userIdentityRepository = userIdentityRepository;
                this.userRepository = userRepository;
                this.jwtUtils = jwtUtils;
                this.roleRepository = roleRepository;
                this.frontendUrl = frontendUrl;
        }

        @Override
        public void onAuthenticationSuccess(
                        HttpServletRequest request,
                        HttpServletResponse response,
                        Authentication authentication)
                        throws IOException, ServletException {

                OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;

                OidcUser oidcUser = (OidcUser) oauthToken.getPrincipal();

                String email = oidcUser.getAttribute("email");
                String subject = oidcUser.getSubject();
                String issuer = oidcUser.getIssuer() == null
                                ? null
                                : oidcUser.getIssuer().toString();

                Boolean emailVerified = oidcUser.getAttribute("email_verified");

                if (!Boolean.TRUE.equals(emailVerified)) {
                        writeOAuthError(
                                        request,
                                        response,
                                        HttpServletResponse.SC_FORBIDDEN,
                                        "SSO_EMAIL_NOT_VERIFIED",
                                        "Google account email is not verified");
                        return;
                }

                if (email == null || subject == null || issuer == null) {
                        writeOAuthError(
                                        request,
                                        response,
                                        HttpServletResponse.SC_BAD_REQUEST,
                                        "SSO_IDENTITY_INVALID",
                                        "SSO provider did not return required identity information");
                        return;
                }

                final String requestedRole;

                try {
                        requestedRole = RoleAwareOAuth2AuthorizationRequestResolver.extractRole(
                                        request.getParameter("state"));
                } catch (IllegalArgumentException e) {
                        writeOAuthError(
                                        request,
                                        response,
                                        HttpServletResponse.SC_BAD_REQUEST,
                                        "SSO_STATE_INVALID",
                                        "Invalid or missing SSO role state");
                        return;
                }

                String registrationId = oauthToken.getAuthorizedClientRegistrationId();

                String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

                try {
                        User user = userIdentityRepository
                                        .findByIssuerAndSubject(issuer, subject)
                                        .map(UserIdentity::getUser)
                                        .orElse(null);

                        if (user != null) {
                                if (user.getRole() == null
                                                || !requestedRole.equalsIgnoreCase(
                                                                user.getRole().getName())) {
                                        writeOAuthError(
                                                        request,
                                                        response,
                                                        HttpServletResponse.SC_CONFLICT,
                                                        "ROLE_MISMATCH",
                                                        "The selected role does not match this Google account");
                                        return;
                                }
                        } else {
                                if (userRepository.findByEmail(normalizedEmail).isPresent()) {
                                        redirectDuplicateEmailError(request, response);
                                        return;
                                }

                                user = createNewSsoUser(
                                                oidcUser,
                                                normalizedEmail,
                                                subject,
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

                        response.setStatus(HttpServletResponse.SC_OK);
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");

                        new ObjectMapper().writeValue(
                                        response.getWriter(),
                                        authResponse);

                } catch (RuntimeException e) {
                        logger.error(
                                        "OAuth2 authentication processing failed for provider {}",
                                        registrationId,
                                        e);

                        if (!response.isCommitted()) {
                                writeOAuthError(
                                                request,
                                                response,
                                                HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                                                "SSO_AUTHENTICATION_FAILED",
                                                "Unable to complete Google sign-in");
                        }
                }
        }

        private void redirectDuplicateEmailError(
                        HttpServletRequest request,
                        HttpServletResponse response) throws IOException {

                String callbackUrl = buildFrontendOAuthErrorUrl();
                if (callbackUrl == null) {
                        logger.warn(
                                        "Frontend OAuth redirect is not configured with a valid origin; returning controlled duplicate-email conflict");
                        writeOAuthError(
                                        request,
                                        response,
                                        HttpServletResponse.SC_CONFLICT,
                                        "SSO_EMAIL_ALREADY_EXISTS",
                                        "An account with this email already exists. "
                                                        + "Sign in with the existing account first; "
                                                        + "Google linking is not automatic.");
                        return;
                }

                if (response.isCommitted()) {
                        logger.warn("OAuth2 duplicate-email redirect could not be sent because the response is already committed");
                        return;
                }

                String encodedCode = URLEncoder.encode(
                                "SSO_EMAIL_ALREADY_EXISTS",
                                StandardCharsets.UTF_8);
                response.setStatus(HttpServletResponse.SC_FOUND);
                response.setHeader("Location", callbackUrl + "?errorCode=" + encodedCode);
        }

        /**
         * Uses only the configured frontend origin; never derives a redirect host
         * from request parameters or headers. Rejects paths, credentials, queries,
         * fragments, and non-HTTP(S) schemes.
         */
        private String buildFrontendOAuthErrorUrl() {
                if (frontendUrl == null || frontendUrl.isBlank()) {
                        return null;
                }

                try {
                        URI origin = URI.create(frontendUrl.trim());
                        String scheme = origin.getScheme();
                        if (scheme == null
                                        || !(scheme.equalsIgnoreCase("https")
                                                        || scheme.equalsIgnoreCase("http"))
                                        || origin.getHost() == null
                                        || origin.getRawUserInfo() != null
                                        || origin.getRawQuery() != null
                                        || origin.getRawFragment() != null
                                        || (origin.getRawPath() != null
                                                        && !origin.getRawPath().isEmpty()
                                                        && !origin.getRawPath().equals("/"))) {
                                return null;
                        }

                        String normalizedOrigin = origin.toString();
                        while (normalizedOrigin.endsWith("/")) {
                                normalizedOrigin = normalizedOrigin.substring(
                                                0, normalizedOrigin.length() - 1);
                        }
                        return normalizedOrigin + "/oauth/callback";
                } catch (IllegalArgumentException e) {
                        logger.warn("Configured frontend URL is invalid; OAuth error redirect is disabled");
                        return null;
                }
        }

        private void writeOAuthError(
                        HttpServletRequest request,
                        HttpServletResponse response,
                        int status,
                        String code,
                        String message) throws IOException {

                if (response.isCommitted()) {
                        logger.warn(
                                        "OAuth2 error response could not be written because the response is already committed: {}",
                                        code);
                        return;
                }

                ErrorResponse errorResponse = new ErrorResponse(
                                status,
                                code,
                                status == HttpServletResponse.SC_CONFLICT
                                                ? "Conflict"
                                                : status >= 500
                                                                ? "Internal Server Error"
                                                                : "OAuth Authentication Error",
                                message,
                                request.getRequestURI());

                response.setStatus(status);
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");

                new ObjectMapper().writeValue(
                                response.getWriter(),
                                errorResponse);
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
                        OidcUser oidcUser,
                        String email,
                        String subject,
                        String requestedRole) {

                Role role = roleRepository
                                .findByName(requestedRole)
                                .orElseThrow(() -> new IllegalStateException(
                                                requestedRole
                                                                + " role is not configured in the database"));

                User user = new User();

                String givenName = oidcUser.getAttribute("given_name");
                String familyName = oidcUser.getAttribute("family_name");
                String picture = oidcUser.getAttribute("picture");

                user.setFirstName(
                                givenName != null && !givenName.isBlank()
                                                ? givenName.trim()
                                                : email.substring(0, email.indexOf('@')));
                user.setLastName(
                                familyName != null && !familyName.isBlank()
                                                ? familyName.trim()
                                                : null);
                user.setEmail(email);
                user.setPasswordHash(null);
                user.setGoogleId(subject);
                user.setAuthProvider("GOOGLE");
                user.setRole(role);
                user.setProfileImage(
                                picture != null && !picture.isBlank()
                                                ? picture.trim()
                                                : null);
                user.setVerified(true);
                user.setActive(true);
                user.setRegistrationNo(null);

                return userRepository.save(user);
        }
}
