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
        "relative inline-flex h-7 w-[60px] shrink-0 items-center overflow-hidden rounded-full border-0 p-0 transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " +
        (checked ? "bg-[#007aff]" : "bg-[#34343a]") +
        " " +
        className
      }
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{
          x: checked ? 20 : 0,
          scaleX: [1, 1.05, 1],
          scaleY: [1, 0.98, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
          scaleX: { duration: 0.24, times: [0, 0.48, 1], ease: [0.22, 1, 0.36, 1] },
          scaleY: { duration: 0.24, times: [0, 0.48, 1], ease: [0.22, 1, 0.36, 1] },
        }}
        className="pointer-events-none absolute left-[3px] top-[3px] h-[22px] w-[34px] rounded-full bg-[#f5f5f7] shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
      />
    </button>
  );
}
