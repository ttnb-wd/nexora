"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventCard } from "@/components/event/event-card";
import { cancelEventRegistration, unsaveEvent } from "../server/actions";
import type { PublicEvent } from "@/features/events/types";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/events/components/event-management.module.css";
import { registrationStatusLabels } from "@/features/attendees/schemas";
import { CalendarControl } from "@/features/events/calendar/calendar-controls";
import { reminderLabels, type ReminderState } from "@/features/events/reminders/schemas";
type Row = { event: PublicEvent; registrationStatus?: string; eventStatus: string; publicVisible: boolean; reminder?: ReminderState };
function PersonalEvent({ row, saved }: { row: Row; saved: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  const active = row.registrationStatus === "REGISTERED";
  function remove() {
    startTransition(async () => {
      try {
        const result = await (saved ? unsaveEvent(row.event.slug) : cancelEventRegistration(row.event.slug));
        if (result.signIn) { router.push(result.signIn); return; }
        setMessage(result.message); router.refresh();
      } catch { setMessage("We could not update this event. Please try again."); }
    });
  }
  return <section className={`${styles.card} ${styles.personalCard}`} aria-label={row.event.title}>
    {row.publicVisible ? <EventCard event={row.event} variant="compact" /> : <><h2>{row.event.title}</h2><p>{row.event.date} · {row.event.time}</p><p>{row.event.organizer.name} · {row.event.location.city} · {row.event.type}</p></>}
    <p>{row.eventStatus === "CANCELLED" ? "Event cancelled by the organizer" : row.eventStatus === "ARCHIVED" ? "Event archived" : row.eventStatus === "DRAFT" ? "Event no longer publicly available" : row.event.status === "completed" ? "Event completed" : "Upcoming event"}</p>
    {!saved && <p>Registration: {registrationStatusLabels[row.registrationStatus as keyof typeof registrationStatusLabels] ?? row.registrationStatus}</p>}
    {!saved && ((active && row.eventStatus === "PUBLISHED" && row.event.status !== "completed") || (row.registrationStatus === "ATTENDED" && row.publicVisible)) && <Link href={`/dashboard/joined/${row.event.slug}/ticket`} className={buttonStyles({ variant: "secondary" })}>View ticket</Link>}
    {!saved && row.registrationStatus === "ATTENDED" && <p>Checked in</p>}
    {!saved && active && row.event.calendar && <CalendarControl links={row.event.calendar} title={row.event.title} />}
    {!saved && row.reminder?.eligible && <p>Reminder preference: {row.reminder.enabled ? reminderLabels[row.reminder.reminderMinutes as keyof typeof reminderLabels] : "Off"} · <Link href={`/events/${row.event.slug}`}>Change reminder</Link></p>}
    {(saved || active) && <button type="button" className={buttonStyles({ variant: "secondary" })} disabled={pending} onClick={remove}>{saved ? "Unsave" : "Cancel registration"}</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
export function PersonalEventList({ rows, saved = false }: { rows: Row[]; saved?: boolean }) {
  return rows.length ? <div className={styles.grid}>{rows.map((row) => <PersonalEvent key={row.event.slug} row={row} saved={saved} />)}</div> : <section className={styles.card}><h2>{saved ? "No saved events yet." : "No joined events yet."}</h2><p>Find your next connection.</p><Link href="/explore">Discover events</Link></section>;
}
