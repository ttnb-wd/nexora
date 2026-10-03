"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
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
import { useRouter } from "next/navigation";
import { joinEvent, cancelEventRegistration } from "@/features/participation/server/actions";
import { useEventBookmark } from "@/features/participation/components/bookmark-provider";
import { eventSignInPath, type Availability, type ViewerParticipation } from "@/features/participation/rules";
import styles from "./event-detail.module.css";
import { CalendarControl, ReminderControl } from "../calendar/calendar-controls";
import type { ReminderState } from "../reminders/schemas";
import { FeedbackForm } from "@/features/post-event/feedback-form";
import type { ViewerFeedback } from "@/features/post-event/schemas";
function DetailSection({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  return <section id={title.toLowerCase()} aria-labelledby={`${title.toLowerCase()}-title`} className={styles.section}><FadeUp distance={14} duration={.45}><header className={styles.sectionHeading}><span aria-hidden="true">{String(index).padStart(2, "0")}</span><h2 id={`${title.toLowerCase()}-title`}>{title}</h2></header>{children}</FadeUp></section>;
}
export function EventDetailExperience({ event, related, participation, reminder, feedback }: { event: Event; related: Event[]; participation: { viewer: ViewerParticipation; availability: Availability }; reminder: ReminderState; feedback: ViewerFeedback }) {
  const joined = participation.viewer.joined;
  const attended = participation.viewer.attended;
  const bookmark = useEventBookmark(event.slug);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function changeRegistration(cancel: boolean) {
    if (!participation.viewer.authenticated) { router.push(eventSignInPath(event.slug)); return; }
    startTransition(async () => {
      try {
        const result = await (cancel ? cancelEventRegistration(event.slug) : joinEvent(event.slug));
        if (result.signIn) { router.push(result.signIn); return; }
        setMessage(result.message);
        router.refresh();
      } catch { setMessage("We could not update your registration. Please try again."); }
    });
  }
  const page = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: page, offset: ["start start", "end end"] });
  const interactions = { event, joined, attended, saved: bookmark.saved, pending: pending || bookmark.pending, message: message || bookmark.message, availability: participation.availability, onJoin: () => changeRegistration(false), onCancel: () => changeRegistration(true), onSave: bookmark.toggle };
  const showResources = event.details.resources.length > 0;
  const showAbout = event.details.about.length > 0 || event.tags.length > 0;
  const showVenue = Boolean(event.location.venue || event.location.city || event.details.venue.address || event.details.venue.guidance);
  const showFeedback = feedback.eligible || feedback.noShow;
  const sections = [...(showAbout ? ["About"] : []), ...(event.details.agenda.length ? ["Agenda"] : []), ...(event.details.speakers.length ? ["Speakers"] : []), ...(showVenue ? ["Venue"] : []), ...(event.organizer ? ["Organizer"] : []), ...(showResources ? ["Resources"] : []), ...(showFeedback ? ["Feedback"] : [])];
  return <main id="main-content" tabIndex={-1} ref={page} className={styles.page} data-event-detail>
    {!reduced && <motion.div className={styles.progress} style={{ scaleX: scrollYProgress }} aria-hidden="true" />}
    <Container><FadeUp distance={18} duration={.6}><EventDetailHero {...interactions} /></FadeUp>
      <nav className={styles.sectionNav} aria-label="Event sections">{sections.map((section) => <a key={section} href={`#${section.toLowerCase()}`}>{section}</a>)}</nav>
      <div className={styles.contentGrid}><div className={styles.content}>
        {showAbout && <DetailSection title="About" index={1}><div className={styles.about}>{event.details.about.length ? event.details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : null}</div><ul className={styles.tags} aria-label="Event interests">{event.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></DetailSection>}
        {event.details.agenda.length > 0 && <DetailSection title="Agenda" index={sections.indexOf("Agenda") + 1}><p className={styles.sectionNote}>All times in {event.timezone ?? "Myanmar Time (MMT)"}.</p><EventAgenda event={event} /></DetailSection>}
        {event.details.speakers.length > 0 && <DetailSection title="Speakers" index={sections.indexOf("Speakers") + 1}><EventSpeakers speakers={event.details.speakers} /></DetailSection>}
        {showVenue && <DetailSection title="Venue" index={sections.indexOf("Venue") + 1}><EventVenue event={event} /></DetailSection>}
        {event.organizer && <DetailSection title="Organizer" index={sections.indexOf("Organizer") + 1}><EventOrganizer event={event} /></DetailSection>}
        {showResources && <DetailSection title="Resources" index={sections.indexOf("Resources") + 1}><EventResources event={event} /></DetailSection>}
        {showFeedback && <DetailSection title="Feedback" index={sections.indexOf("Feedback") + 1}><FeedbackForm slug={event.slug} state={feedback} /></DetailSection>}
        {event.calendar && (!joined || event.status === "completed" || reminder.eligible) && <div className={styles.mobileCalendar}>{(!joined || event.status === "completed") && <CalendarControl links={event.calendar} title={event.title} />}<ReminderControl slug={event.slug} state={reminder} /></div>}
      </div><EventRegistrationPanel {...interactions} reminder={reminder} /></div>
      {related.length > 0 && <section aria-labelledby="related-title" className={styles.related}><FadeUp><header className={styles.relatedHeader}><div><p className={styles.eyebrow}>KEEP THE CURIOSITY GOING</p><h2 id="related-title">More in your orbit<span>.</span></h2></div><Link href="/explore">Explore all events <ArrowUpRight size={17} aria-hidden="true" /></Link></header></FadeUp><div className={styles.relatedGrid}>{related.map((candidate, index) => <FadeUp key={candidate.id} delay={index * .06}><EventCard event={candidate} /></FadeUp>)}</div></section>}
    </Container>
    <div className={styles.mobileJoin}><div><strong>{attended ? "Attended" : event.status === "completed" ? "Completed event" : joined ? "Joined" : "Your next moment"}</strong><small>{attended ? "You attended this event" : event.status === "completed" ? "This event has ended" : participation.availability.closedReason ?? (joined ? "Your registration is saved to your account" : "Join or save this event")}</small></div><EventActionButtons {...interactions} /></div>
  </main>;
}
