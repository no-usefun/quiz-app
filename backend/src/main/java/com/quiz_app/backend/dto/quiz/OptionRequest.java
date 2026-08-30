package com.quiz_app.backend.dto.quiz;

public record OptionRequest(
        String optionText,
        String optionImage,
        Short optionOrder,
        boolean isCorrect) {
}