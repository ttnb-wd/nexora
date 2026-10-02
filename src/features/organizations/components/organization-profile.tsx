"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, MapPin, Globe, Users, BriefcaseBusiness, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/container";
import { FadeUp } from "@/components/animation/fade-up";
import { EventCard } from "@/components/event/event-card";
import type { Event } from "@/features/events/types";
import type { Organization } from "../types";
import { cn } from "@/lib/utils";
import { OrganizationVisual } from "./organization-visual";
import { OrganizationFollowButton } from "./organization-follow-button";
import { OrganizationCard } from "./organization-card";
import styles from "./organizations.module.css";

const sectionLinks = [
  { label: "About", id: "about" }, { label: "Upcoming", id: "upcoming" },
  { label: "Past events", id: "past" }, { label: "Topics", id: "topics" },
  { label: "Team", id: "team" }, { label: "Links / contact", id: "contact" },
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
export function OrganizationProfile({ organization, upcoming, past, related }: { organization: Organization; upcoming: Event[]; past: Event[]; related: Organization[] }) {
  const [following, setFollowing] = useState(false);
  const reduced = useReducedMotion();
  const hasLinks = Boolean(organization.website || organization.socialLinks.length);
  return <main id="main-content" tabIndex={-1} className={cn(styles.profile, styles[organization.visualTheme])}><Container>
    <Link href="/companies" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />All organizations</Link>
    <FadeUp distance={18} duration={.55}>
      <header className={styles.profileHero}>
        <div className={styles.profileIdentity}>
          <OrganizationVisual organization={organization} size="mark" className={styles.identityMark} />
          <div className={styles.profileLabels}><span>{organization.industry}</span><span><MapPin size={13} aria-hidden="true" />{organization.location.city}</span></div>
          <h1>{organization.name}</h1><p className={styles.heroDescription}>{organization.description}</p>
          <div className={styles.profileActions}>
            <OrganizationFollowButton name={organization.name} following={following} onToggle={() => setFollowing((value) => !value)} />
            {organization.website && <a href={organization.website} className={styles.websiteAction} aria-label={`Website for ${organization.name} (placeholder)`}><Globe size={15} aria-hidden="true" />Website <ArrowUpRight size={14} aria-hidden="true" /></a>}
          </div>
          <p className={styles.followStatus} role="status" aria-live="polite" aria-atomic="true">{following ? `Following ${organization.name}. Resets when you leave this profile.` : "Follow along. Local preview, no account needed."}</p>
        </div>
        <div className={styles.profileArtwork}>
          <motion.div className={styles.artworkMotion} initial={false} animate={reduced === false ? { y: [0, -5, 0] } : { y: 0 }} transition={{ duration: 8, repeat: reduced === false ? Infinity : 0, ease: "easeInOut" }}>
            <OrganizationVisual organization={organization} size="banner" />
          </motion.div>
          <p className={styles.artworkStatement}>{organization.statement}</p>
          <div className={styles.activityPreview}><span>{upcoming.length ? `${upcoming.length} upcoming ${upcoming.length === 1 ? "gathering" : "gatherings"}` : "New possibilities ahead"}</span>{upcoming[0] ? <Link href={`/events/${upcoming[0].slug}`} aria-label={`Next from ${organization.name}: ${upcoming[0].title}`}>{upcoming[0].title}<ArrowUpRight size={17} aria-hidden="true" /></Link> : <a href="#topics">Explore our interests <ArrowUpRight size={17} aria-hidden="true" /></a>}</div>
        </div>
      </header>
    </FadeUp>
    <nav className={styles.profileNav} aria-label="Organization sections">{sectionLinks.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav>
    <ProfileSection id="about" title="About the organization"><div className={styles.aboutGrid}>
      <div className={styles.aboutCopy}>{organization.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <aside className={styles.orgFacts} aria-label="Organization overview"><p className={styles.eyebrow}>OUR POINT OF CONNECTION</p><dl><div><dt>Based in</dt><dd>{organization.location.city} · {organization.location.region}</dd></div><div><dt>Our focus</dt><dd>{organization.industry}</dd></div><div><dt>Our invitation</dt><dd>{organization.statement}</dd></div></dl></aside>
    </div></ProfileSection>
    <ProfileSection id="upcoming" title="Upcoming events"><p className={styles.sectionNote}>What’s coming next from {organization.name}.</p><OrganizationEvents events={upcoming} /></ProfileSection>
    <ProfileSection id="past" title="Past events"><p className={styles.sectionNote}>Completed gatherings and the ideas they left behind.</p><OrganizationEvents events={past} completed /></ProfileSection>
    <ProfileSection id="topics" title="The things that move us">
      {organization.topics.length ? <ul className={styles.topics} aria-label="Areas of interest">{organization.topics.map((topic, index) => <motion.li key={topic} initial={false} whileInView={reduced === false ? { opacity: [0, 1], y: [8, 0] } : { opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: reduced ? 0 : index * .04, duration: reduced ? 0 : .3 }}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{topic}</motion.li>)}</ul> : <CompactEmpty title="Curiosity has room to grow.">This organization hasn’t shared its topics yet.</CompactEmpty>}
    </ProfileSection>
    <ProfileSection id="team" title="People behind the possibilities"><p className={styles.sectionNote}>Meet the people shaping the gatherings. Fictional team previews.</p>
      {organization.team.length ? <div className={styles.teamGrid}>{organization.team.map((member, index) => <FadeUp key={member.name} delay={index * .06} duration={.4}><article className={styles.teamMember}><div className={styles.teamAvatar} aria-hidden="true">{member.initials}</div><div><h3>{member.name}</h3><p className={styles.teamRole}>{member.role}</p>{member.note && <p>{member.note}</p>}</div></article></FadeUp>)}</div> : <CompactEmpty title="Introductions are on their way.">The team hasn’t shared a preview yet.</CompactEmpty>}
    </ProfileSection>
    <ProfileSection id="contact" title="Links / contact">
      {hasLinks ? <><p className={styles.sectionNote}>Preview links for this fictional organization. Reserved .example addresses are placeholders.</p><div className={styles.contactGrid}>
        {organization.website && <a href={organization.website} className={styles.contact} aria-label={`Website for ${organization.name} (placeholder)`}><Globe size={21} aria-hidden="true" /><span><strong>Website</strong><small>{organization.website.replace("https://", "")}</small></span><ArrowUpRight size={17} aria-hidden="true" /></a>}
        {organization.socialLinks.map((link) => <a key={link.kind} href={link.url} className={styles.contact} aria-label={`${link.label} for ${organization.name} (placeholder)`}>{link.kind === "professional" ? <BriefcaseBusiness size={21} aria-hidden="true" /> : <Users size={21} aria-hidden="true" />}<span><strong>{link.label}</strong><small>Organization link · placeholder</small></span><ArrowUpRight size={17} aria-hidden="true" /></a>)}
      </div></> : <CompactEmpty title="More ways to connect, soon.">This organization hasn’t shared public links yet.</CompactEmpty>}
    </ProfileSection>
    {related.length > 0 && <ProfileSection id="similar" title="Discover similar organizers"><div className={styles.organizationGrid}>{related.map((candidate, index) => <FadeUp key={candidate.id} delay={index * .06}><OrganizationCard organization={candidate} /></FadeUp>)}</div></ProfileSection>}
    <div className={styles.profileEnd}><p>There’s always another point of connection.</p><Link href="/companies">Meet more organizations <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
  </Container></main>;
}
