"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AttendeeActionState } from "../schemas";
import styles from "./attendees.module.css";

export function AttendeeActionForm({ action, registrationId, name, undo = false }: { action: (previous: AttendeeActionState, form: FormData) => Promise<AttendeeActionState>; registrationId: string; name: string; undo?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className={styles.action} aria-busy={pending}>
    <input type="hidden" name="registrationId" value={registrationId} />
    {undo && <label className={styles.confirm}><input type="checkbox" name="confirm" value="yes" required disabled={pending} />Confirm undo for {name}</label>}
    <Button type="submit" size="sm" variant={undo ? "outline" : "primary"} disabled={pending} aria-label={`${undo ? "Undo check-in for" : "Check in"} ${name}`}>{pending ? "Saving…" : undo ? "Undo check-in" : "Check in"}</Button>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? styles.message : styles.error}>{state.message}</p>}
  </form>;
}
