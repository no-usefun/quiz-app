import cv2
import numpy as np
import logging
from config import (
    YAW_LEFT_THRESHOLD,
    YAW_RIGHT_THRESHOLD,
    PITCH_UP_THRESHOLD,
    PITCH_DOWN_THRESHOLD
)

logger = logging.getLogger("ai-proctoring.gaze_detector")

class GazeDetector:
    def __init__(self):
        # 3D Facial Model Points in camera coordinate frame (X right, Y down, Z forward)
        # Relative to nose tip (0, 0, 0):
        # Eyes are above nose (negative Y), mouth is below nose (positive Y)
        self.model_points = np.array([
            [0.0, 0.0, 0.0],          # Nose tip
            [-35.0, -35.0, -30.0],    # Subject's right eye (image left)
            [35.0, -35.0, -30.0],     # Subject's left eye (image right)
            [-25.0, 35.0, -25.0],     # Subject's right mouth corner (image left)
            [25.0, 35.0, -25.0]       # Subject's left mouth corner (image right)
        ], dtype=np.float64)

    def estimate_gaze(self, landmarks: list, image_shape: tuple) -> dict:
        """
        Estimates head pose (yaw and pitch in degrees) and gaze direction from 5 facial landmarks.
        Returns:
            {
                "gaze_direction": "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN",
                "yaw": float,
                "pitch": float,
                "is_looking_away": bool
            }
        """
        if not landmarks or len(landmarks) < 5 or image_shape is None:
            return {
                "gaze_direction": "CENTER",
                "yaw": 0.0,
                "pitch": 0.0,
                "is_looking_away": False
            }

        try:
            h, w = image_shape[:2]
            right_eye = landmarks[0]   # image left
            left_eye = landmarks[1]    # image right
            nose_tip = landmarks[2]
            right_mouth = landmarks[3] # image left
            left_mouth = landmarks[4]  # image right

            image_points = np.array([
                nose_tip,
                right_eye,
                left_eye,
                right_mouth,
                left_mouth
            ], dtype=np.float64)

            # Focal length approximation
            focal_length = float(w)
            center = (w / 2.0, h / 2.0)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype=np.float64)
            dist_coeffs = np.zeros((4, 1), dtype=np.float64)

            success, rvec, _ = cv2.solvePnP(
                self.model_points,
                image_points,
                camera_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_EPNP
            )

            pnp_yaw = 0.0
            pnp_pitch = 0.0

            if success:
                rmat, _ = cv2.Rodrigues(rvec)
                angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
                pnp_pitch = float(angles[0])
                pnp_yaw = float(angles[1])

            # Direct geometric symmetry ratio
            d_eyes = np.linalg.norm(np.array(left_eye) - np.array(right_eye))
            eye_mid_x = (right_eye[0] + left_eye[0]) / 2.0
            eye_mid_y = (right_eye[1] + left_eye[1]) / 2.0
            mouth_mid_y = (right_mouth[1] + left_mouth[1]) / 2.0

            # Yaw: horizontal offset of nose from eye midpoint normalized by interocular distance
            dx_ratio = (nose_tip[0] - eye_mid_x) / (d_eyes + 1e-6)
            geom_yaw = float(dx_ratio * 70.0)

            # Pitch: vertical offset of nose
            norm_y = (nose_tip[1] - eye_mid_y) / (mouth_mid_y - eye_mid_y + 1e-6)
            geom_pitch = float((norm_y - 0.44) * 60.0)

            # Choose the most sensitive estimator
            if abs(geom_yaw) > abs(pnp_yaw):
                yaw = geom_yaw
            else:
                yaw = pnp_yaw

            if abs(geom_pitch) > abs(pnp_pitch) or abs(pnp_pitch) > 40.0:
                pitch = geom_pitch
            else:
                pitch = pnp_pitch

            yaw = round(float(np.clip(yaw, -90.0, 90.0)), 1)
            pitch = round(float(np.clip(pitch, -90.0, 90.0)), 1)

            # Determine discrete gaze direction
            if yaw < YAW_LEFT_THRESHOLD:
                direction = "LEFT"
            elif yaw > YAW_RIGHT_THRESHOLD:
                direction = "RIGHT"
            elif pitch < PITCH_UP_THRESHOLD:
                direction = "UP"
            elif pitch > PITCH_DOWN_THRESHOLD:
                direction = "DOWN"
            else:
                direction = "CENTER"

            is_looking_away = (direction != "CENTER")

            return {
                "gaze_direction": direction,
                "yaw": yaw,
                "pitch": pitch,
                "is_looking_away": is_looking_away
            }
        except Exception as e:
            logger.error("Gaze estimation error: %s", e)
            return {
                "gaze_direction": "CENTER",
                "yaw": 0.0,
                "pitch": 0.0,
                "is_looking_away": False
            }
