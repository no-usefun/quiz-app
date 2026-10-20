"use client";

import React, { RefObject } from "react";
import { AlertTriangle, Camera, ShieldCheck, Smartphone, Users, EyeOff } from "lucide-react";

interface AIProctoringHUDProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraActive: boolean;
  cameraError?: string | null;
  telemetryReceived?: boolean;
  faceDetected: boolean;
  numFaces: number;
  numPersons?: number;
  identityVerified: boolean;
  similarityScore: number;
  gazeDirection?: "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN";
  yaw?: number;
  pitch?: number;
  isLookingAway?: boolean;
  phoneDetected: boolean;
  micLevel: number;
  voiceActive: boolean;
  loudVoice: boolean;
  warningCount: number;
  isOnline: boolean;
}

export function AIProctoringHUD({
  videoRef,
  cameraActive,
  cameraError,
  telemetryReceived = false,
  faceDetected,
  numFaces,
  numPersons = 1,
  identityVerified,
  isLookingAway = false,
  phoneDetected,
}: AIProctoringHUDProps) {
  const alerts: string[] = [];
  if (telemetryReceived && phoneDetected) alerts.push("A phone may be visible. Please keep it away.");
  if (telemetryReceived && numPersons > 1) alerts.push("Another person appears to be in the camera view.");
  else if (telemetryReceived && numFaces > 1) alerts.push("More than one face appears in the camera view.");
  if (telemetryReceived && isLookingAway && faceDetected) alerts.push("Please look toward your assessment screen.");
  if (telemetryReceived && !faceDetected) alerts.push("Please keep your face clearly visible.");
  if (telemetryReceived && faceDetected && !identityVerified) alerts.push("Please position your face clearly for identity verification.");

  return (
    <section aria-label="Camera and proctoring status" className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-[#d1dee8] bg-white">
        <div className="flex items-center justify-between border-b border-[#d1dee8]/70 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
            <Camera className="h-3.5 w-3.5" />
            Camera
          </div>
          <span className={`h-2 w-2 rounded-full ${cameraError ? "bg-rose-500" : cameraActive ? "bg-emerald-500" : "bg-amber-400"}`} />
        </div>
        <div className="relative aspect-[4/3] w-full bg-stone-900">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/90 p-3 text-center text-xs text-white">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <span>{cameraError}</span>
            </div>
          ) : !cameraActive ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-white/80">
              <Camera className="h-4 w-4" /> Connecting camera…
            </div>
          ) : telemetryReceived && alerts.length === 0 && faceDetected && identityVerified ? (
            <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700/90 px-2 py-1 text-[10px] font-semibold text-white">
              <ShieldCheck className="h-3 w-3" /> Ready
            </div>
          ) : null}
          {telemetryReceived && alerts.length > 0 && (
            <div className="absolute bottom-2 left-2 right-2 space-y-1">
              {alerts.slice(0, 2).map((alert) => (
                <div key={alert} className="flex items-center gap-1.5 rounded-md bg-amber-600/95 px-2 py-1 text-[10px] font-semibold text-white">
                  {phoneDetected ? <Smartphone className="h-3 w-3 shrink-0" /> : numPersons > 1 || numFaces > 1 ? <Users className="h-3 w-3 shrink-0" /> : <EyeOff className="h-3 w-3 shrink-0" />}
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {telemetryReceived && alerts.length > 0 && (
        <div role="status" aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {alerts[0]}
        </div>
      )}
    </section>
  );
}
