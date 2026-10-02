import Link from "next/link";
import { getOrganizationById } from "@/features/organizations/organization-helpers";
import { ArrowLeft, CalendarDays, Clock3, MapPin } from "lucide-react";
import { EventArtwork } from "./event-artwork";
import { EventActionButtons, type EventInteractionProps } from "./event-action-buttons";
import { formatEventDate } from "../event-helpers";
import styles from "./event-detail.module.css";
export function EventDetailHero(props: EventInteractionProps) {
  const { event, joined } = props;
  const organization = getOrganizationById(event.organizationId);
  return <header className={styles.hero}>
    <Link href="/explore" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to discovery</Link>
    <div className={styles.heroGrid}><div className={styles.heroCopy}>
      <div className={styles.heroLabels}><span>{event.category}</span><span>{event.type}</span>{event.status === "completed" && <span>Completed event</span>}</div>
      <h1>{event.title}</h1><p className={styles.lead}>{event.description}</p>
      <div className={styles.heroMeta}><p><CalendarDays aria-hidden="true" /><time dateTime={event.date}>{formatEventDate(event.date)}</time></p><p><Clock3 aria-hidden="true" />{event.time}</p><p><MapPin aria-hidden="true" />{event.location.venue} · {event.location.city}</p></div>
      <p className={styles.byline}>An experience by {organization && <Link href={`/companies/${organization.slug}`}>{organization.name}</Link>}</p>
      <EventActionButtons {...props} />
      <p className={styles.confirmation} id="join-status" role="status" aria-live="polite" aria-atomic="true">{joined ? "Joined in this demo. No registration was created. Click Joined to undo." : event.status === "completed" ? "This event has ended. Explore the resource previews below." : "Demo experience · joining and saving stay on this page."}</p>
    </div><div className={styles.heroVisual}><EventArtwork event={event} size="hero" className={styles.cover} /><div className={styles.visualFoot}><span>COME CURIOUS. LEAVE INSPIRED.</span><span>NEXORA / {event.category.toUpperCase()}</span></div></div></div>
  </header>;
}
