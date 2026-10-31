"use client";

import { usePathname } from "next/navigation";
import styles from "./AmbientBackground.module.css";

/**
 * Decorative-only atmosphere for Quizly. Active assessments deliberately omit
 * the effect to keep the question surface distraction-free.
 */
export function AmbientBackground() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/test/") ||
    pathname.startsWith("/join/") ||
    pathname === "/join"
  ) {
    return null;
  }

  const isPublicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";

  const variant = isPublicPage ? "public" : "dashboard";

  return (
    <div
      aria-hidden="true"
      className={styles.ambient}
      data-ambient-variant={variant}
    >
      <span className={`${styles.orb} ${styles.orbBlue}`} />
      <span className={`${styles.orb} ${styles.orbLavender}`} />
      <span className={`${styles.orb} ${styles.orbMint}`} />
      <span className={styles.halo} />
    </div>
  );
}
