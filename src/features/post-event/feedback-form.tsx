"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveEventFeedback } from "./actions";
import { ratingLabels, type ViewerFeedback } from "./schemas";
import styles from "./post-event.module.css";
export function FeedbackForm({ slug, state }: { slug: string; state: ViewerFeedback }) {
  const [result, action, pending] = useActionState(saveEventFeedback.bind(null, slug), {});
  if (state.noShow) return <p>Not checked in. You can still explore this event’s public resources. Feedback is available to checked-in attendees.</p>;
  if (!state.eligible) return null;
  return <form action={action} className={styles.form} aria-busy={pending}>
    <h3>{state.feedback || result.ok ? "Thanks for your feedback" : "Share feedback"}</h3>
    <p>Your feedback is private to this event’s organizers. You can update your response here.</p>
    <fieldset disabled={pending}><legend>How was this event? Choose a rating from 1 to 5.</legend><div className={styles.ratings}>{ratingLabels.map((label, index) => <label key={label}><input type="radio" name="rating" value={index + 1} required defaultChecked={state.feedback?.rating === index + 1} /><span>{index + 1} · {label}</span></label>)}</div></fieldset>
    <label className={styles.comment}>Comment (optional, up to 1000 characters)<textarea name="comment" maxLength={1000} rows={5} defaultValue={state.feedback?.comment ?? ""} disabled={pending} /></label>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : state.feedback || result.ok ? "Update feedback" : "Submit feedback"}</Button>
    {result.message && <p role="status" aria-live="polite">{result.message}</p>}
  </form>;
}
