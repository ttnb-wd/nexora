import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { AmbientBackground } from "@/components/animation/ambient-background";
import { FadeUp } from "@/components/animation/fade-up";
import { RevealText } from "@/components/animation/reveal-text";
import { CategoryStrip } from "@/components/event/category-strip";
import { EventCard } from "@/components/event/event-card";
import { getUpcomingPublishedEvents } from "@/features/events/server/public-event-queries";
import { EventOrbit } from "@/components/event/event-orbit";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { buttonStyles } from "@/components/ui/button";
import { motionTokens } from "@/config/motion";
import styles from "./homepage.module.css";
import { GlobalSearch } from "@/features/search/components/global-search";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  let homepageEvents: Awaited<ReturnType<typeof getUpcomingPublishedEvents>> = [];
  let eventsUnavailable = false;
  try { homepageEvents = await getUpcomingPublishedEvents(3); }
  catch (error) { console.error("Homepage event query failed", error); eventsUnavailable = true; }
  return (
    <main id="main-content" tabIndex={-1}>
      <Section spacing="none" aria-labelledby="hero-title" className={styles.hero}>
        <AmbientBackground />
        <Container>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <FadeUp><p className={styles.eyebrow}><span /> A WORLD OF EXPERIENCES, OPEN TO YOU</p></FadeUp>
              <h1 id="hero-title" className="display-xl"><RevealText mode="line" text={"Discover\nwhat’s happening\nnext."} gradientIndices={[2]} delay={0.1} /></h1>
              <div className={styles.heroDescription}>
                <FadeUp delay={0.35}><p>Your next idea. Your next connection.<br />Your next great experience.</p></FadeUp>
                <FadeUp delay={0.35 + motionTokens.stagger.line}><p>Find it where people come together.</p></FadeUp>
              </div>
              <div className={styles.heroActions}>
                <FadeUp delay={0.55}><Link href="/explore" className={buttonStyles({ size: "lg" })}>Explore events <ArrowUpRight aria-hidden="true" /></Link></FadeUp>
                <FadeUp delay={0.55 + motionTokens.stagger.element}><Link href="/create-event" className={buttonStyles({ size: "lg", variant: "secondary" })}>Create an event <ArrowUpRight aria-hidden="true" /></Link></FadeUp>
              </div>
              <FadeUp delay={0.75}><p className={styles.heroNote}>Built for curious minds and meaningful moments.</p></FadeUp>
              <GlobalSearch />
            </div>
            <EventOrbit events={homepageEvents} />
          </div>
          <div className={styles.heroFoot}><span>GOOD THINGS HAPPEN WHEN WE SHOW UP.</span><a href="#happening-soon">See what’s taking shape <ArrowDown size={16} aria-hidden="true" /></a></div>
        </Container>
      </Section>
      <CategoryStrip />
      <Section id="happening-soon" aria-labelledby="soon-title" className={styles.teaser}>
        <Container>
          <FadeUp><header className={styles.teaserHeader}><div><p className="label text-primary mb-3">FIND YOUR NEXT MOMENT</p><h2 id="soon-title" className="heading-1">Happening soon<span>.</span></h2></div><p>New perspectives. Good company.<br />Something worth showing up for.</p></header></FadeUp>
          <p className={styles.placeholderNote}><span>COMING UP</span>Real events from the Nexora community.</p>
          <div className={styles.teaserGrid}>
            {homepageEvents.map((event, index) => <FadeUp key={event.id} delay={motionTokens.stagger.element * index}><EventCard event={event} /></FadeUp>)}
          </div>
          {homepageEvents.length === 0 && <p className={styles.placeholderNote}>{eventsUnavailable ? "Events are temporarily unavailable. Please try again shortly." : "Nothing on the calendar yet. Explore what’s next or create the first event."}</p>}
          <Link href="/explore" className={styles.exploreLink}>Explore all events <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </Container>
      </Section>

    </main>
  );
}
