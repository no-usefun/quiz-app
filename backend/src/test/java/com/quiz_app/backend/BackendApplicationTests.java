package com.quiz_app.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import static org.mockito.Mockito.mock;

@SpringBootTest
class BackendApplicationTests {

    @TestConfiguration
    static class OAuthTestConfiguration {

        @Bean
        ClientRegistrationRepository clientRegistrationRepository() {
            return mock(ClientRegistrationRepository.class);
        }
    }

    @Test
    void contextLoads() {
    }
}
