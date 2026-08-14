"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WaveTextProps {
  text: string;
  className?: string;
  stagger?: number;
  delay?: number;
}

export function WaveText({ text, className = "", stagger = 0.05, delay = 0 }: WaveTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const words = text.split(" ");

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 40,
      rotateX: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const, // Smooth cubic-bezier ease out
      },
    },
  };

  if (!mounted) {
    return <span className={className}>{text}</span>;
  }

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className={`inline-flex flex-wrap gap-x-[0.25em] ${className}`}
    >
      {words.map((word, idx) => (
        <span key={idx} className="inline-block overflow-hidden py-1">
          <motion.span
            variants={wordVariants}
            className="inline-block transform-gpu origin-bottom"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
