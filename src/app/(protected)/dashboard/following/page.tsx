import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getFollowedOrganizations } from "@/features/follows/server/service";
import { OrganizationCard } from "@/features/organizations/components/organization-card";
import styles from "@/features/events/components/event-management.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Following", robots: { index: false, follow: false } };
export default async function FollowingPage() {
  const organizations = await getFollowedOrganizations();
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href="/dashboard" className={styles.back}>Dashboard</Link><div className={styles.header}><div><p className={styles.eyebrow}>YOUR NEXORA</p><h1>Organizations you follow.</h1><p>Stay connected with their next gathering.</p></div></div><div className={styles.grid}>{organizations.length ? organizations.map((organization) => <OrganizationCard key={organization.slug} organization={organization} actionLabel="View organization" />) : <section className={styles.card}><h2>No followed organizations yet.</h2><Link href="/companies">Discover organizations</Link></section>}</div></Container></main>;
}
