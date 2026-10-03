"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { EventActionState } from "../management-schemas";
import styles from "./event-management.module.css";
export function EventTransitionForm({ action, kind }: { action: (state: EventActionState, data: FormData) => Promise<EventActionState>; kind: "publish" | "cancel" | "complete" }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className={styles.transition} aria-busy={pending}>
    <h2>{kind === "complete" ? "Mark as completed" : kind === "publish" ? "Publish this draft" : "Cancel this event"}</h2><p>{kind === "complete" ? "Finalize attendance: attendees who were not checked in become no-shows. Attendance will be read-only; resources remain available." : kind === "publish" ? "Publishing makes this event publicly accessible. Upcoming events appear on Explore." : "Cancellation removes this event from public discovery and makes it read-only. It cannot be republished in this step."}</p>
    <label className={styles.confirm}><input type="checkbox" name="confirm" value="yes" required disabled={pending} />{kind === "complete" ? "I have reviewed check-ins and confirm completion." : kind === "publish" ? "I’ve reviewed the details and confirm publication." : "I understand and confirm cancellation."}</label>
    {state.message && <p className={styles.error} role="alert">{state.message}</p>}
    <div className={styles.actions}><Button type="submit" variant={kind === "cancel" ? "destructive" : "primary"} disabled={pending}>{pending ? "Saving…" : kind === "complete" ? "Mark as completed" : kind === "publish" ? "Publish event" : "Cancel event"}</Button></div>
  </form>;
}
