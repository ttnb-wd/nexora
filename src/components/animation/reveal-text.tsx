"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { GradientText } from "@/components/animation/gradient-text";
import { motionTokens } from "@/config/motion";
import { cn } from "@/lib/utils";

type RevealTextProps = {
  text: string;
  mode?: "word" | "line";
  gradientIndices?: readonly number[];
  delay?: number;
  className?: string;
};

export function RevealText({ text, mode = "word", gradientIndices = [], delay = 0, className }: RevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const segments = mode === "line" ? text.split("\n") : text.trim().split(/\s+/);
  return (
    <span ref={ref} className={cn("reveal-text", className)}>
      <span className="sr-only">{text.replace(/\n/g, " ")}</span>
      <span aria-hidden="true">
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className={cn("reveal-segment", mode === "line" && "reveal-line")}>
            <motion.span
              className="reveal-inner"
              initial={false}
              animate={inView && reduceMotion === false ? { opacity: [0, 1], y: ["110%", "0%"], rotateX: [8, 0] } : { opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: reduceMotion ? 0 : motionTokens.duration.slow, delay: reduceMotion ? 0 : delay + index * motionTokens.stagger[mode], ease: motionTokens.ease.premium }}
            >
              {gradientIndices.includes(index) ? <GradientText>{segment}</GradientText> : segment}
            </motion.span>
            {mode === "word" && index < segments.length - 1 ? "\u00a0" : null}
          </span>
        ))}
      </span>
    </span>
  );
}
