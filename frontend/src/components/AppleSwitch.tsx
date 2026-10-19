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
 * Shared Apple-style on/off switch.
 * The track is a capsule; the inset white thumb is a rounded rectangle,
 * matching the macOS System Settings control rather than a circular knob.
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
        "relative inline-flex h-7 w-[60px] shrink-0 items-center rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " +
        (checked ? "bg-[#007aff]" : "bg-[#d1d1d6]") +
        " " +
        className
      }
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          x: checked ? [0, 8, 20] : [20, 12, 0],
          scaleX: [1, 1.12, 1],
        }}
        transition={{
          x: { duration: 0.34, times: [0, 0.52, 1], ease: [0.22, 1, 0.36, 1] },
          scaleX: { duration: 0.34, times: [0, 0.52, 1], ease: [0.22, 1, 0.36, 1] },
        }}
        className="pointer-events-none absolute left-[3px] top-1 h-5 w-[34px] rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
      />
    </button>
  );
}
