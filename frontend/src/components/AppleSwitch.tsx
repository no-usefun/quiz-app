"use client";

import { motion } from "framer-motion";

type AppleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Shared Apple-style switch. The thumb fills the track height with no inset gap.
 * It snaps between endpoints with a brief stretch-and-settle motion.
 */
export function AppleSwitch({
  checked,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
}: AppleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-7 w-[60px] shrink-0 items-center overflow-hidden rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " +
        (checked ? "bg-[#007aff]" : "bg-[#d1d1d6]") +
        " " +
        className
      }
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          x: checked ? 24 : 0,
          y: [0, -1.5, 0],
          scaleX: [1, 1.16, 1],
          scaleY: [1, 0.94, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 700, damping: 25, mass: 0.65 },
          y: { duration: 0.28, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] },
          scaleX: { duration: 0.28, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] },
          scaleY: { duration: 0.28, times: [0, 0.42, 1], ease: [0.22, 1, 0.36, 1] },
        }}
        className="pointer-events-none absolute left-0 top-0 h-7 w-[36px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
      />
    </button>
  );
}
