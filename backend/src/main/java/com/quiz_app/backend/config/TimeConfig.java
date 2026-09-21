package com.quiz_app.backend.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {

    public static final ZoneId QUIZ_TIMEZONE = ZoneId.of("Asia/Kolkata");

    @Bean
    public Clock quizClock() {
        return Clock.systemUTC();
    }
}