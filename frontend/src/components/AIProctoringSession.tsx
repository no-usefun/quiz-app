"use client";

import { useSyncExternalStore } from "react";
import { AIProctoringHUD } from "@/components/AIProctoringHUD";
import { ProctoringWarningModal } from "@/components/ProctoringWarningModal";
import { useAIProctoring } from "@/hooks/useAIProctoring";

interface AIProctoringSessionProps {
  attemptId: number;
  testCode: string;
  enabled: boolean;
  onAutoSubmit: () => void;
}

const subscribeToSessionStorage = (_onStoreChange: () => void) => () => {};

function useSessionStorageValue(key: string): string | null {
  return useSyncExternalStore(
    subscribeToSessionStorage,
    () =>
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(key),
    () => null,
  );
}

export function AIProctoringSession({
  attemptId,
  testCode,
  enabled,
  onAutoSubmit,
}: AIProctoringSessionProps) {
  const referenceImage = useSessionStorageValue("dynoquizz_reference_photo");
  const aiEnabledPreference = useSessionStorageValue(
    `dynoquizz_ai_proctoring_${testCode}`,
  );
  const aiEnabled = aiEnabledPreference !== "false";

  const proctoring = useAIProctoring({
    attemptId,
    testCode,
    referenceImage,
    onAutoSubmit,
    enabled:
      enabled &&
      aiEnabled &&
      Boolean(referenceImage) &&
      Number.isSafeInteger(attemptId) &&
      attemptId > 0,
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
          maxWarnings={5}
          isOnline={proctoring.isOnline}
        />
      </div>
      <ProctoringWarningModal
        isOpen={proctoring.activeWarningModal.isOpen}
        warningCount={proctoring.activeWarningModal.count}
        maxWarnings={5}
        reason={proctoring.activeWarningModal.reason}
        autoSubmitted={proctoring.activeWarningModal.autoSubmitted}
        faceDetected={proctoring.faceDetected}
        onAcknowledge={proctoring.dismissWarningModal}
      />
    </>
  );
}
