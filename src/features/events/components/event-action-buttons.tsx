"use client";
import { Bookmark, Check, ArrowUpRight } from "lucide-react";
import type { Event } from "../types";
import styles from "./event-detail.module.css";
export interface EventInteractionProps { event: Event; joined: boolean; saved: boolean; onJoin: () => void; onSave: () => void }
export function EventActionButtons({ event, joined, saved, onJoin, onSave }: EventInteractionProps) {
  const ended = event.status === "completed";
  return <div className={styles.actionButtons}>
    <button type="button" className={styles.join} disabled={ended} aria-pressed={ended ? undefined : joined} aria-label={ended ? "Event ended" : `${joined ? "Undo demo join for" : "Join Event:"} ${event.title}`} onClick={onJoin}>{ended ? "Event ended" : joined ? "Joined" : "Join Event"}{!ended && (joined ? <Check size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />)}</button>
    <button type="button" className={styles.save} aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${event.title}`} onClick={onSave}><Bookmark size={17} aria-hidden="true" fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span></button>
  </div>;
}
