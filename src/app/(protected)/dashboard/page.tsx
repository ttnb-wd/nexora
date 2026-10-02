import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/features/auth/server/session";
import { Container } from "@/components/layout/container";
import styles from "@/features/auth/components/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const user = await requireUser();
  return <main id="main-content" tabIndex={-1} className={styles.dashboard}><Container>
    <p className={styles.eyebrow}>YOUR NEXORA</p><h1>Welcome, {user.name}.</h1><p className={styles.intro}>A little space for your next idea and your next connection.</p>
    <div className={styles.dashboardGrid}>
      <section aria-labelledby="upcoming-title"><h2 id="upcoming-title">Upcoming events</h2><p>Your personal event collection will take shape here in a future step.</p><Link href="/explore">Discover events <ArrowUpRight size={16} aria-hidden="true" /></Link></section>
      <section aria-labelledby="saved-title"><h2 id="saved-title">Saved for later</h2><p>A place for the experiences that catch your curiosity. Saved events are still a local preview.</p></section>
    </div>
  </Container></main>;
}
