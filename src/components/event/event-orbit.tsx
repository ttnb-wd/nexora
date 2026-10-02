"use client";

import { useEffect, type PointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Asterisk, Compass, Sparkles } from "lucide-react";
import { FloatingElement } from "@/components/animation/floating-element";
import { EventCard } from "@/components/event/event-card";
import type { Event } from "@/features/events/types";
import { motionTokens } from "@/config/motion";
import styles from "./event-orbit.module.css";

const pointerQuery = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

export function EventOrbit({ events }: { events: Event[] }) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, motionTokens.spring);
  const smoothY = useSpring(y, motionTokens.spring);
  const rotateY = useTransform(smoothX, [-8, 8], [-1.5, 1.5]);
  const rotateX = useTransform(smoothY, [-6, 6], [1, -1]);
  const reset = () => { x.set(0); y.set(0); };

  useEffect(() => {
    const media = window.matchMedia(pointerQuery);
    const resetDepth = () => { x.set(0); y.set(0); };
    media.addEventListener("change", resetDepth);
    resetDepth();
    return () => media.removeEventListener("change", resetDepth);
  }, [reducedMotion, x, y]);

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion !== false || event.pointerType !== "mouse" || !window.matchMedia(pointerQuery).matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 16);
    y.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 12);
  }

  return (
    <div className={styles.composition} onPointerMove={handlePointer} onPointerLeave={reset}>
      <motion.div className={styles.art} aria-hidden="true" style={reducedMotion ? {} : { x: smoothX, y: smoothY, rotateX, rotateY }}>
        <div className={styles.grid} /><div className={styles.ring} /><div className={styles.innerRing} />
        <FloatingElement className={styles.core} duration={18} distance={10}><div><Asterisk strokeWidth={1.1} /></div></FloatingElement>
        {events[0] && <FloatingElement className={styles.design} duration={11} distance={10}><EventCard decorative variant="compact" event={events[0]} /></FloatingElement>}
        {events[1] && <FloatingElement className={styles.tech} duration={14} distance={8} delay={0.8}><EventCard decorative variant="compact" event={events[1]} /></FloatingElement>}
        {events[2] && <FloatingElement className={styles.community} duration={16} distance={12} delay={0.5}><EventCard decorative variant="compact" event={events[2]} /></FloatingElement>}
        <span className={styles.location}><Compass size={14} />Somewhere new</span><Sparkles className={styles.sparkle} />
      </motion.div>
      <p className={styles.caption}>Discovery, in every direction.<small>{events.length ? "A glimpse of what’s coming up" : "Make room for your next moment"}</small></p>
    </div>
  );
}
