import Link from "next/link";
import { EventCard } from "@/components/event/event-card";
import { getRecommendedEventsForUser } from "../server/queries";
import styles from "./recommendations.module.css";

export async function RecommendationSection({ compact = false }: { compact?: boolean }) {
  let recommendations;
  try { recommendations = await getRecommendedEventsForUser(); }
  catch { return null; }
  if (!recommendations) return null;
  const personalized = recommendations.mode === "personalized";
  const title = recommendations.unavailable || personalized ? "Recommended for you" : "Upcoming events to explore";
  return <section className={`${styles.section} ${compact ? styles.compact : ""}`} aria-labelledby="recommendations-title" data-recommendations>
    <header className={styles.heading}><div><p className={styles.eyebrow}>YOUR NEXT MOMENT</p><h2 id="recommendations-title">{title}</h2><p>{personalized ? "From organizations you follow and events you save, join, or attend." : "Upcoming events you can still join. Save events or follow organizations to tailor future picks."}</p></div><Link href="/explore">Explore events →</Link></header>
    {recommendations.unavailable ? <p role="status">Recommendations are temporarily unavailable. Please try again shortly.</p> : recommendations.results.length ? <div className={styles.grid}>{recommendations.results.slice(0, compact ? 3 : 6).map(({ event, reason }) => <div key={event.slug} className={styles.result}><p className={styles.reason}>{reason}</p><EventCard event={event} variant={compact ? "compact" : "standard"} /></div>)}</div>
      : <p>No new events you can join right now. Explore the calendar or check your <Link href="/dashboard/joined">joined</Link> and <Link href="/dashboard/saved">saved</Link> events.</p>}
  </section>;
}
