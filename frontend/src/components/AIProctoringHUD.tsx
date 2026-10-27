"use client";

import React, { RefObject } from "react";
import SkeletonBlock from "@/components/SkeletonBlock";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  EyeOff,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

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

function metricValue(value: number | undefined, suffix = "°") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}${suffix}`
    : "—";
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
  similarityScore,
  gazeDirection,
  yaw,
  pitch,
  isLookingAway = false,
  phoneDetected,
  micLevel,
  voiceActive,
  loudVoice,
  warningCount,
  isOnline,
}: AIProctoringHUDProps) {
  const alerts: string[] = [];
  if (telemetryReceived && phoneDetected) alerts.push("A phone may be visible. Please keep it away.");
  if (telemetryReceived && numPersons > 1) alerts.push("Another person appears to be in the camera view.");
  else if (telemetryReceived && numFaces > 1) alerts.push("More than one face appears in the camera view.");
  if (telemetryReceived && isLookingAway && faceDetected) alerts.push("Please look toward your assessment screen.");
  if (telemetryReceived && !faceDetected) alerts.push("Please keep your face clearly visible.");
  if (telemetryReceived && faceDetected && !identityVerified) alerts.push("Please position your face clearly for identity verification.");

  const metrics: Array<[string, string, boolean | null]> = [
    ["Camera", cameraActive ? "Active" : "Inactive", cameraActive && !cameraError],
    ["AI service", isOnline ? "Connected" : "Offline", isOnline],
    ["Telemetry", telemetryReceived ? "Receiving" : "Waiting", telemetryReceived],
    ["Face detected", faceDetected ? "Yes" : "No", faceDetected],
    ["Identity match", identityVerified ? "Verified" : "Unverified", identityVerified],
    ["Faces in frame", String(numFaces), numFaces === 1],
    ["People in frame", String(numPersons), numPersons === 1],
    ["Gaze direction", gazeDirection || "—", gazeDirection === "CENTER"],
    ["Looking away", isLookingAway ? "Yes" : "No", !isLookingAway],
    ["Phone detected", phoneDetected ? "Yes" : "No", !phoneDetected],
    ["Voice activity", voiceActive ? "Detected" : "None", !voiceActive],
    ["Loud voice", loudVoice ? "Detected" : "No", !loudVoice],
  ];

  const similarityPercent =
    Number.isFinite(similarityScore)
      ? `${Math.round(similarityScore <= 1 ? similarityScore * 100 : similarityScore)}%`
      : "—";

  return (
    <section aria-label="Camera and proctoring metrics" className="space-y-2.5 text-left">
      <div className="overflow-hidden rounded-xl border border-[#d1dee8] bg-white">
        <div className="flex items-center justify-between border-b border-[#d1dee8]/70 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
            <Camera className="h-3.5 w-3.5" />
            Live proctoring camera
          </div>
          <span className={`h-2 w-2 rounded-full ${cameraError ? "bg-rose-500" : cameraActive ? "bg-emerald-500" : "bg-amber-400"}`} />
        </div>
        <div className="relative aspect-[4/3] w-full bg-stone-900">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-950/90 p-3 text-center text-xs text-white">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <span>{cameraError}</span>
            </div>
          ) : !cameraActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6" aria-busy="true">
              <Camera className="h-6 w-6 text-white/80" />
              <div className="w-full max-w-[180px] space-y-2" aria-hidden="true"><SkeletonBlock className="h-2.5 w-3/4 rounded bg-white/20" /><SkeletonBlock className="h-2.5 w-full rounded bg-white/15" /></div>
              <span className="sr-only" role="status">Connecting camera</span>
            </div>
          ) : telemetryReceived && alerts.length === 0 && faceDetected && identityVerified ? (
            <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700/90 px-2 py-1 text-[10px] font-semibold text-white">
              <ShieldCheck className="h-3 w-3" /> Proctoring ready
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

      <div className="rounded-xl border border-[#d1dee8] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#111111]">Live metrics</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${telemetryReceived ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {telemetryReceived ? "Live" : "Waiting"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(([label, value, good]) => (
            <div key={label} className="min-w-0 rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2 py-1.5">
              <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#78716b]">{label}</p>
              <p className={`truncate text-xs font-bold ${good === false ? "text-rose-600" : good === true ? "text-emerald-700" : "text-[#111111]"}`}>{value}</p>
            </div>
          ))}
          <div className="rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#78716b]">Identity similarity</p>
            <p className="text-xs font-bold text-[#111111]">{similarityPercent}</p>
          </div>
          <div className="rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#78716b]">Head yaw / pitch</p>
            <p className="text-xs font-bold text-[#111111]">{metricValue(yaw)} / {metricValue(pitch)}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2 py-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#78716b]">Microphone level</p>
              <p className="text-xs font-bold text-[#111111]">{Math.round(Math.max(0, Math.min(1, micLevel || 0)) * 100)}%</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e6e3e2]">
              <div className="h-full rounded-full bg-[#165dfb] transition-all" style={{ width: `${Math.round(Math.max(0, Math.min(1, micLevel || 0)) * 100)}%` }} />
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2 py-1.5">
            <span className="text-[10px] font-semibold text-[#78716b]">Warnings recorded</span>
            <span className={`text-xs font-extrabold ${warningCount > 0 ? "text-rose-600" : "text-emerald-700"}`}>{warningCount}</span>
          </div>
        </div>
        {telemetryReceived && alerts.length > 0 && (
          <div role="status" aria-live="polite" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            {alerts[0]}
          </div>
        )}
        <p className="mt-2 flex items-center gap-1 text-[9px] text-[#78716b]">
          {telemetryReceived ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertTriangle className="h-3 w-3 text-amber-600" />}
          Metrics update when the proctoring service sends telemetry.
        </p>
      </div>
    </section>
  );
}
