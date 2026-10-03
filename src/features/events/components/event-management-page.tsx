import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import { requireEventAccess, eventManagerRoles, eventManagementPath } from "../server/authorization";
import { publishEvent, cancelEvent } from "../server/actions";
import { eventTypeLabels } from "../management-schemas";
import { formatManagedEventDate } from "../timezone";
import { EventTransitionForm } from "./event-transition-form";
import { getEventRegistrationCount } from "@/features/participation/server/service";
import styles from "./event-management.module.css";
import { EventContentManagement } from "./event-content-management";

export async function EventManagementPage({ eventId, scope }: { eventId: string; scope: string | null }) {
  const { event, user } = await requireEventAccess(eventId, scope, false);
  const canManage = event.organization === null || event.organization.members.some((membership) => eventManagerRoles.some((role) => role === membership.role));
  const registrationCount = await getEventRegistrationCount(eventId, scope);
  const path = eventManagementPath(event);
  const listPath = scope ? `/organizer/${scope}/events` : "/dashboard/events";
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <Link href={listPath} className={styles.back}>← Your events</Link><div className={styles.header}><div><p className={styles.eyebrow}>EVENT MANAGEMENT</p><h1>{event.title}</h1><p className={styles.intro}>{event.organization?.name ?? user.name} · {eventTypeLabels[event.eventType]}</p><span className={styles.badge}>{event.status}</span></div>{canManage && ["DRAFT", "PUBLISHED"].includes(event.status) && <Link href={`${path}/edit`} className={buttonStyles()}>Edit event</Link>}</div>
    <div className={styles.overview}><article className={styles.preview}><div className={styles.artwork}><p>{event.category || "Uncategorized"}</p><h2>{event.title}</h2><span>{eventTypeLabels[event.eventType]}</span></div><div className={styles.previewBody}><p>{formatManagedEventDate(event.startAt, event.timezone)} – {formatManagedEventDate(event.endAt, event.timezone)}</p><p className={styles.hint}>Timezone: {event.timezone}</p><p>{event.eventType === "ONLINE" ? "Online" : [event.locationName, event.city, event.region].filter(Boolean).join(", ")}{event.eventType === "HYBRID" && " + online"}</p>{event.onlineUrl && <p><a href={event.onlineUrl} target="_blank" rel="noopener noreferrer">Open online event link</a></p>}{event.shortDescription && <p className={styles.lead}>{event.shortDescription}</p>}<p className={styles.description}>{event.description || "No description added."}</p></div></article><aside>
      <section className={styles.card}><h2>Registration details</h2><p>{event.capacity ? `Capacity: ${event.capacity}` : "No capacity limit specified"}</p>{event.registrationDeadline && <p>Closes {formatManagedEventDate(event.registrationDeadline, event.timezone)} ({event.timezone})</p>}<p className={styles.hint}>Registrations: {registrationCount}</p></section>
      {canManage && event.status === "DRAFT" && <EventTransitionForm action={publishEvent.bind(null, event.id, scope)} kind="publish" />}
      {canManage && event.status === "PUBLISHED" && <EventTransitionForm action={cancelEvent.bind(null, event.id, scope)} kind="cancel" />}
      {!["DRAFT", "PUBLISHED"].includes(event.status) && <p className={styles.note}>{event.status === "COMPLETED" ? "Agenda and speakers are read-only. Authorized organizers can still publish resources." : "This event is read-only. Cancelled events cannot be republished."}</p>}
      {!canManage && <p className={styles.note}>Only owners, admins, and editors can manage this organization’s events.</p>}
      <p className={styles.hint}>{["PUBLISHED", "COMPLETED"].includes(event.status) ? <Link href={`/events/${event.slug}`}>View public event</Link> : "This event is not publicly accessible."}</p>
    </aside></div><EventContentManagement event={event} scope={scope} canManage={canManage} />
  </Container></main>;
}
