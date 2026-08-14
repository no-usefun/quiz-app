package com.quiz_app.backend.dto.exam;

public record OptionResponse(
        Long optionId,
        String optionText,
        String optionImage,
        Short optionOrder) {
}