import Link from "next/link";
import type { Event } from "@/generated/prisma/client";
import { buttonStyles } from "@/components/ui/button";
import { formatManagedEventDate } from "../timezone";
import { eventTypeLabels } from "../management-schemas";
import styles from "./event-management.module.css";

export function ManagedEventsList({ events, basePath, canManage, createPath }: { events: Event[]; basePath: string; canManage: boolean; createPath: string }) {
  if (!events.length) return <section className={styles.empty}><h2>No events yet.</h2><p>{canManage ? "Your next gathering starts with an idea. Create your first event." : "Events created by your organization will appear here."}</p>{canManage && <Link href={createPath} className={buttonStyles()}>Create event</Link>}</section>;
  return <div className={styles.list}>{events.map((event) => <article className={styles.card} key={event.id}><div><span className={styles.badge}>{event.status}</span><h2>{event.title}</h2><p className={styles.meta}>{formatManagedEventDate(event.startAt, event.timezone)} · {event.timezone} · {eventTypeLabels[event.eventType]}</p><p className={styles.meta}>Updated {formatManagedEventDate(event.updatedAt, event.timezone)} ({event.timezone})</p></div><div className={styles.actions}><Link href={`${basePath}/${event.id}`} className={buttonStyles({ variant: "secondary" })}>{event.status === "PUBLISHED" ? "View event" : "View details"}</Link>{canManage && ["DRAFT", "PUBLISHED"].includes(event.status) && <Link href={`${basePath}/${event.id}/edit`} className={buttonStyles()}>Edit event</Link>}</div></article>)}</div>;
}
