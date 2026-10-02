import { Container } from "@/components/layout/container";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { eventManagerRoles } from "@/features/events/server/authorization";
import { createEvent } from "@/features/events/server/actions";
import { EventWizard } from "@/features/events/components/event-wizard";
import { emptyEventValues } from "@/features/events/management-schemas";
import styles from "@/features/events/components/event-management.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an event", robots: { index: false, follow: false } };

export default async function CreateEventPage({ searchParams }: { searchParams: Promise<{ organization?: string }> }) {
  const user = await requireUser();
  const memberships = await getDb().organizationMember.findMany({ where: { userId: user.id, role: { in: [...eventManagerRoles] } }, include: { organization: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
  const organizations = memberships.map((membership) => membership.organization);
  const requestedOrganization = (await searchParams).organization;
  const organizationId = organizations.find((organization) => organization.id === requestedOrganization)?.id ?? "";
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><p className={styles.eyebrow}>NEXORA ORGANIZER</p><h1>Bring your next gathering to life.</h1><p className={styles.intro}>A story, a time, a place. Start shaping the experience.</p><EventWizard action={createEvent} organizations={organizations} individualName={user.name} initialValues={{ ...emptyEventValues, organizationId }} returnPath="/dashboard/events" /></Container></main>;
}
