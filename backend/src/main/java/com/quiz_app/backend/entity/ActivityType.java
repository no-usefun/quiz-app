package com.quiz_app.backend.entity;

public enum ActivityType {
    // Exam lifecycle events
    LOGIN,
    START_QUIZ,
    VIEW_QUESTION,
    ANSWER_SELECTED,
    ANSWER_CHANGED,
    QUESTION_SKIPPED,
    AUTO_SAVE,
    SUBMIT,
    AUTO_SUBMIT,

    // Browser & Window integrity events
    TAB_SWITCH,
    WINDOW_BLUR,
    WINDOW_FOCUS,
    FULLSCREEN_EXIT,
    NETWORK_LOST,
    NETWORK_RESTORED,
    RIGHT_CLICK,
    COPY_ATTEMPT,

    // Edge-AI Vision & Audio events
    FACE_NOT_DETECTED,
    MULTIPLE_FACES,
    LOOKING_AWAY,
    VOICE_DETECTED,
    SUSPICIOUS_OBJECT,
    DEVICE_SWITCH;

    public boolean isViolation() {
        return switch (this) {
            case TAB_SWITCH, WINDOW_BLUR, FULLSCREEN_EXIT,
                 RIGHT_CLICK, COPY_ATTEMPT,
                 FACE_NOT_DETECTED, MULTIPLE_FACES, LOOKING_AWAY,
                 VOICE_DETECTED, SUSPICIOUS_OBJECT, DEVICE_SWITCH -> true;
            default -> false;
        };
    }
}
