"use client";

import React, { RefObject } from "react";
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Smartphone,
  Mic,
  MicOff,
  Volume2,
  Users,
} from "lucide-react";

interface AIProctoringHUDProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraActive: boolean;
  faceDetected: boolean;
  numFaces: number;
  identityVerified: boolean;
  similarityScore: number;
  phoneDetected: boolean;
  micLevel: number; // 0.0 to 1.0
  voiceActive: boolean;
  loudVoice: boolean;
  warningCount: number;
  isOnline: boolean;
}

export function AIProctoringHUD({
  videoRef,
  cameraActive,
  faceDetected,
  numFaces,
  identityVerified,
  similarityScore,
  phoneDetected,
  micLevel,
  voiceActive,
  loudVoice,
  warningCount,
  isOnline,
}: AIProctoringHUDProps) {
  return (
    <div className="rounded-[14px] border border-[#d1dee8]/80 bg-white/95 backdrop-blur-md p-3.5 shadow-lg space-y-3">
      {/* HUD Header */}
      <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#111111]">
            AI Proctor HUD
          </span>
        </div>

        {/* Warning Strikes Badge */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            warningCount === 0
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : warningCount === 1
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
          }`}
        >
          <ShieldAlert className="h-3 w-3" />
          <span>Warnings: {warningCount}/3</span>
        </div>
      </div>

      {/* Mirrored Live Video Feed */}
      <div className="relative aspect-4/3 w-full bg-stone-900 rounded-[10px] overflow-hidden border border-[#d1dee8]">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover scale-x-[-1] ${
            cameraActive ? "block" : "hidden"
          }`}
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 gap-1">
            <MicOff className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Feed Standby</span>
          </div>
        )}

        {/* Live Overlays / Alert Badges */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1 pointer-events-none">
          {/* Phone Detected Alert */}
          {phoneDetected && (
            <div className="inline-flex items-center gap-1 bg-rose-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] shadow-sm animate-bounce">
              <Smartphone className="h-2.5 w-2.5" />
              <span>PHONE DETECTED</span>
            </div>
          )}

          {/* Multiple Faces Alert */}
          {numFaces > 1 && (
            <div className="inline-flex items-center gap-1 bg-rose-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] shadow-sm">
              <Users className="h-2.5 w-2.5" />
              <span>{numFaces} FACES</span>
            </div>
          )}

          {/* No Face Alert */}
          {!faceDetected && cameraActive && (
            <div className="inline-flex items-center gap-1 bg-amber-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] shadow-sm">
              <UserX className="h-2.5 w-2.5" />
              <span>NO FACE</span>
            </div>
          )}

          {/* Loud Voice Alert */}
          {loudVoice && (
            <div className="inline-flex items-center gap-1 bg-rose-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] shadow-sm">
              <Volume2 className="h-2.5 w-2.5" />
              <span>LOUD VOICE</span>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry Status Matrix */}
      <div className="space-y-1.5 text-[10.5px]">
        {/* Face Status */}
        <div className="flex items-center justify-between px-1 py-0.5 rounded-[6px] bg-[#f5f5f4]">
          <span className="text-[#78716b] font-semibold">Face Track</span>
          <span
            className={`font-bold flex items-center gap-1 ${
              faceDetected && numFaces === 1
                ? "text-emerald-600"
                : numFaces > 1
                ? "text-rose-600"
                : "text-amber-600"
            }`}
          >
            {faceDetected && numFaces === 1 ? (
              <>
                <UserCheck className="h-3 w-3" /> Locked (1)
              </>
            ) : numFaces > 1 ? (
              <>
                <Users className="h-3 w-3" /> Multi ({numFaces})
              </>
            ) : (
              <>
                <UserX className="h-3 w-3" /> Absent
              </>
            )}
          </span>
        </div>

        {/* Biometric Match */}
        <div className="flex items-center justify-between px-1 py-0.5 rounded-[6px] bg-[#f5f5f4]">
          <span className="text-[#78716b] font-semibold">Identity</span>
          <span
            className={`font-bold ${
              identityVerified ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {identityVerified
              ? `Verified (${Math.round(similarityScore * 100)}%)`
              : "Mismatch"}
          </span>
        </div>

        {/* Mic & Speech VAD Meter */}
        <div className="space-y-1 px-1 py-1 rounded-[6px] bg-[#f5f5f4]">
          <div className="flex items-center justify-between">
            <span className="text-[#78716b] font-semibold flex items-center gap-1">
              <Mic className="h-3 w-3" /> Audio VAD
            </span>
            <span
              className={`font-bold ${
                loudVoice
                  ? "text-rose-600"
                  : voiceActive
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {loudVoice ? "LOUD SPEECH" : voiceActive ? "SPEECH ACTIVE" : "Quiet"}
            </span>
          </div>

          {/* Real-time VU meter bar */}
          <div className="w-full bg-[#d1dee8]/60 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 rounded-full ${
                micLevel > 0.65
                  ? "bg-rose-500"
                  : micLevel > 0.35
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, micLevel * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
