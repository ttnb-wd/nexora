import Link from "next/link";
import { requireEventAccess, eventManagementPath } from "@/features/events/server/authorization";
import { Scanner } from "./scanner";
import styles from "./ticket.module.css";
export async function ScannerPage({ eventId, scope }: { eventId: string; scope: string | null }) {
  const { event } = await requireEventAccess(eventId, scope);
  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <Link href={`${eventManagementPath(event)}/attendees`}>← Manage attendees</Link><h1>{event.title}</h1>
    {event.status === "PUBLISHED" && event.endAt > new Date() ? <Scanner eventId={event.id} scope={scope} /> : <p>Ticket check-in is unavailable for this event. Manual attendance remains available under the existing rules.</p>}
  </main>;
}
