import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getUserNotifications } from "@/features/notifications/server/queries";
import { NotificationList } from "@/features/notifications/components/notification-list";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications", robots: { index: false, follow: false } };
export default async function NotificationsPage() {
  const notifications = await getUserNotifications();
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR NEXORA</p><h1>Your notifications.</h1><p>Recent activity from your connections and registrations.</p></div></div><NotificationList notifications={notifications} /></Container></main>;
}
