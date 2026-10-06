package com.quiz_app.backend.security;

import java.io.IOException;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.quiz_app.backend.exception.ErrorResponse;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserIdentityRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2AuthenticationSuccessHandler
        implements AuthenticationSuccessHandler {

    private static final Logger logger =
            LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

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
        String issuer = oidcUser.getIssuer() == null
                ? null
                : oidcUser.getIssuer().toString();

        Boolean emailVerified =
                oidcUser.getAttribute("email_verified");

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
            requestedRole =
                    RoleAwareOAuth2AuthorizationRequestResolver.extractRole(
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

        String registrationId =
                oauthToken.getAuthorizedClientRegistrationId();

        String normalizedEmail =
                email.trim().toLowerCase(Locale.ROOT);

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

                user = createNewSsoUser(
                        oidcUser,
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
        user.setGoogleId(null);
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
