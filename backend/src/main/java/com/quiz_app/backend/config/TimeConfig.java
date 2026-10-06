package com.quiz_app.backend.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {
    private final ZoneId quizTimeZone;

    public TimeConfig(@Value("${app.exam.time-zone:Asia/Kolkata}") String timeZone) {
        this.quizTimeZone = ZoneId.of(timeZone);
    }

    @Bean
    public Clock quizClock() {
        return Clock.system(quizTimeZone);
    }
}
