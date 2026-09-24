package com.quiz_app.backend.security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.entity.UserIdentity;
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
    private final JwtUtils jwtUtils;

    public OAuth2AuthenticationSuccessHandler(
            UserIdentityRepository userIdentityRepository,
            UserRepository userRepository,
            JwtUtils jwtUtils) {
        this.userIdentityRepository = userIdentityRepository;
        this.userRepository = userRepository;
        this.jwtUtils = jwtUtils;
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
        User user = userRepository
                .findByEmail(email.toLowerCase())
                .orElseThrow(() -> new IllegalStateException(
                        "No DynoQuizz account is linked to this SSO identity"));

        UserIdentity identity = new UserIdentity();
        identity.setUser(user);
        identity.setProvider(provider);
        identity.setIssuer(issuer);
        identity.setSubject(subject);

        userIdentityRepository.save(identity);

        return user;
    }
}