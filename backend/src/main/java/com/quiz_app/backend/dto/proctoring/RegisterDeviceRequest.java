package com.quiz_app.backend.dto.proctoring;

import com.quiz_app.backend.entity.DeviceType;

public record RegisterDeviceRequest(
        String ipAddress,
        String browserName,
        String browserVersion,
        String operatingSystem,
        DeviceType deviceType,
        Integer screenWidth,
        Integer screenHeight,
        String userAgent
) {
}
