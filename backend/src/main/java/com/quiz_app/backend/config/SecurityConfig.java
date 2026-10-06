package com.quiz_app.backend.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.quiz_app.backend.security.AccessDeniedHandlerJwt;
import com.quiz_app.backend.security.AuthEntryPointJwt;
import com.quiz_app.backend.security.JwtAuthenticationFilter;
import com.quiz_app.backend.security.OAuth2AuthenticationSuccessHandler;
import com.quiz_app.backend.security.RoleAwareOAuth2AuthorizationRequestResolver;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AuthEntryPointJwt authEntryPointJwt;
    private final AccessDeniedHandlerJwt accessDeniedHandlerJwt;
    private final boolean oauth2Enabled;
    private final boolean emailFeaturesEnabled;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, AuthEntryPointJwt authEntryPointJwt,
            AccessDeniedHandlerJwt accessDeniedHandlerJwt,
            @Value("${app.auth.oauth2-enabled:false}") boolean oauth2Enabled,
            @Value("${app.auth.email-features-enabled:true}") boolean emailFeaturesEnabled) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.authEntryPointJwt = authEntryPointJwt;
        this.accessDeniedHandlerJwt = accessDeniedHandlerJwt;
        this.oauth2Enabled = oauth2Enabled;
        this.emailFeaturesEnabled = emailFeaturesEnabled;
    }

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "Accept",
                "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
            ObjectProvider<OAuth2AuthenticationSuccessHandler> oauthSuccessHandlerProvider,
            ObjectProvider<RoleAwareOAuth2AuthorizationRequestResolver> oauthResolverProvider) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(exception -> exception.authenticationEntryPoint(authEntryPointJwt)
                        .accessDeniedHandler(accessDeniedHandlerJwt))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/login", "/api/v1/auth/signup", "/", "/api/v1/health", "/favicon.ico")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/verify-email", "/api/v1/auth/resend-verification",
                                "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password")
                        .access((authentication, context) -> new org.springframework.security.authorization.AuthorizationDecision(emailFeaturesEnabled))
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/v1/student/**").hasRole("STUDENT")
                        .requestMatchers("/api/v1/teacher/**").hasRole("TEACHER")
                        .anyRequest().authenticated());

        if (oauth2Enabled) {
            OAuth2AuthenticationSuccessHandler successHandler = oauthSuccessHandlerProvider.getIfAvailable();
            RoleAwareOAuth2AuthorizationRequestResolver resolver = oauthResolverProvider.getIfAvailable();
            if (successHandler == null || resolver == null) {
                throw new IllegalStateException("OAuth2 is enabled but its security components are unavailable");
            }
            http.oauth2Login(oauth2 -> oauth2.authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(resolver))
                    .successHandler(successHandler));
        }

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
