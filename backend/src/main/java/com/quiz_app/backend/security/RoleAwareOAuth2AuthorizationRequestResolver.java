package com.quiz_app.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;

@Component
@Profile("online")
public class RoleAwareOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public RoleAwareOAuth2AuthorizationRequestResolver(
            ClientRegistrationRepository clientRegistrationRepository) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(
                clientRegistrationRepository,
                "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return addRoleToState(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(
            HttpServletRequest request,
            String clientRegistrationId) {
        return addRoleToState(
                request,
                delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest addRoleToState(
            HttpServletRequest request,
            OAuth2AuthorizationRequest authorizationRequest) {

        if (authorizationRequest == null) {
            return null;
        }

        String role = request.getParameter("role");

        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("SSO role is required");
        }

        role = role.trim().toUpperCase(Locale.ROOT);

        if (!role.equals("STUDENT") && !role.equals("TEACHER")) {
            throw new IllegalArgumentException(
                    "SSO role must be STUDENT or TEACHER");
        }

        String payload = authorizationRequest.getState() + "|" + role;

        String state = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        payload.getBytes(StandardCharsets.UTF_8));

        return OAuth2AuthorizationRequest
                .from(authorizationRequest)
                .state(state)
                .build();
    }

    public static String extractRole(String state) {
        if (state == null || state.isBlank()) {
            throw new IllegalArgumentException("Invalid OAuth2 state");
        }

        try {
            String payload = new String(
                    Base64.getUrlDecoder().decode(state),
                    StandardCharsets.UTF_8);

            int separator = payload.lastIndexOf('|');

            if (separator < 0 || separator == payload.length() - 1) {
                throw new IllegalArgumentException("Invalid OAuth2 state");
            }

            String role = payload
                    .substring(separator + 1)
                    .toUpperCase(Locale.ROOT);

            if (!role.equals("STUDENT") && !role.equals("TEACHER")) {
                throw new IllegalArgumentException("Invalid OAuth2 role");
            }

            return role;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid OAuth2 state", e);
        }
    }
}
