import Link from "next/link";
import { requireOrganizationBySlug } from "@/features/auth/server/authorization";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizer.module.css";

export default async function OrganizationManagementPage({ params, searchParams }: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { organizationSlug } = await params;
  const { organization, membership } = await requireOrganizationBySlug(organizationSlug);
  const canManage = ["OWNER", "ADMIN"].includes(membership.role);
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <Link href="/organizer" className={styles.back}>← Your organizations</Link>
    <p><Link href={`/companies/${organization.slug}`} className={styles.back}>View organization profile →</Link></p>
    <div className={styles.header}><div><p className={styles.eyebrow}>ORGANIZATION OVERVIEW</p><h1>{organization.name}</h1><p className={styles.intro}>{[organization.industry, organization.city, organization.region].filter(Boolean).join(" · ") || "Your organization’s story starts here."}</p><span className={styles.badge}>Your role: {membership.role}</span></div>{canManage && <Link href={`/organizer/${organization.slug}/settings`} className={buttonStyles({ variant: "secondary" })}>Organization settings</Link>}</div>
    {(await searchParams).saved === "1" && <p role="status" className={styles.success}>Organization details saved.</p>}
    <section className={`${styles.card} ${styles.overview}`}><h2>About your organization</h2><p>{organization.description || "Add a description in settings to tell your organization’s story."}</p>{organization.shortName && <p>Short name: {organization.shortName}</p>}{organization.website && <p>Website: <a href={organization.website} target="_blank" rel="noopener noreferrer">{organization.website}</a></p>}<p className={styles.hint}>Organization URL: {organization.slug}</p></section>
    <div className={styles.grid}><section className={styles.card}><h2>Events</h2><p>Manage your organization’s drafts, published gatherings, and cancelled events.</p><Link href={`/organizer/${organization.slug}/events`} className={buttonStyles({ variant: "secondary" })}>View events</Link></section><section className={styles.card}><h2>Members</h2><p>Your role is {membership.role.toLowerCase()}. Invitations and team management are coming later.</p></section><section className={styles.card}><h2>Settings</h2><p>Keep your name, story, and location up to date.</p>{canManage ? <Link href={`/organizer/${organization.slug}/settings`} className={buttonStyles({ variant: "secondary" })}>Edit organization</Link> : <p>Only owners and admins can edit organization details.</p>}</section></div>
  </Container></main>;
}
