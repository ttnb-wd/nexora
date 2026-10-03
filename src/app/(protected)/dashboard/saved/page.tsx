import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getSavedEvents } from "@/features/participation/server/service";
import { PersonalEventList } from "@/features/participation/components/personal-event-list";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Saved events", robots: { index: false, follow: false } };
export default async function PersonalEventsPage() {
  const rows = await getSavedEvents();
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR NEXORA</p><h1>Your saved events.</h1><p className={styles.intro}>The events you bookmarked, saved to your account.</p></div><Link href="/dashboard/joined">Joined events</Link></div><PersonalEventList rows={rows} saved /></Container></main>;
}
