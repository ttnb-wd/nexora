"use client";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, Radio, Check } from "lucide-react";
import { EventActionButtons, type EventInteractionProps } from "./event-action-buttons";
import { formatEventDate } from "../event-helpers";
import styles from "./event-detail.module.css";
import { CalendarControl, ReminderControl } from "../calendar/calendar-controls";
import type { ReminderState } from "../reminders/schemas";
export function EventRegistrationPanel(props: EventInteractionProps & { reminder: ReminderState }) {
  const { event, joined, attended, availability, message } = props;
  const reduced = useReducedMotion();
  return <aside className={styles.registration} aria-labelledby="registration-title"><motion.div className={styles.registrationCard} whileHover={reduced === false ? { y: -2 } : undefined} transition={{ duration: .2 }}>
    <p className={styles.eyebrow}>YOUR NEXT MOMENT</p><h2 id="registration-title">{event.status === "completed" ? "A moment worth revisiting." : "Make room for something new."}</h2>
    <dl className={styles.facts}>
      <div><dt><CalendarDays aria-hidden="true" />Date</dt><dd><time dateTime={event.date}>{formatEventDate(event.date)}</time></dd></div>
      <div><dt><Clock3 aria-hidden="true" />Time</dt><dd>{event.time}</dd></div>
      <div><dt><MapPin aria-hidden="true" />Location</dt><dd>{event.location.venue}<br />{event.location.city}</dd></div>
      <div><dt><Radio aria-hidden="true" />Event type</dt><dd>{event.type}</dd></div>
    </dl>
    <p className={styles.availability}><Check size={15} aria-hidden="true" />{attended ? "You attended this event" : joined ? `You are registered${availability.spotsLeft === null ? "" : ` · ${availability.spotsLeft} spots left`}` : availability.closedReason ?? (availability.spotsLeft === null ? "Registration open" : `${availability.spotsLeft} spots left`)}</p>
    <EventActionButtons {...props} /><p className={styles.panelNote}>{message || "Manage your registration and saved events in your dashboard."}</p>
    {joined && !attended && event.status !== "completed" && <Link href={`/dashboard/joined/${event.slug}/ticket`}>View ticket</Link>}
    {event.calendar && (!joined || event.status === "completed") && <CalendarControl links={event.calendar} title={event.title} />}
    <ReminderControl slug={event.slug} state={props.reminder} />
  </motion.div><p className={styles.panelCaption}>Great things happen when we show up.</p></aside>;
}
