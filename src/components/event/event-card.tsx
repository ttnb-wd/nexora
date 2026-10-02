"use client";

import Link from "next/link";
import { getOrganizationById } from "@/features/organizations/organization-helpers";
import { EventArtwork } from "@/features/events/components/event-artwork";
import { useState } from "react";
import { ArrowUpRight, Bookmark, CalendarDays, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event, EventCardVariant } from "@/features/events/types";
import styles from "./event-card.module.css";

export type EventCardProps = { event: Event; variant?: EventCardVariant; saved?: boolean; onSave?: () => void; decorative?: boolean };
export function EventCard({ event, variant = "standard", saved, onSave, decorative = false }: EventCardProps) {
  const organization = getOrganizationById(event.organizationId);
  const [localSaved, setLocalSaved] = useState(false);
  const isSaved = saved ?? localSaved;
  const date = new Date(`${event.date}T12:00:00Z`);
  const day = date.getUTCDate();
  const month = date.toLocaleDateString("en", { month: "short", timeZone: "UTC" });
  return (
    <article className={cn(styles.card, styles[variant], styles[event.visual.tone], event.status === "completed" && styles.completed, decorative && styles.decorative)} aria-label={decorative ? undefined : event.title}>
      <EventArtwork event={event} size={variant === "featured" ? "hero" : variant === "standard" ? "card" : variant} className={styles.visual} />
      <div className={styles.body}>
        <div className={styles.categoryRow}><span>{event.category}</span><span className={styles.type}>{event.status === "completed" ? "Completed" : event.type}</span></div>
        <h3>{event.title}</h3>
        {event.description && variant !== "compact" && <p className={styles.description}>{event.description}</p>}
        <p className={styles.meta}><CalendarDays aria-hidden="true" /><time dateTime={event.date}>{month} {day}, {date.getUTCFullYear()}</time></p>
        <p className={styles.time}>{event.time}</p>
        <p className={styles.meta}><MapPin aria-hidden="true" /><span>{event.location.venue} · {event.location.city}</span></p>
        <p className={styles.organizer}>By {organization && !decorative ? <Link href={`/companies/${organization.slug}`}>{organization.name}</Link> : <strong>{organization?.name ?? "Nexora community"}</strong>}</p>
        {!decorative && <div className={styles.actions}>
          <div className={styles.cardNavigation}><Link href={`/events/${event.slug}`} className={styles.eventLink} aria-label={`${event.status === "completed" ? "Revisit" : "Explore"} ${event.title}`}>{event.status === "completed" ? "Revisit event" : "Explore event"} <ArrowUpRight aria-hidden="true" /></Link>{event.status === "completed" && event.details.resources.length > 0 && <Link className={styles.archiveLink} href={`/events/${event.slug}#resources`}>Preview event resources</Link>}<details className={styles.details}><summary>Quick preview</summary><div className={styles.preview}><strong>A little more about this moment</strong><p>{event.description ?? `Join ${organization?.name ?? "the community"} for ${event.title}.`}</p><small>Demo event preview. Registration is not available.</small></div></details></div>
          <button type="button" className={styles.save} aria-label={`${isSaved ? "Unsave" : "Save"} ${event.title}`} aria-pressed={isSaved} onClick={onSave ?? (() => setLocalSaved(!localSaved))}><Bookmark size={18} aria-hidden="true" fill={isSaved ? "currentColor" : "none"} /></button>
        </div>}
      </div>
    </article>
  );
}
