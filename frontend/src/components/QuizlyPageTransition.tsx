"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { AmbientBackground } from "@/components/effects/AmbientBackground";

/**
 * Consistent, lightweight Quizly page-entry animation.
 * Uses opacity only so fixed modals and exam controls keep normal positioning.
 */
export function QuizlyPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const ambientDisabled =
    pathname.startsWith("/test/") ||
    pathname.startsWith("/join/") ||
    pathname === "/join";

  return (
    <motion.div
      key={pathname}
      className="min-h-screen"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
    >
      <AmbientBackground />
      <div className={`relative z-20 min-h-screen${ambientDisabled ? "" : " ambient-content"}`}>{children}</div>
    </motion.div>
  );
}
