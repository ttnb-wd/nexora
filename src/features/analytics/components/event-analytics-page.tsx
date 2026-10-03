import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getEventAnalytics } from "../server/queries";
import { percent } from "../metrics";
import { Kpis, RangeLinks, StatusBreakdown, Freshness } from "./analytics-shared";
import { RegistrationTrend } from "./registration-trend";
import { formatManagedEventDate } from "@/features/events/timezone";
import styles from "./analytics.module.css";
export async function EventAnalyticsPage({ eventId, scope, range }: { eventId: string; scope: string | null; range?: unknown }) {
  const data = await getEventAnalytics(eventId,scope,range);
  const path = scope ? `/organizer/${scope}/events/${data.event.id}` : `/dashboard/events/${data.event.id}`;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <nav aria-label="Analytics navigation" className={styles.navigation}><Link href={path}>← Back to event management</Link>{scope ? <Link href={`/organizer/${scope}/analytics`}>Organization analytics</Link> : <Link href="/dashboard/events">Your events</Link>}{["PUBLISHED","COMPLETED"].includes(data.event.status) && <Link href={`/events/${data.event.slug}`}>View public event</Link>}</nav>
    <header className={styles.header}><p className={styles.eyebrow}>PRIVATE EVENT INSIGHTS</p><h1>{data.event.title}</h1><p>{formatManagedEventDate(data.event.startAt,data.event.timezone)} · {data.event.timezone} · {data.event.status}</p></header>
    <Freshness at={data.asOf} />
    {data.totalRegistrations === 0 && <p>No registrations yet. Counts will update as people register, save, and check in.</p>}
    <Kpis items={[
      {label:"Registration records",value:data.totalRegistrations,note:"All current statuses, including cancelled"},
      {label:"Registered",value:data.counts.REGISTERED,note:"Not yet checked in"},
      {label:"Attended",value:data.counts.ATTENDED},
      {label:"Not checked in",value:data.counts.NO_SHOW,note:"Finalized no-show records"},
      {label:"Cancelled registrations",value:data.counts.CANCELLED},
      {label:"Attendance rate",value:percent(data.attendanceRate),note:data.attendanceEligible ? `${data.counts.ATTENDED} attended / ${data.attendanceEligible} eligible` : "No eligible registrations yet"},
      ...(data.event.status === "COMPLETED" ? [
        {label:"Feedback responses",value:data.feedbackResponses},
        {label:"Average feedback rating",value:data.averageRating === null ? "Not available" : `${data.averageRating.toFixed(1)} / 5`},
        {label:"Feedback response rate",value:percent(data.feedbackResponseRate),note:"Responses ÷ attended"},
      ] : []),
      {label:"Capacity",value:data.capacity ?? "Unlimited"},
      {label:"Remaining capacity",value:data.remaining ?? "Unlimited"},
      {label:"Capacity usage",value:data.capacity === null ? "Unlimited" : percent(data.utilization),note:`${data.occupied} occupied seats`},
      {label:"Saved",value:data.saves,note:"Current bookmarks; an interest signal"},
      {label:"Reminders enabled",value:data.reminders,note:"Enabled preferences for currently registered attendees"},
      {label:"Tickets issued",value:data.tickets,note:"Current issued credentials for registered or attended viewers"},
      {label:"Check-ins recorded",value:data.checkIns,note:"Attended records with a check-in timestamp"},
    ]} />
    <StatusBreakdown counts={data.counts} />
    <h2>Registration trend period</h2><RangeLinks range={data.range} path={`${path}/analytics`} label="Registration trend period" /><p className={styles.note}>This filter changes the trend only. Event KPI counts above always show the current lifetime totals.</p>
    {data.trend && <RegistrationTrend trend={data.trend} />}
    {data.event.status === "COMPLETED" && <Link href={`${path}/feedback`}>View private feedback insights</Link>}
    <section className={styles.section}><h2>How to read these metrics</h2><p>Attendance rate = ATTENDED ÷ (REGISTERED + ATTENDED + NO_SHOW). Cancelled and waitlisted records are excluded. No eligible registrations means the rate is not available. Feedback response rate = responses ÷ ATTENDED; zero attended means not available.</p><p>Capacity usage = (REGISTERED + ATTENDED) ÷ capacity. An unlimited event has no percentage. Remaining capacity never falls below zero; usage can exceed 100% if records already exceed the limit.</p><p>Attended and recorded check-ins can differ for older records without check-in timestamps. Reminder counts describe saved preferences, not messages sent. Issued ticket counts do not count page views or regenerated QR images.</p></section>
  </Container></main>;
}
