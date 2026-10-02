import Link from "next/link";
import { requireOrganizationBySlug } from "@/features/auth/server/authorization";
import { updateOrganization } from "@/features/organizations/server/actions";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { Container } from "@/components/layout/container";
import styles from "@/features/organizations/components/organizer.module.css";

export const metadata = { title: "Organization settings" };
export default async function OrganizationSettingsPage({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const { organization } = await requireOrganizationBySlug(organizationSlug, ["OWNER", "ADMIN"]);
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><div className={styles.split}>
    <div className={styles.message}><Link href={`/organizer/${organization.slug}`} className={styles.back}>← Organization overview</Link><p className={styles.eyebrow}>ORGANIZATION SETTINGS</p><h1>Keep your story current.</h1><p className={styles.intro}>Update the details that help people understand {organization.name}.</p><p className={styles.hint}>Your organization URL stays the same.</p></div>
    <OrganizationForm action={updateOrganization.bind(null, organization.slug)} slug={organization.slug} initialValues={organization} />
  </div></Container></main>;
}
