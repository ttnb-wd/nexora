"use client";
import { motion, useReducedMotion } from "motion/react";
import { SearchX } from "lucide-react";
import { EventCard } from "@/components/event/event-card";
import type { Event } from "../types";
import styles from "./explore.module.css";
export function EventResults({ events, view, savedIds, onSave, onReset, transitionKey }: { events: Event[]; view: "grid" | "list"; savedIds: string[]; onSave: (id: string) => void; onReset: () => void; transitionKey: string }) {
  const reducedMotion = useReducedMotion();
  // Short opacity entrances avoid expensive grid layout animation.
  return <motion.div id="event-results" initial={false} animate={{ opacity: 1 }} key={transitionKey} transition={{ duration: reducedMotion ? 0 : .2 }}>
    {events.length ? <div className={view === "grid" ? styles.grid : styles.list}>{events.map((event, index) => <motion.div key={event.id} initial={reducedMotion ? false : { opacity: .65 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : .22 }} className={view === "grid" && index === 3 ? styles.wide : undefined}><EventCard event={event} variant={view === "list" ? "compact" : index === 3 ? "editorial" : "standard"} saved={savedIds.includes(event.id)} onSave={() => onSave(event.id)} /></motion.div>)}</div> : <div className={styles.empty}><span><SearchX size={30} aria-hidden="true" /></span><h3>No moments found. Yet.</h3><p>Try a different search or give your curiosity a little more room.</p><button type="button" onClick={onReset}>Reset all filters</button></div>}
  </motion.div>;
}
