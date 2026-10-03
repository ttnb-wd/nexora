import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { Kpis } from "@/features/analytics/components/analytics-shared";
import { percent } from "@/features/analytics/metrics";
import { loadFeedbackInsights } from "./service";
import { ratingLabels } from "./schemas";
import styles from "@/features/analytics/components/analytics.module.css";
import feedbackStyles from "./post-event.module.css";
export async function FeedbackPage({ eventId, scope, page }: { eventId: string; scope: string | null; page?: unknown }) {
  const user = await requireUser();
  const data = await loadFeedbackInsights(getDb(), user.id, eventId, scope, page);
  if (!data) notFound();
  const path = scope ? `/organizer/${scope}/events/${eventId}` : `/dashboard/events/${eventId}`;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <nav className={styles.navigation} aria-label="Feedback navigation"><Link href={path}>← Back to event management</Link><Link href={`${path}/analytics`}>Event analytics</Link></nav>
    <header className={styles.header}><p className={styles.eyebrow}>PRIVATE ATTENDEE FEEDBACK</p><h1>{data.event.title}</h1><p>{data.event.status === "COMPLETED" ? "Completed event" : "Feedback opens when this event is completed."}</p></header>
    <Kpis items={[{ label: "Responses", value: data.responses }, { label: "Average rating", value: data.averageRating === null ? "Not available" : `${data.averageRating.toFixed(1)} / 5` }, { label: "Attended", value: data.attended }, { label: "Response rate", value: percent(data.responseRate), note: "Responses ÷ attended. Not available when attendance is zero." }]} />
    {!data.responses && <p>No feedback yet. Checked-in attendees can respond on the completed event page.</p>}
    <section className={styles.section}><h2>Rating distribution</h2><div className={styles.tableWrap}><table className={styles.table}><caption>Private attendee responses by rating</caption><thead><tr><th scope="col">Rating</th><th scope="col">Responses</th></tr></thead><tbody>{data.distribution.map(({ rating, count }) => <tr key={rating}><th scope="row">{rating} · {ratingLabels[rating - 1]}</th><td>{count}</td></tr>)}</tbody></table></div></section>
    <section className={styles.section}><h2>Written feedback</h2><p>Comments are anonymous in this view. No attendee identities are displayed.</p>{data.comments.length ? data.comments.map((item, index) => <article key={index} className={styles.section}><h3>Attendee feedback · {item.rating} / 5</h3><p className={feedbackStyles.commentText}>{item.comment}</p></article>) : <p>No written comments yet.</p>}</section>
    {data.pageCount > 1 && <nav className={styles.navigation} aria-label="Feedback comment pages">{data.page > 1 && <Link href={`${path}/feedback?page=${data.page - 1}`}>Previous comments</Link>}<span>Page {data.page} of {data.pageCount}</span>{data.page < data.pageCount && <Link href={`${path}/feedback?page=${data.page + 1}`}>Next comments</Link>}</nav>}
  </Container></main>;
}
