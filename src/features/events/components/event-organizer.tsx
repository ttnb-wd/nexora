import type { Event } from "../types";
import { getOrganizationById, getOrganizationBySlug } from "@/features/organizations/organization-helpers";
import { OrganizationCard } from "@/features/organizations/components/organization-card";
import Link from "next/link";
import { ArrowUpRight, Asterisk, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "@/features/organizations/components/organizations.module.css";
export function EventOrganizer({ event }: { event: Event }) {
  if (event.organizer) {
    const organizer = event.organizer;
    // Temporary bridge: only link when Companies already has a public fixture for this slug.
    const profile = organizer.slug && getOrganizationBySlug(organizer.slug);
    const tone = ["violet", "cyan", "coral", "warm", "mixed"].includes(event.visual.tone) ? event.visual.tone : "violet";
    return <article className={cn(styles.card, styles.compact, styles[tone])} aria-label={organizer.name}><div className={cn(styles.visual, styles.mark)} aria-hidden="true"><Asterisk className={styles.symbol} strokeWidth={1.2} /></div><div className={styles.cardBody}>
      <div className={styles.cardCategory}><span>{organizer.industry ?? (organizer.slug ? "Organization" : "Independent organizer")}</span>{organizer.location && <span><MapPin size={13} aria-hidden="true" />{organizer.location}</span>}</div>
      <h3>{organizer.name}</h3>
      {profile && <div className={styles.cardActions}><Link href={`/companies/${profile.slug}`}>View organization <ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
    </div></article>;
  }
  const organization = getOrganizationById(event.organizationId);
  if (organization) return <OrganizationCard organization={organization} variant="compact" actionLabel="View organization" />;
  return <p>Organizer details are coming soon.</p>;
}
