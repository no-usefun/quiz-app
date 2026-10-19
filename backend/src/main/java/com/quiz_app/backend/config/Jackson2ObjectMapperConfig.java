package com.quiz_app.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides a Jackson 2 mapper for components that explicitly use
 * {@code com.fasterxml.jackson.databind} APIs.
 *
 * Spring Boot 4 auto-configures Jackson 3 by default, whose mapper uses
 * {@code tools.jackson.databind.ObjectMapper}. That bean is not assignable
 * to Jackson 2's {@code com.fasterxml.jackson.databind.ObjectMapper}.
 */
@Configuration
public class Jackson2ObjectMapperConfig {

    @Bean
    public ObjectMapper jackson2ObjectMapper() {
        return new ObjectMapper();
    }
}
