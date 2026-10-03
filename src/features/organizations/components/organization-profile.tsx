"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, MapPin, Globe, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/container";
import { FadeUp } from "@/components/animation/fade-up";
import { EventCard } from "@/components/event/event-card";
import type { Event } from "@/features/events/types";
import type { PublicOrganization } from "../types";
import { cn } from "@/lib/utils";
import { OrganizationVisual } from "./organization-visual";
import { OrganizationFollowButton } from "./organization-follow-button";
import { OrganizationCard } from "./organization-card";
import styles from "./organizations.module.css";

const sectionLinks = [
  { label: "About", id: "about" }, { label: "Upcoming", id: "upcoming" },
  { label: "Past events", id: "past" }, { label: "Links / contact", id: "contact" },
];
function ProfileSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className={styles.profileSection}>
    <FadeUp distance={14} duration={.45}><h2 id={`${id}-title`}>{title}</h2>{children}</FadeUp>
  </section>;
}
function CompactEmpty({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.eventEmpty}><Sparkles size={21} aria-hidden="true" /><div><h3>{title}</h3><p>{children}</p></div></div>;
}
function OrganizationEvents({ events, completed }: { events: Event[]; completed?: boolean }) {
  return events.length ? <div className={styles.eventGrid}>
    {events.map((event, index) => <FadeUp key={event.id} delay={index * .06} duration={.45}><EventCard event={event} /></FadeUp>)}
  </div> : <CompactEmpty title={completed ? "The story is just getting started." : "Something new is taking shape."}>
    {completed ? "No past gatherings to revisit yet." : "No upcoming events announced yet. Follow along for the next gathering."}
    {!completed && <><br /><Link href="/explore">Discover other events <ArrowUpRight size={15} aria-hidden="true" /></Link></>}
  </CompactEmpty>;
}
export function OrganizationProfile({ organization, upcoming, past, related }: { organization: PublicOrganization; upcoming: Event[]; past: Event[]; related: PublicOrganization[] }) {
  const [following, setFollowing] = useState(false);
  const reduced = useReducedMotion();
  const visibleSections = sectionLinks.filter((section) => (section.id !== "about" || organization.description || organization.city || organization.region || organization.industry) && (section.id !== "contact" || organization.website));
  return <main id="main-content" tabIndex={-1} className={cn(styles.profile, styles[organization.visualTheme])}><Container>
    <Link href="/companies" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />All organizations</Link>
    <FadeUp distance={18} duration={.55}>
      <header className={styles.profileHero}>
        <div className={styles.profileIdentity}>
          <OrganizationVisual organization={organization} size="mark" className={styles.identityMark} />
          <div className={styles.profileLabels}><span>{organization.industry}</span><span><MapPin size={13} aria-hidden="true" />{organization.city || organization.region || "Location not shared"}</span></div>
          <h1>{organization.name}</h1><p className={styles.heroDescription}>{organization.description}</p>
          <div className={styles.profileActions}>
            <OrganizationFollowButton name={organization.name} following={following} onToggle={() => setFollowing((value) => !value)} />
            {organization.website && <a href={organization.website} className={styles.websiteAction} aria-label={`Website for ${organization.name}`}><Globe size={15} aria-hidden="true" />Website <ArrowUpRight size={14} aria-hidden="true" /></a>}
          </div>
          <p className={styles.followStatus} role="status" aria-live="polite" aria-atomic="true">{following ? `Following ${organization.name}. Resets when you leave this profile.` : "Follow along. Local preview, no account needed."}</p>
        </div>
        <div className={styles.profileArtwork}>
          <motion.div className={styles.artworkMotion} initial={false} animate={reduced === false ? { y: [0, -5, 0] } : { y: 0 }} transition={{ duration: 8, repeat: reduced === false ? Infinity : 0, ease: "easeInOut" }}>
            <OrganizationVisual organization={organization} size="banner" />
          </motion.div>

          <div className={styles.activityPreview}><span>{upcoming.length ? `${upcoming.length} upcoming ${upcoming.length === 1 ? "gathering" : "gatherings"}` : "New possibilities ahead"}</span>{upcoming[0] ? <Link href={`/events/${upcoming[0].slug}`} aria-label={`Next from ${organization.name}: ${upcoming[0].title}`}>{upcoming[0].title}<ArrowUpRight size={17} aria-hidden="true" /></Link> : <a href="#upcoming">Explore our events <ArrowUpRight size={17} aria-hidden="true" /></a>}</div>
        </div>
      </header>
    </FadeUp>
    <nav className={styles.profileNav} aria-label="Organization sections">{visibleSections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav>
    {visibleSections.some((section) => section.id === "about") && <ProfileSection id="about" title="About the organization"><div className={styles.aboutGrid}>
      <div className={styles.aboutCopy}>{organization.description && <p>{organization.description}</p>}</div>
      <aside className={styles.orgFacts} aria-label="Organization overview"><p className={styles.eyebrow}>OUR POINT OF CONNECTION</p><dl>{(organization.city || organization.region) && <div><dt>Based in</dt><dd>{[organization.city, organization.region].filter(Boolean).join(" · ")}</dd></div>}{organization.industry && <div><dt>Our focus</dt><dd>{organization.industry}</dd></div>}</dl></aside>
    </div></ProfileSection>}
    <ProfileSection id="upcoming" title="Upcoming events"><p className={styles.sectionNote}>What’s coming next from {organization.name}.</p><OrganizationEvents events={upcoming} /></ProfileSection>
    <ProfileSection id="past" title="Past events"><p className={styles.sectionNote}>Completed gatherings and the ideas they left behind.</p><OrganizationEvents events={past} completed /></ProfileSection>
    {organization.website && <ProfileSection id="contact" title="Links / contact"><div className={styles.contactGrid}>
      <a href={organization.website} className={styles.contact} aria-label={`Website for ${organization.name}`}><Globe size={21} aria-hidden="true" /><span><strong>Website</strong><small>{organization.website.replace(/^https?:\/\//, "")}</small></span><ArrowUpRight size={17} aria-hidden="true" /></a>
    </div></ProfileSection>}
    {related.length > 0 && <ProfileSection id="similar" title="Discover similar organizers"><div className={styles.organizationGrid}>{related.map((candidate, index) => <FadeUp key={candidate.slug} delay={index * .06}><OrganizationCard organization={candidate} /></FadeUp>)}</div></ProfileSection>}
    <div className={styles.profileEnd}><p>There’s always another point of connection.</p><Link href="/companies">Meet more organizations <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
  </Container></main>;
}
