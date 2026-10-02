import Link from "next/link";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { requireOrganizationBySlug } from "@/features/auth/server/authorization";
import { eventManagerRoles } from "@/features/events/server/authorization";
import { ManagedEventsList } from "@/features/events/components/managed-events-list";
import styles from "@/features/events/components/event-management.module.css";
export const metadata = { title: "Organization events" };
export default async function OrganizationEventsPage({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { organization, membership } = await requireOrganizationBySlug(organizationSlug);
  const canManage = eventManagerRoles.some((role) => role === membership.role);
  const events = await getDb().event.findMany({ where: { organizationId: organization.id }, orderBy: { updatedAt: "desc" } });
  const basePath = `/organizer/${organization.slug}/events`;
  const createPath = `/create-event?organization=${organization.id}`;
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><Link href={`/organizer/${organization.slug}`} className={styles.back}>← Organization overview</Link><div className={styles.header}><div><p className={styles.eyebrow}>{organization.name}</p><h1>Your organization’s events.</h1><p className={styles.intro}>Drafts, published gatherings, and cancelled events in one place.</p></div>{canManage && <Link href={createPath} className={buttonStyles()}>Create event</Link>}</div><ManagedEventsList events={events} basePath={basePath} canManage={canManage} createPath={createPath} /></Container></main>;
}
