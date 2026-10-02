"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { motionTokens } from "@/config/motion";
import { cn } from "@/lib/utils";

type FloatingElementProps = {
  children?: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
};

/** Decorative only. Animation pauses offscreen; all content is hidden from AT. */
export function FloatingElement({ children, className, delay = 0, distance = motionTokens.distance.float, duration = motionTokens.duration.float }: FloatingElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "80px" });
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      className={cn("floating-element", className)}
      initial={false}
      animate={inView && reduceMotion === false ? { y: [0, -distance, 0], x: [0, distance / 3, 0] } : { y: 0, x: 0 }}
      transition={{ duration: reduceMotion ? 0 : duration, delay: reduceMotion ? 0 : delay, repeat: inView && !reduceMotion ? Infinity : 0, ease: motionTokens.ease.float }}
    >
      {children}
    </motion.div>
  );
}
