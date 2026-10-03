import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getJoinedEvents } from "@/features/participation/server/service";
import { PersonalEventList } from "@/features/participation/components/personal-event-list";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Joined events", robots: { index: false, follow: false } };
export default async function PersonalEventsPage() {
  const rows = await getJoinedEvents();
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR NEXORA</p><h1>Your joined events.</h1><p className={styles.intro}>Upcoming registrations and your event history.</p></div><Link href="/dashboard/saved">Saved events</Link></div><PersonalEventList rows={rows}  /></Container></main>;
}
