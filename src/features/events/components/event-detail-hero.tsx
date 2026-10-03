import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin } from "lucide-react";
import { EventArtwork } from "./event-artwork";
import { EventActionButtons, type EventInteractionProps } from "./event-action-buttons";
import { formatEventDate } from "../event-helpers";
import styles from "./event-detail.module.css";
export function EventDetailHero(props: EventInteractionProps) {
  const { event, joined, message, availability } = props;
  const organization = event.organizer;
  const organizerLink = organization?.slug ? `/companies/${organization.slug}` : null;
  return <header className={styles.hero}>
    <Link href="/explore" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to discovery</Link>
    <div className={styles.heroGrid}><div className={styles.heroCopy}>
      <div className={styles.heroLabels}><span>{event.category}</span><span>{event.type}</span>{event.status === "completed" && <span>Completed event</span>}</div>
      <h1>{event.title}</h1><p className={styles.lead}>{event.description}</p>
      <div className={styles.heroMeta}><p><CalendarDays aria-hidden="true" /><time dateTime={event.date}>{formatEventDate(event.date)}</time></p><p><Clock3 aria-hidden="true" />{event.time}</p><p><MapPin aria-hidden="true" />{event.location.venue} · {event.location.city}</p></div>
      <p className={styles.byline}>An experience by {organizerLink ? <Link href={organizerLink}>{organization?.name}</Link> : <strong>{organization?.name ?? "Nexora community"}</strong>}</p>
      <EventActionButtons {...props} />
      <p className={styles.confirmation} id="join-status" role="status" aria-live="polite" aria-atomic="true">{message || (joined ? "Your registration is saved. You can cancel it below." : availability.closedReason ?? "Join this event or save it for later.") }</p>
    </div><div className={styles.heroVisual}><EventArtwork event={event} size="hero" className={styles.cover} /><div className={styles.visualFoot}><span>COME CURIOUS. LEAVE INSPIRED.</span><span>NEXORA / {event.category.toUpperCase()}</span></div></div></div>
  </header>;
}
