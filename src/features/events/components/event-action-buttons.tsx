"use client";
import Link from "next/link";
import { Bookmark, Check, ArrowUpRight } from "lucide-react";
import type { Availability } from "@/features/participation/rules";
import type { Event } from "../types";
import styles from "./event-detail.module.css";
export interface EventInteractionProps { event: Event; joined: boolean; attended: boolean; saved: boolean; onJoin: () => void; onCancel: () => void; onSave: () => void; pending: boolean; availability: Availability; message: string }
export function EventActionButtons({ event, joined, attended, saved, onJoin, onCancel, onSave, pending, availability, hideCancel = false }: EventInteractionProps & { hideCancel?: boolean }) {
  const ended = event.status === "completed";
  return <div className={styles.actionButtons}>
    <button type="button" className={styles.join} disabled={pending || attended || (!joined && Boolean(availability.closedReason)) || joined} aria-pressed={ended || attended ? undefined : joined} aria-label={attended ? `Attended: ${event.title}` : ended ? "Event ended" : `${joined ? "Joined:" : "Join Event:"} ${event.title}`} onClick={onJoin}>{attended ? "Attended" : joined ? "Joined" : ended ? "Event ended" : availability.closedReason === "Registration is closed." ? "Registration closed" : availability.spotsLeft === 0 ? "Event full" : availability.closedReason ? "Registration closed" : "Join Event"}{!ended && (joined || attended ? <Check size={18} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />)}</button>
    <button type="button" className={styles.save} aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${event.title}`} disabled={pending} onClick={onSave}><Bookmark size={17} aria-hidden="true" fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span></button>
    {(attended || (joined && !ended)) && <Link href={`/dashboard/joined/${event.slug}/ticket`} className={styles.save}>View ticket</Link>}
    {joined && !attended && !hideCancel && <button type="button" className={styles.save} disabled={pending} onClick={onCancel} aria-label={`Cancel registration for ${event.title}`}>Cancel registration</button>}
  </div>;
}
