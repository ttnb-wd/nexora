import { Asterisk } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event } from "../types";
import styles from "./event-artwork.module.css";

export function EventArtwork({ event, size = "card", className }: { event: Event; size?: "card" | "hero" | "compact" | "editorial"; className?: string }) {
  const date = new Date(`${event.date}T12:00:00Z`);
  return <div className={cn(styles.artwork, styles[event.visual.tone], styles[size], className)} aria-hidden="true">
    <div className={styles.art}><div className={styles.grid} /><div className={styles.ring} /><div className={styles.orb} /><div className={styles.ribbon} /><Asterisk className={styles.star} strokeWidth={1} /></div>
    <span className={styles.top}>{event.category} / NEXORA SELECTS</span>
    <strong className={styles.headline}>{event.visual.headline}</strong>
    <span className={styles.caption}>{event.visual.caption}</span>
    <span className={styles.badge}><b>{date.getUTCDate()}</b>{date.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</span>
  </div>;
}
