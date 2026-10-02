import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireUser } from "@/features/auth/server/session";
import { createOrganization } from "@/features/organizations/server/actions";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { Container } from "@/components/layout/container";
import styles from "@/features/organizations/components/organizer.module.css";

export const metadata = { title: "Create organization" };
export default async function CreateOrganizationPage() {
  await requireUser();
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container><div className={styles.split}>
    <div className={styles.message}><Link href="/organizer" className={styles.back}>← Your organizations</Link><p className={styles.eyebrow}>BUILD SOMETHING TOGETHER</p><Building2 size={40} aria-hidden="true" /><h1>A home for your next big idea.</h1><p className={styles.intro}>Create your organization, tell its story, and give your community a place to grow.</p><p className={styles.hint}>You’ll become the organization’s owner. You can update its details any time.</p></div>
    <OrganizationForm action={createOrganization} />
  </div></Container></main>;
}
