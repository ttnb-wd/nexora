import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requireUser } from "@/features/auth/server/session";
import { getDb } from "@/lib/db";
import { Container } from "@/components/layout/container";
import { buttonStyles } from "@/components/ui/button";
import styles from "@/features/organizations/components/organizer.module.css";

export default async function OrganizerPage() {
  const user = await requireUser();
  const memberships = await getDb().organizationMember.findMany({ where: { userId: user.id }, include: { organization: true }, orderBy: { createdAt: "desc" } });
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <div className={styles.header}><div><p className={styles.eyebrow}>NEXORA ORGANIZER</p><h1>Your organizations.</h1><p className={styles.intro}>A home for the communities and ideas you bring together.</p></div>{memberships.length > 0 && <Link href="/organizer/create" className={buttonStyles()}><Plus size={16} aria-hidden="true" />Create organization</Link>}</div>
    {memberships.length === 0 ? <section className={styles.empty}><Building2 size={40} aria-hidden="true" /><h2>Create your first organization</h2><p>Give your community a home on Nexora. Set up your organization and start shaping what comes next.</p><Link href="/organizer/create" className={buttonStyles()}>Create organization</Link></section> : <div className={styles.grid}>{memberships.map(({ organization, role }) => <article key={organization.id} className={styles.card}><span className={styles.badge}>{role}</span><h2>{organization.name}</h2><p>{organization.industry || "Industry not added"}</p><p>{[organization.city, organization.region].filter(Boolean).join(", ") || "Location not added"}</p><Link href={`/organizer/${organization.slug}`} className={buttonStyles({ variant: "secondary" })}>Manage organization</Link>{["OWNER","ADMIN","EDITOR"].includes(role) && <p><Link href={`/organizer/${organization.slug}/analytics`}>Analytics →</Link></p>}</article>)}</div>}
  </Container></main>;
}
