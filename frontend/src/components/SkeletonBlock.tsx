import type { HTMLAttributes } from "react";

type SkeletonBlockProps = HTMLAttributes<HTMLSpanElement>;

/**
 * Reusable shimmer placeholder for content that has not loaded yet.
 * Keep the real page's layout, icons and controls visible around this block.
 */
export default function SkeletonBlock({
  className = "",
  ...props
}: SkeletonBlockProps) {
  return (
    <span
      aria-hidden="true"
      className={`quizly-skeleton inline-block ${className}`.trim()}
      {...props}
    />
  );
}
