import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { Container } from "@/components/layout/container";
import { getJoinedEvents, getSavedEvents } from "@/features/participation/server/service";
import { getFollowedOrganizations } from "@/features/follows/server/service";
import styles from "@/features/auth/components/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const user = await requireUser();
  const membership = await getDb().organizationMember.findFirst({ where: { userId: user.id }, select: { id: true } });
  const [joined, saved, following] = await Promise.all([getJoinedEvents(), getSavedEvents(), getFollowedOrganizations()]);
  const upcoming = joined.filter((row) => row.registrationStatus === "REGISTERED" && row.eventStatus === "PUBLISHED" && new Date(row.event.startAt) > new Date());
  const attendedCount = joined.filter((row) => row.registrationStatus === "ATTENDED").length;
  return <main id="main-content" tabIndex={-1} className={styles.dashboard}><Container>
    <p className={styles.eyebrow}>YOUR NEXORA</p><h1>Welcome, {user.name}.</h1><p className={styles.intro}>A little space for your next idea and your next connection.</p>
    <div className={styles.dashboardGrid}>
      <section aria-labelledby="upcoming-title"><h2 id="upcoming-title">Upcoming events</h2><p>{upcoming.length ? `${upcoming.length} upcoming joined ${upcoming.length === 1 ? "event" : "events"}.` : "No upcoming joined events yet."}</p>{attendedCount > 0 && <p>Attended events: {attendedCount}</p>}<Link href="/dashboard/joined">View joined events <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <section aria-labelledby="saved-title"><h2 id="saved-title">Saved for later</h2><p>{saved.length ? `${saved.length} saved ${saved.length === 1 ? "event" : "events"}.` : "No saved events yet."}</p><Link href="/dashboard/saved">View saved events <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <section aria-labelledby="following-title"><h2 id="following-title">Following</h2><p>{following.length ? `${following.length} followed ${following.length === 1 ? "organization" : "organizations"}.` : "No followed organizations yet."}</p><Link href="/dashboard/following">View following <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <section aria-labelledby="notifications-title"><h2 id="notifications-title">Notifications</h2><p>Updates from organizations and your event registrations.</p><Link href="/dashboard/notifications">View notifications <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
    </div>
    <p className={styles.intro}><Link href="/dashboard/events">Manage your individual events <ArrowUpRight size={16} aria-hidden="true" /></Link></p>
    {membership && <p className={styles.intro}><Link href="/organizer">Manage your organizations <ArrowUpRight size={16} aria-hidden="true" /></Link></p>}
  </Container></main>;
}
