import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import type { Organization } from "../types";
import { getOrganizationEvents } from "../organization-events";
import { OrganizationVisual } from "./organization-visual";
import { OrganizationFollowButton } from "./organization-follow-button";
import { cn } from "@/lib/utils";
import shared from "./organizations.module.css";
import styles from "./organizations-discovery.module.css";

export function OrganizationSpotlight({ organization, following, onToggleFollow }: {
  organization: Organization; following: boolean; onToggleFollow: () => void;
}) {
  const { upcoming } = getOrganizationEvents(organization);
  const nextEvent = upcoming[0];
  const nextDate = nextEvent && new Date(`${nextEvent.date}T12:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return <section aria-labelledby="trending-organization-title" className={cn(styles.spotlight, shared[organization.visualTheme])}>
    <p className={styles.spotlightLabel}>TRENDING ON NEXORA</p>
    <div className={styles.spotlightIdentity}>
      <OrganizationVisual organization={organization} className={styles.spotlightArtwork} />
      <div className={styles.spotlightCopy}>
        <div className={styles.metadata}><span>{organization.industry}</span><span><MapPin size={12} aria-hidden="true" />{organization.location.city}</span></div>
        <h2 id="trending-organization-title"><Link href={`/companies/${organization.slug}`}>{organization.name}</Link></h2>
        <p>{organization.description}</p>
        <span className={styles.activity}>{upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}</span>
      </div>
    </div>
    {nextEvent && <Link className={styles.nextEvent} href={`/events/${nextEvent.slug}`} aria-label={`Next event: ${nextEvent.title}`}>
      <span className={styles.nextDate}><span>NEXT EVENT</span><time dateTime={nextEvent.date}>{nextDate}</time></span>
      <span className={styles.nextTitle}>{nextEvent.title}<span>{nextEvent.type}</span></span>
      <ArrowRight size={18} aria-hidden="true" />
    </Link>}
    <div className={styles.spotlightActions}>
      <OrganizationFollowButton name={organization.name} following={following} onToggle={onToggleFollow} />
      <Link href={`/companies/${organization.slug}`}>View organization<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
  </section>;
}
