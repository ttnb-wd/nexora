"use client";
import { useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll } from "motion/react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { FadeUp } from "@/components/animation/fade-up";
import { EventCard } from "@/components/event/event-card";
import type { Event } from "../types";
import { EventDetailHero } from "./event-detail-hero";
import { EventRegistrationPanel } from "./event-registration-panel";
import { EventAgenda } from "./event-agenda";
import { EventSpeakers } from "./event-speakers";
import { EventVenue } from "./event-venue";
import { EventOrganizer } from "./event-organizer";
import { EventResources } from "./event-resources";
import { EventActionButtons } from "./event-action-buttons";
import styles from "./event-detail.module.css";
const sections = ["About", "Agenda", "Speakers", "Venue", "Organizer", "Resources"];
function DetailSection({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  return <section id={title.toLowerCase()} aria-labelledby={`${title.toLowerCase()}-title`} className={styles.section}><FadeUp distance={14} duration={.45}><header className={styles.sectionHeading}><span aria-hidden="true">{String(index).padStart(2, "0")}</span><h2 id={`${title.toLowerCase()}-title`}>{title}</h2></header>{children}</FadeUp></section>;
}
export function EventDetailExperience({ event, related }: { event: Event; related: Event[] }) {
  const [joined, setJoined] = useState(false);
  const [saved, setSaved] = useState(false);
  const page = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: page, offset: ["start start", "end end"] });
  const interactions = { event, joined, saved, onJoin: () => setJoined((value) => !value), onSave: () => setSaved((value) => !value) };
  return <main id="main-content" tabIndex={-1} ref={page} className={styles.page} data-event-detail>
    {!reduced && <motion.div className={styles.progress} style={{ scaleX: scrollYProgress }} aria-hidden="true" />}
    <Container><FadeUp distance={18} duration={.6}><EventDetailHero {...interactions} /></FadeUp>
      <nav className={styles.sectionNav} aria-label="Event sections">{sections.map((section) => <a key={section} href={`#${section.toLowerCase()}`}>{section}</a>)}</nav>
      <div className={styles.contentGrid}><div className={styles.content}>
        <DetailSection title="About" index={1}><div className={styles.about}>{event.details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><ul className={styles.tags} aria-label="Event interests">{event.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></DetailSection>
        <DetailSection title="Agenda" index={2}><p className={styles.sectionNote}>A little structure. Plenty of possibility. All times in Myanmar Time (MMT).</p><EventAgenda event={event} /></DetailSection>
        <DetailSection title="Speakers" index={3}><EventSpeakers speakers={event.details.speakers} /></DetailSection>
        <DetailSection title="Venue" index={4}><EventVenue event={event} /></DetailSection>
        <DetailSection title="Organizer" index={5}><EventOrganizer event={event} /></DetailSection>
        <DetailSection title="Resources" index={6}><EventResources event={event} /></DetailSection>
      </div><EventRegistrationPanel {...interactions} /></div>
      <section aria-labelledby="related-title" className={styles.related}><FadeUp><header className={styles.relatedHeader}><div><p className={styles.eyebrow}>KEEP THE CURIOSITY GOING</p><h2 id="related-title">More in your orbit<span>.</span></h2></div><Link href="/explore">Explore all events <ArrowUpRight size={17} aria-hidden="true" /></Link></header></FadeUp><div className={styles.relatedGrid}>{related.map((candidate, index) => <FadeUp key={candidate.id} delay={index * .06}><EventCard event={candidate} /></FadeUp>)}</div></section>
    </Container>
    <div className={styles.mobileJoin}><div><strong>{event.status === "completed" ? "Completed event" : joined ? "Joined in this demo" : "Your next moment"}</strong><small>{event.status === "completed" ? "Resource previews available above" : "Local UI preview · no registration"}</small></div><EventActionButtons {...interactions} /></div>
  </main>;
}
