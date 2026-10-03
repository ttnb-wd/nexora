"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEventReminder, disableEventReminder } from "../reminders/actions";
import { reminderLabels, reminderMinutes, type ReminderState } from "../reminders/schemas";
import styles from "./calendar-controls.module.css";
export function CalendarControl({ links, title }: { links: { google: string; ics: string }; title: string }) {
  return <details className={styles.calendar}><summary aria-label={`Add to calendar: ${title}`}>Add to calendar</summary>
    <div className={styles.options}><a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar <span className={styles.note}>(opens a new tab)</span></a>
      <a href={links.ics} download>Download .ics</a></div>
  </details>;
}
export function ReminderControl({ slug, state }: { slug: string; state: ReminderState }) {
  const id = useId(), router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (!state.eligible) return null;
  function change(value: string) {
    startTransition(async () => {
      try {
        const result = await (value === "off" ? disableEventReminder(slug) : setEventReminder(slug, Number(value)));
        setMessage(result.message); if (result.ok) router.refresh();
      } catch { setMessage("We could not save your reminder. Please try again."); }
    });
  }
  return <div className={styles.reminder}><label htmlFor={id}>Reminder preference</label>
    <select id={id} disabled={pending} value={state.enabled ? String(state.reminderMinutes) : "off"} onChange={(event) => change(event.target.value)}>
      <option value="off">Off</option>{reminderMinutes.map((minutes) => <option key={minutes} value={minutes}>{reminderLabels[minutes]}</option>)}
    </select><p className={styles.note}>Receive an in-app notification before this event starts.</p>
    <p role="status" aria-live="polite" className={styles.note}>{pending ? "Saving reminder…" : message}</p>
  </div>;
}
