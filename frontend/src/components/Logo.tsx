"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/useSession";
import { APP_NAME } from "@/lib/constants";

// ─── Animated wordmark — plays once on mount, never loops ─────────────────────
export function AppWordmark({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg" | "sm";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const letters = APP_NAME.split("");

  const textClass =
    size === "lg"
      ? "text-2xl font-extrabold tracking-tight"
      : size === "sm"
        ? "text-xs font-bold tracking-tight"
        : "text-sm font-bold tracking-tight";

  return (
    <span
      className={`inline-flex items-baseline select-none ${textClass} ${className}`}
      aria-label={APP_NAME}
    >
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          initial={mounted ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: mounted ? i * 0.055 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          // Subtle accent on the first letter
          className={
            i === 0
              ? "text-[#165dfb]"
              : "text-[#111111]"
          }
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );
}

// ─── Logo — clickable wordmark, routes by role ────────────────────────────────
export function Logo() {
  const { user } = useSession();

  const href = user
    ? user.role?.toUpperCase() === "TEACHER"
      ? "/dashboard/teacher"
      : "/dashboard/student"
    : "/";

  return (
    <Link href={href} className="group flex items-center">
      <AppWordmark className="group-hover:opacity-80 transition-opacity" />
    </Link>
  );
}
