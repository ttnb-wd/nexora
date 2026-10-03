import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicOrganization, OrganizationCardVariant } from "../types";
import type { Event } from "@/features/events/types";
import { EventCard } from "@/components/event/event-card";
import { OrganizationVisual } from "./organization-visual";
import { OrganizationFollowButton } from "./organization-follow-button";
import styles from "./organizations.module.css";
export function OrganizationCard({ organization, variant = "standard", upcomingEvent, actionLabel = "View profile" }: { organization: PublicOrganization; variant?: OrganizationCardVariant; upcomingEvent?: Event; actionLabel?: string }) {
  return <article className={cn(styles.card, styles[variant], styles[organization.visualTheme])} aria-label={organization.name}>
    <OrganizationVisual organization={organization} size={variant === "compact" ? "mark" : variant === "featured" ? "banner" : "tile"} />
    <div className={styles.cardBody}><div className={styles.cardCategory}><span>{organization.industry}</span><span><MapPin size={13} aria-hidden="true" />{organization.city || organization.region || "Location not shared"}</span></div><h3><Link href={`/companies/${organization.slug}`}>{organization.name}</Link></h3>
      {variant === "featured" && <p className={styles.statement}>{organization.description}</p>}
      <p className={styles.cardDescription}>{organization.description}</p>
      <div className={styles.cardActions}><OrganizationFollowButton name={organization.name} slug={organization.slug} /><Link href={`/companies/${organization.slug}`} aria-label={`${actionLabel}: ${organization.name}`}>{actionLabel}<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      {variant === "featured" && upcomingEvent && <div className={styles.featureEvent}><p className={styles.eyebrow}>NEXT FROM {organization.name.toUpperCase()}</p><EventCard event={upcomingEvent} variant="compact" /></div>}
      <p className={styles.demoNote}>Follow to see new event announcements.</p>
    </div>
  </article>;
}
