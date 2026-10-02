"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { motionTokens } from "@/config/motion";

type FadeUpProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
};

export function FadeUp({ children, className, delay = 0, distance = motionTokens.distance.subtle, duration = motionTokens.duration.slow }: FadeUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={inView && reduceMotion === false ? { opacity: [0, 1], y: [distance, 0] } : { opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : delay, duration: reduceMotion ? 0 : duration, ease: motionTokens.ease.premium }}
    >
      {children}
    </motion.div>
  );
}
