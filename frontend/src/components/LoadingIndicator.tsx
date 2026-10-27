"use client";

import { Loader2 } from "lucide-react";

type LoadingIndicatorProps = {
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<LoadingIndicatorProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/** Accessible icon-only loading status shared across the application. */
export default function LoadingIndicator({
  label,
  size = "md",
  className = "",
}: LoadingIndicatorProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`inline-flex items-center justify-center ${className}`.trim()}
    >
      <Loader2
        aria-hidden="true"
        className={`${sizeClasses[size]} animate-spin text-[#165dfb] dark:text-blue-300`}
      />
    </span>
  );
}
