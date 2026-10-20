"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { APP_NAME } from "@/lib/constants";

export function AppWordmark({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg" | "sm";
}) {
  const markSize =
    size === "lg" ? "h-10 w-10 rounded-xl" :
    size === "sm" ? "h-7 w-7 rounded-lg" :
    "h-8 w-8 rounded-lg";
  const iconSize =
    size === "lg" ? "h-6 w-6" :
    size === "sm" ? "h-4 w-4" :
    "h-[18px] w-[18px]";
  const textSize =
    size === "lg" ? "text-xl" :
    size === "sm" ? "text-xs" :
    "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label={APP_NAME}
    >
      <span className={`inline-flex shrink-0 items-center justify-center border border-slate-200 bg-slate-900 text-white dark:border-slate-700 dark:bg-white dark:text-slate-900 ${markSize}`}>
        <GraduationCap aria-hidden="true" className={iconSize} strokeWidth={2.1} />
      </span>
      <span className={`font-semibold tracking-tight text-slate-900 dark:text-slate-100 ${textSize}`}>
        {APP_NAME}
      </span>
    </span>
  );
}

export function Logo() {
  const { user } = useSession();

  const href = user
    ? user.role?.toUpperCase() === "TEACHER"
      ? "/dashboard/teacher"
      : "/dashboard/student"
    : "/";

  return (
    <Link href={href} className="group flex items-center transition-opacity hover:opacity-80">
      <AppWordmark />
    </Link>
  );
}
