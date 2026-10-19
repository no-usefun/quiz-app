package com.quiz_app.backend.service;

import java.util.Collections;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.proctoring.AiProctoringHealthResponse;

@Service
public class AiProctoringClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public AiProctoringClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${app.ai-proctoring.base-url:http://localhost:8000}") String baseUrl) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.objectMapper = objectMapper;
    }

    /**
     * Checks the Python AI service without making the quiz backend dependent on
     * AI-service availability during application startup.
     */
    public AiProctoringHealthResponse checkHealth() {
        try {
            String body = restClient.get()
                    .uri("/health")
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            String status = root.path("status").asText("UNKNOWN");
            String service = root.path("service").asText("ai-proctoring");
            boolean biometricAvailable = root.path("biometricAvailable").asBoolean(false);

            Map<String, Boolean> models = root.path("models").isObject()
                    ? objectMapper.convertValue(
                            root.path("models"),
                            objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Boolean.class))
                    : Collections.emptyMap();

            boolean reachable = "UP".equalsIgnoreCase(status) || "DEGRADED".equalsIgnoreCase(status);
            return new AiProctoringHealthResponse(
                    reachable,
                    status,
                    service,
                    biometricAvailable,
                    models,
                    reachable ? "AI proctoring service responded successfully"
                            : "AI proctoring service is reachable but not healthy");
        } catch (RestClientException ex) {
            return new AiProctoringHealthResponse(
                    false,
                    "DOWN",
                    "ai-proctoring",
                    false,
                    Collections.emptyMap(),
                    "AI proctoring service is unavailable");
        } catch (Exception ex) {
            return new AiProctoringHealthResponse(
                    false,
                    "INVALID_RESPONSE",
                    "ai-proctoring",
                    false,
                    Collections.emptyMap(),
                    "AI proctoring service returned an unreadable health response");
        }
    }
}
