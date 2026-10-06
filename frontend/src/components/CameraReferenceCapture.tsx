"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Shield } from "lucide-react";
import { checkAIHealth } from "@/lib/proctoring/aiProctoringClient";

interface CameraReferenceCaptureProps {
  onCapture: (base64Image: string) => void;
  disabled?: boolean;
}

export function CameraReferenceCapture({
  onCapture,
  disabled = false,
}: CameraReferenceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"CHECKING" | "ONLINE" | "OFFLINE" | "BIOMETRICS_OFFLINE">("CHECKING");

  // Check AI service status
  useEffect(() => {
    let mounted = true;
    checkAIHealth().then((res) => {
      if (mounted) {
        if (!res.isOnline) {
          setAiStatus("OFFLINE");
        } else if (!res.biometricReady) {
          setAiStatus("BIOMETRICS_OFFLINE");
        } else {
          setAiStatus("ONLINE");
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: unknown) {
      console.error("Camera access failed:", err);
      setCameraError(
        "Camera permission was denied or no camera device was found. Please enable camera access."
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !cameraActive) return;

    setIsProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context failed");

      // Draw mirrored frame
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL("image/jpeg", 0.90);
      setCapturedPhoto(base64Data);
      onCapture(base64Data);
      stopCamera();
    } catch (e) {
      console.error("Capture failed:", e);
      setCameraError("Failed to capture reference image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    void startCamera();
  };

  return (
    <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#165dfb]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Biometric Reference Photo
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              aiStatus === "ONLINE"
                ? "bg-emerald-500 animate-pulse"
                : aiStatus === "BIOMETRICS_OFFLINE"
                ? "bg-amber-500 animate-pulse"
                : aiStatus === "OFFLINE"
                ? "bg-rose-500"
                : "bg-stone-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] font-bold text-[#78716b]">
            AI Proctor: {aiStatus === "BIOMETRICS_OFFLINE" ? "BIOMETRICS OFFLINE" : aiStatus}
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-4/3 max-w-[420px] mx-auto bg-stone-900 rounded-[12px] overflow-hidden border border-[#d1dee8] flex items-center justify-center">
        {capturedPhoto ? (
          // Captured Image Preview
          <div className="relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedPhoto}
              alt="Reference"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-emerald-950/20 flex flex-col items-center justify-center gap-1.5 text-white">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 drop-shadow-md" />
              <span className="text-xs font-bold text-white drop-shadow">
                Reference Photo Captured
              </span>
            </div>
          </div>
        ) : (
          // Live Video Stream
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${
                cameraActive ? "block" : "hidden"
              }`}
            />

            {/* Oval Guide Overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                <div className="w-[190px] h-[250px] rounded-full border-2 border-dashed border-[#165dfb]/80 shadow-[0_0_15px_rgba(22,93,251,0.2)]" />
                <span className="mt-2 text-[10px] font-bold text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                  Center your face inside the oval
                </span>
              </div>
            )}

            {!cameraActive && !cameraError && (
              <div className="flex flex-col items-center gap-2 text-stone-400">
                <Loader2 className="h-6 w-6 animate-spin text-[#165dfb]" />
                <span className="text-xs font-medium">Initializing camera...</span>
              </div>
            )}

            {cameraError && (
              <div className="p-4 text-center text-rose-300 space-y-2">
                <AlertTriangle className="h-6 w-6 mx-auto text-rose-400" />
                <p className="text-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs bg-rose-900/60 border border-rose-700 px-3 py-1.5 rounded-[8px] text-rose-100 hover:bg-rose-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Retry Camera
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-[#78716b] font-medium leading-tight">
          This reference photo is used by the biometric engine to continuously verify your identity during the assessment.
        </p>

        {capturedPhoto ? (
          <button
            type="button"
            onClick={handleRetake}
            disabled={disabled}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8] bg-white px-3.5 py-2 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-95 shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retake
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={!cameraActive || isProcessing || disabled}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#124bce] active:scale-95 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            Take Photo
          </button>
        )}
      </div>
    </div>
  );
}
