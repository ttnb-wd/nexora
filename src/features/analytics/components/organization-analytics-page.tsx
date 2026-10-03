import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getOrganizationAnalytics } from "../server/queries";
import { percent } from "../metrics";
import { Kpis, RangeLinks, Freshness } from "./analytics-shared";
import { formatManagedEventDate } from "@/features/events/timezone";
import styles from "./analytics.module.css";
export async function OrganizationAnalyticsPage({ slug, range }: { slug: string; range?: unknown }) {
  const data = await getOrganizationAnalytics(slug,range);
  const path = `/organizer/${data.organization.slug}`;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <nav aria-label="Analytics navigation" className={styles.navigation}><Link href={path}>← Back to organization management</Link><Link href="/organizer">Your organizations</Link><Link href={`${path}/events`}>Manage events</Link></nav>
    <header className={styles.header}><p className={styles.eyebrow}>PRIVATE ORGANIZATION INSIGHTS</p><h1>{data.organization.name}</h1><p>Operational results across this organization’s published and completed events.</p></header>
    <RangeLinks range={data.range} path={`${path}/analytics`} label="Event date range" /><p className={styles.note}>Last 30/90 days selects event start times in the rolling period ending now. All time includes future events. Registrations and saves are current totals for the selected events; followers are the current organization-wide count.</p><Freshness at={data.asOf} />
    {!data.published && <p>No published or completed events in this range. Publish an event or try All time.</p>}
    <Kpis items={[
      {label:"Published events",value:data.published,note:"PUBLISHED and COMPLETED records"},
      {label:"Upcoming events",value:data.upcoming,note:"Published events that have not started"},
      {label:"Completed events",value:data.completed,note:"Completed status or published events that have ended"},
      {label:"Registration records",value:data.totalRegistrations,note:"All current statuses for selected events"},
      {label:"Attended",value:data.counts.ATTENDED},
      {label:"Average attendance rate",value:percent(data.averageAttendanceRate),note:"Mean of completed-event rates with eligible registrations"},
      {label:"Saved across events",value:data.saves},
      {label:"Current followers",value:data.followers},
    ]} />
    <section className={styles.section}><h2>Recent event performance</h2><p className={styles.note}>Up to 10 most recently scheduled events in this range. A person registering for two events contributes two registration records.</p>
      {data.recent.length ? <div className={styles.tableWrap} role="region" aria-label="Recent event performance" tabIndex={0}><table className={styles.table}><caption>Published and completed events belonging to {data.organization.name}</caption><thead><tr><th scope="col">Event</th><th scope="col">Date</th><th scope="col">Registrations</th><th scope="col">Attended</th><th scope="col">Attendance rate</th><th scope="col">Capacity usage</th><th scope="col">Status</th></tr></thead><tbody>{data.recent.map(row=><tr key={row.event.id}><th scope="row"><Link href={`${path}/events/${row.event.id}/analytics`}>{row.event.title}</Link></th><td>{formatManagedEventDate(row.event.startAt,row.event.timezone)}<br />{row.event.timezone}</td><td>{row.totalRegistrations}</td><td>{row.counts.ATTENDED}</td><td>{percent(row.attendanceRate)}</td><td>{row.capacity === null ? "Unlimited" : `${percent(row.utilization)} · ${row.occupied}/${row.capacity}`}</td><td>{row.event.status}</td></tr>)}</tbody></table></div> : <p>Event performance will appear here when this range contains a published or completed event.</p>}
      <p className={styles.note}>{data.recentFollowerRegistrants} current followers have a registered or attended place in these recent events. This is a distinct follower count, not a conversion rate.</p>
    </section>
    <section className={styles.section}><h2>Scope and definitions</h2><p>Draft, cancelled, and archived events are excluded. Published events include completed records; upcoming means start time is in the future, and completed means COMPLETED status or end time has passed.</p><p>Attendance rate = ATTENDED ÷ (REGISTERED + ATTENDED + NO_SHOW). The average gives each completed event equal weight and excludes events with no eligible registrations. Capacity usage includes registered and attended seats only. Cancelled registrations remain in the total record count, but never in occupied seats.</p></section>
  </Container></main>;
}
