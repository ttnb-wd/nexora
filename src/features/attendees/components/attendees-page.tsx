import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Button, buttonStyles } from "@/components/ui/button";
import { requireEventAccess, eventManagementPath } from "@/features/events/server/authorization";
import { getDb } from "@/lib/db";
import { formatManagedEventDate } from "@/features/events/timezone";
import { loadManagedAttendees } from "../server/service";
import { checkInAttendee, undoAttendeeCheckIn } from "../server/actions";
import { attendanceEditable, attendeeQuerySchema, attendeeStatuses, registrationStatusLabels } from "../schemas";
import { AttendeeActionForm } from "./attendee-action-form";
import managed from "@/features/events/components/event-management.module.css";
import styles from "./attendees.module.css";

export type AttendeeSearchParams = { [key: string]: string | string[] | undefined };
export async function AttendeesPage({ eventId, scope, searchParams }: { eventId: string; scope: string | null; searchParams: AttendeeSearchParams }) {
  const { user, event } = await requireEventAccess(eventId, scope);
  const parsed = attendeeQuerySchema.safeParse({ q: searchParams.q ?? "", status: searchParams.status ?? "ALL", page: searchParams.page ?? 1 });
  const query = parsed.success ? parsed.data : attendeeQuerySchema.parse({});
  const data = await loadManagedAttendees(getDb(), user.id, event.id, scope, query);
  if (!data) notFound();
  const path = eventManagementPath(event);
  const editable = attendanceEditable(data.event.status);
  const pageLink = (page: number) => `${path}/attendees?${new URLSearchParams({ q: query.q, status: query.status, page: String(page) })}`;
  const metrics = [["Registered", data.counts.REGISTERED], ["Attended", data.counts.ATTENDED], ["Cancelled", data.counts.CANCELLED], ["Waitlisted", data.counts.WAITLISTED], ["Capacity", data.event.capacity ?? "Unlimited"], ["Remaining spots", data.remaining ?? "Unlimited"]];
  return <main id="main-content" tabIndex={-1} className={`${managed.page} ${styles.page}`}><Container>
    <Link href={path} className={managed.back}>← Manage event</Link><p className={managed.eyebrow}>ATTENDEE MANAGEMENT</p><h1>{data.event.title}</h1><p className={managed.intro}>Search registrations and manage attendance. Times use {data.event.timezone}.</p>
    <dl className={styles.summary}>{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className={managed.hint}>Registered and attended attendees occupy capacity. Cancelled, waitlisted, and no-show registrations do not.</p>
    {!editable && <p className={managed.note}>Attendance is read-only for {data.event.status.toLowerCase()} events.</p>}
    <form method="get" action={`${path}/attendees`} className={styles.filters} aria-label="Attendee search and filters">
      <div><label htmlFor="attendee-search">Search attendee name</label><input id="attendee-search" name="q" type="search" defaultValue={query.q} maxLength={200} /></div>
      <div><label htmlFor="attendee-status">Registration status</label><select id="attendee-status" name="status" defaultValue={query.status}>{attendeeStatuses.map(status => <option key={status} value={status}>{status === "ALL" ? "All" : registrationStatusLabels[status]}</option>)}</select></div>
      <Button type="submit">Apply filters</Button><Link href={`${path}/attendees`} className={buttonStyles({ variant: "ghost" })}>Clear filters</Link>
    </form>
    {!parsed.success && <p role="status" className={managed.hint}>Invalid filters were reset. Please search again.</p>}
    <p className={managed.hint}>{data.total} matching {data.total === 1 ? "registration" : "registrations"}. Summary counts include every registration for this event.</p>
    {data.records.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Attendee registration table"><table className={styles.table}><caption>Attendees for {data.event.title}</caption><thead><tr><th scope="col">Attendee</th><th scope="col">Status</th><th scope="col">Registered on</th><th scope="col">Check-in</th><th scope="col">Actions</th></tr></thead><tbody>{data.records.map(registration => <tr key={registration.id}><th scope="row">{registration.user.name}</th><td>{registrationStatusLabels[registration.status]}</td><td><time dateTime={registration.createdAt.toISOString()}>{formatManagedEventDate(registration.createdAt, data.event.timezone)}</time></td><td>{registration.checkedInAt ? <time dateTime={registration.checkedInAt.toISOString()}>{formatManagedEventDate(registration.checkedInAt, data.event.timezone)}</time> : registration.status === "ATTENDED" ? "Attended · time not recorded" : "Not checked in"}</td><td>{editable && ["REGISTERED", "ATTENDED"].includes(registration.status) ? <AttendeeActionForm key={`${registration.id}-${registration.status}`} registrationId={registration.id} name={registration.user.name} undo={registration.status === "ATTENDED"} action={(registration.status === "ATTENDED" ? undoAttendeeCheckIn : checkInAttendee).bind(null, event.id, scope)} /> : <span className={managed.hint}>{editable ? "No attendance action available" : "Read-only"}</span>}</td></tr>)}</tbody></table></div> : <section className={managed.card}><h2>No matching attendees</h2><p>{query.q || query.status !== "ALL" ? "Try another name or status filter." : "Registrations will appear here when people join this event."}</p></section>}
    {data.pageCount > 1 && <nav aria-label="Attendee pages" className={styles.pagination}>{data.page > 1 && <Link href={pageLink(data.page - 1)}>Previous page</Link>}<span>Page {data.page} of {data.pageCount}</span>{data.page < data.pageCount && <Link href={pageLink(data.page + 1)}>Next page</Link>}</nav>}
    <p className={managed.hint}>Attendee names are private to authorized event managers. Email addresses are not shown. No-show changes are reserved for a later step.</p>
  </Container></main>;
}
