import cv2
import numpy as np
import logging
from typing import Tuple, Dict, Any, List
from config import (
    YAW_LEFT_THRESHOLD,
    YAW_RIGHT_THRESHOLD,
    PITCH_UP_THRESHOLD,
    PITCH_DOWN_THRESHOLD
)

logger = logging.getLogger("ai-proctoring.gaze_detector")

class GazeDetector:
    def __init__(self):
        # 3D Facial Model Points in camera coordinate frame (X right, Y down, Z forward into scene).
        # Calibrated anthropometric dimensions in millimeters relative to nose tip at [0, 0, 0].
        # In camera coordinates, the protruding nose tip is closest to camera (Z = 0.0),
        # while eyes and mouth are recessed deeper along the optical axis (Z > 0.0).
        self.model_points = np.array([
            [0.0, 0.0, 0.0],          # Nose tip (pronasion)
            [-32.5, -35.0, 25.0],     # Subject's right eye / image left (pupil)
            [32.5, -35.0, 25.0],      # Subject's left eye / image right (pupil)
            [-24.0, 30.0, 15.0],      # Subject's right mouth corner / image left (cheilion)
            [24.0, 30.0, 15.0]        # Subject's left mouth corner / image right (cheilion)
        ], dtype=np.float64)

    def validate_landmarks(self, landmarks: list, image_shape: tuple) -> Tuple[bool, str]:
        """
        Validates landmark quality, vertical anatomy, and geometric plausibility.
        Rejects degraded, inverted, collapsed, or hallucinated landmark sets.
        """
        if not landmarks or len(landmarks) < 5 or image_shape is None:
            return False, "Insufficient landmarks"

        h, w = image_shape[:2]
        if h <= 0 or w <= 0:
            return False, "Invalid image dimensions"

        # Check coordinate formatting and reasonable screen margins
        for pt in landmarks[:5]:
            if not (isinstance(pt, (tuple, list, np.ndarray)) and len(pt) >= 2):
                return False, "Malformed landmark point"
            x, y = float(pt[0]), float(pt[1])
            if not np.isfinite(x) or not np.isfinite(y):
                return False, "Non-finite landmark coordinates"
            if not (-w * 0.15 <= x <= w * 1.15 and -h * 0.15 <= y <= h * 1.15):
                return False, "Landmark coordinates out of plausible frame boundaries"

        right_eye = landmarks[0]
        left_eye = landmarks[1]
        nose_tip = landmarks[2]
        right_mouth = landmarks[3]
        left_mouth = landmarks[4]

        # Interocular distance check: prevent collapsed / zero-scale faces
        d_eyes = float(np.hypot(left_eye[0] - right_eye[0], left_eye[1] - right_eye[1]))
        if d_eyes < 12.0:
            return False, f"Interocular distance too small ({d_eyes:.1f}px)"

        # Mouth width check
        d_mouth = float(np.hypot(left_mouth[0] - right_mouth[0], left_mouth[1] - right_mouth[1]))
        if d_mouth < 8.0:
            return False, f"Mouth width too small ({d_mouth:.1f}px)"

        # Anatomical vertical ordering: eyes must be above nose, nose above mouth
        # (in standard image coordinate space where Y increases downward)
        eye_mid_y = (right_eye[1] + left_eye[1]) / 2.0
        mouth_mid_y = (right_mouth[1] + left_mouth[1]) / 2.0
        nose_y = float(nose_tip[1])

        if eye_mid_y >= mouth_mid_y - 8.0:
            return False, "Inverted vertical facial geometry (eyes level with or below mouth)"

        if nose_y <= eye_mid_y - 5.0 or nose_y >= mouth_mid_y + 8.0:
            return False, "Nose tip outside plausible anatomical vertical corridor"

        # Aspect ratio check: ratio of interocular distance to vertical eye-mouth span
        d_vert = mouth_mid_y - eye_mid_y
        aspect_ratio = d_eyes / (d_vert + 1e-6)
        if not (0.35 <= aspect_ratio <= 3.2):
            return False, f"Facial aspect ratio implausible ({aspect_ratio:.2f})"

        return True, "Valid"

    def estimate_gaze(self, landmarks: list, image_shape: tuple) -> Dict[str, Any]:
        """
        Estimates head pose (yaw and pitch in degrees) and gaze direction from 5 facial landmarks.
        Uses validated 3D Perspective-n-Point with geometric landmark fusion and quality gating.
        Returns:
            {
                "gaze_direction": "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN",
                "yaw": float,
                "pitch": float,
                "is_looking_away": bool,
                "is_valid": bool,
                "confidence": float,
                "reprojection_error": float
            }
        """
        is_valid, validation_msg = self.validate_landmarks(landmarks, image_shape)
        if not is_valid:
            logger.debug("Gaze landmark validation rejected: %s", validation_msg)
            return {
                "gaze_direction": "CENTER",
                "yaw": 0.0,
                "pitch": 0.0,
                "is_looking_away": False,
                "is_valid": False,
                "confidence": 0.0,
                "reprojection_error": 0.0
            }

        try:
            h, w = image_shape[:2]
            right_eye = landmarks[0]   # Subject's right eye (image left)
            left_eye = landmarks[1]    # Subject's left eye (image right)
            nose_tip = landmarks[2]
            right_mouth = landmarks[3] # Subject's right mouth corner (image left)
            left_mouth = landmarks[4]  # Subject's left mouth corner (image right)

            image_points = np.array([
                nose_tip,
                right_eye,
                left_eye,
                right_mouth,
                left_mouth
            ], dtype=np.float64)

            # Camera matrix based on pinhole model
            focal_length = float(w)
            center = (w / 2.0, h / 2.0)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype=np.float64)
            dist_coeffs = np.zeros((4, 1), dtype=np.float64)

            # 1. Primary 3D Pose Estimation via solvePnP
            pnp_success = False
            rvec, tvec = None, None

            # Attempt SQPNP first (optimal non-degenerate solution for >=3 points)
            sqpnp_flag = getattr(cv2, "SOLVEPNP_SQPNP", None)
            if sqpnp_flag is not None:
                try:
                    pnp_success, rvec, tvec = cv2.solvePnP(
                        self.model_points,
                        image_points,
                        camera_matrix,
                        dist_coeffs,
                        flags=sqpnp_flag
                    )
                except Exception as e_pnp:
                    logger.debug("SOLVEPNP_SQPNP exception: %s", e_pnp)
                    pnp_success = False

            # Fallback to SOLVEPNP_ITERATIVE with forward initial guess if SQPNP failed
            if not pnp_success or rvec is None or tvec is None:
                try:
                    rvec_guess = np.zeros((3, 1), dtype=np.float64)
                    tvec_guess = np.array([[0.0], [0.0], [focal_length]], dtype=np.float64)
                    pnp_success, rvec, tvec = cv2.solvePnP(
                        self.model_points,
                        image_points,
                        camera_matrix,
                        dist_coeffs,
                        rvec=rvec_guess,
                        tvec=tvec_guess,
                        useExtrinsicGuess=True,
                        flags=cv2.SOLVEPNP_ITERATIVE
                    )
                except Exception as e_iter:
                    logger.debug("SOLVEPNP_ITERATIVE exception: %s", e_iter)
                    pnp_success = False

            pnp_yaw = 0.0
            pnp_pitch = 0.0
            reproj_err = 999.0

            if pnp_success and rvec is not None and tvec is not None:
                rmat, _ = cv2.Rodrigues(rvec)
                angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
                # RQDecomp3x3 Euler angles:
                # angles[0]: Pitch (rotation about X-axis). Negative = looking UP, Positive = looking DOWN
                # angles[1]: Yaw (rotation about Y-axis). In camera coords, turning towards image left is positive rad.
                # We negate angles[1] so: negative yaw = candidate looking LEFT, positive yaw = candidate looking RIGHT.
                pnp_pitch = float(angles[0])
                pnp_yaw = -float(angles[1])

                # Calculate reprojection error to verify geometric convergence
                proj_pts, _ = cv2.projectPoints(self.model_points, rvec, tvec, camera_matrix, dist_coeffs)
                reproj_err = float(np.mean(np.linalg.norm(image_points - proj_pts.reshape(-1, 2), axis=1)))

            # 2. Robust 2D Geometric Landmark Ratios (invariant to out-of-plane PnP degenerate flips)
            eye_mid_x = (right_eye[0] + left_eye[0]) / 2.0
            eye_mid_y = (right_eye[1] + left_eye[1]) / 2.0
            mouth_mid_y = (right_mouth[1] + left_mouth[1]) / 2.0
            d_eyes = float(np.linalg.norm(np.array(left_eye) - np.array(right_eye)))
            d_vert = float(mouth_mid_y - eye_mid_y)

            # Yaw: horizontal offset of nose from eye midpoint normalized by interocular distance
            dx_ratio = (nose_tip[0] - eye_mid_x) / (d_eyes + 1e-6)
            geom_yaw = float(dx_ratio * 90.0)

            # Pitch: vertical offset of nose along the eye-mouth span
            # Anthropometric baseline: frontal resting position is ~0.534 of the vertical span
            norm_y = (nose_tip[1] - eye_mid_y) / (d_vert + 1e-6)
            geom_pitch = float((norm_y - 0.534) * 150.0)

            # 3. Validated Hierarchical Fusion:
            # - When PnP converges with minimal reprojection error (<= 2.5px) and matches geometric direction,
            #   use the exact 3D rigid pose.
            # - When PnP has moderate reprojection error (<= 7.0px) and stays within 25 deg of geometry,
            #   blend 3D PnP with 2D geometric ratio to dampen morphology discrepancies.
            # - If PnP diverges or fails reprojection (> 7.0px), fall back strictly to 2D geometric landmark ratios.
            if pnp_success and reproj_err <= 2.5 and abs(pnp_pitch - geom_pitch) <= 15.0 and abs(pnp_yaw - geom_yaw) <= 15.0:
                yaw = pnp_yaw
                pitch = pnp_pitch
                confidence = float(np.clip(1.0 - (reproj_err / 20.0), 0.85, 0.98))
            elif pnp_success and reproj_err <= 7.0 and abs(pnp_pitch - geom_pitch) <= 25.0 and abs(pnp_yaw - geom_yaw) <= 25.0:
                yaw = 0.5 * pnp_yaw + 0.5 * geom_yaw
                pitch = 0.5 * pnp_pitch + 0.5 * geom_pitch
                confidence = float(np.clip(1.0 - (reproj_err / 20.0), 0.70, 0.90))
            else:
                yaw = geom_yaw
                pitch = geom_pitch
                confidence = 0.70 if pnp_success else 0.60
                if pnp_success and reproj_err > 7.0:
                    logger.debug("PnP rejected due to reprojection error: %.2fpx", reproj_err)

            yaw = round(float(np.clip(yaw, -90.0, 90.0)), 1)
            pitch = round(float(np.clip(pitch, -90.0, 90.0)), 1)
            confidence = round(confidence, 2)
            reproj_err = round(reproj_err, 2)

            # 4. Discrete Gaze Direction Determination
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
                "is_looking_away": is_looking_away,
                "is_valid": True,
                "confidence": confidence,
                "reprojection_error": reproj_err
            }
        except Exception as e:
            logger.error("Gaze estimation unexpected error: %s", e)
            return {
                "gaze_direction": "CENTER",
                "yaw": 0.0,
                "pitch": 0.0,
                "is_looking_away": False,
                "is_valid": False,
                "confidence": 0.0,
                "reprojection_error": 0.0
            }
