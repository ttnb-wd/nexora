import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { ManagedEventsList } from "@/features/events/components/managed-events-list";
import styles from "@/features/events/components/event-management.module.css";
export default async function IndividualEventsPage() {
  const user = await requireUser();
  const events = await getDb().event.findMany({ where: { creatorId: user.id, organizationId: null }, orderBy: { updatedAt: "desc" } });
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>← Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR GATHERINGS</p><h1>Your individual events.</h1><p className={styles.intro}>Manage the events you’re organizing yourself. Find your organization’s events in <Link href="/organizer">Organizer</Link>.</p></div><Link href="/create-event" className={buttonStyles()}>Create event</Link></div><ManagedEventsList events={events} basePath="/dashboard/events" canManage createPath="/create-event" /></Container></main>;
}
