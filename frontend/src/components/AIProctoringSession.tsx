"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/api/client";
import { AIProctoringHUD } from "@/components/AIProctoringHUD";
import { ProctoringWarningModal } from "@/components/ProctoringWarningModal";
import { useAIProctoring } from "@/hooks/useAIProctoring";

interface AIProctoringSessionProps {
  attemptId: number;
  testCode: string;
  enabled: boolean;
  onAutoSubmit: () => void;
}

export function AIProctoringSession({
  attemptId,
  testCode,
  enabled,
  onAutoSubmit,
}: AIProctoringSessionProps) {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | undefined>();
  const [authToken, setAuthToken] = useState<string | undefined>();
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReferenceImage(sessionStorage.getItem("dynoquizz_reference_photo"));
    setAiEnabled(sessionStorage.getItem(`dynoquizz_ai_proctoring_${testCode}`) !== "false");
    setAuthToken(getAuthToken() || undefined);
    try {
      const user = JSON.parse(localStorage.getItem("dynoquizz_user") || "{}");
      if (user?.id != null) setStudentId(String(user.id));
    } catch {
      setStudentId(undefined);
    }
  }, [testCode]);

  const proctoring = useAIProctoring({
    attemptId,
    studentId,
    testCode,
    referenceImage,
    authToken,
    onAutoSubmit,
    enabled: enabled && aiEnabled && Boolean(referenceImage) && Number.isSafeInteger(attemptId) && attemptId > 0,
  });

  if (!enabled || !aiEnabled || !referenceImage) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 w-64 max-w-[calc(100vw-2rem)] shadow-xl">
        <AIProctoringHUD
          videoRef={proctoring.videoRef}
          cameraActive={proctoring.cameraActive}
          cameraError={proctoring.cameraError}
          telemetryReceived={proctoring.telemetryReceived}
          faceDetected={proctoring.faceDetected}
          numFaces={proctoring.numFaces}
          numPersons={proctoring.numPersons}
          identityVerified={proctoring.identityVerified}
          similarityScore={proctoring.similarityScore}
          gazeDirection={proctoring.gazeDirection}
          yaw={proctoring.yaw}
          pitch={proctoring.pitch}
          isLookingAway={proctoring.isLookingAway}
          phoneDetected={proctoring.phoneDetected}
          micLevel={proctoring.micLevel}
          voiceActive={proctoring.voiceActive}
          loudVoice={proctoring.loudVoice}
          warningCount={proctoring.warningCount}
          isOnline={proctoring.isOnline}
        />
      </div>
      <ProctoringWarningModal
        isOpen={proctoring.activeWarningModal.isOpen}
        warningCount={proctoring.activeWarningModal.count}
        reason={proctoring.activeWarningModal.reason}
        autoSubmitted={proctoring.activeWarningModal.autoSubmitted}
        faceDetected={proctoring.faceDetected}
        onAcknowledge={proctoring.dismissWarningModal}
      />
    </>
  );
}
