package com.quiz_app.backend.exception;

public class AccessDeniedApplicationException extends RuntimeException {

    public AccessDeniedApplicationException(String message) {
        super(message);
    }
}