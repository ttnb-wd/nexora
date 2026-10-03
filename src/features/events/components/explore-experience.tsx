"use client";
import { useState } from "react";
import { Grid2X2, List, Compass } from "lucide-react";
import { Container } from "@/components/layout/container";
import { EventCard } from "@/components/event/event-card";
import { filterEvents, initialFilters, type EventSort } from "../filter-events";
import type { Event, EventFiltersState } from "../types";
import { EventSearch } from "./event-search";
import { EventFilters } from "./event-filters";
import { FilterChip } from "./filter-chip";
import { EventResults } from "./event-results";
import styles from "./explore.module.css";

export function ExploreExperience({ publishedEvents, featuredEvent, now, unavailable = false }: { publishedEvents: Event[]; featuredEvent: Event | null; now: string; unavailable?: boolean }) {
  const locations = [...new Set(publishedEvents.map((event) => event.location.city))];
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<EventSort>("recommended");
  const [view, setView] = useState<"grid" | "list">("grid");
  const events = filterEvents(publishedEvents, filters, sort, new Date(now));
  const active = (Object.keys(filters) as (keyof EventFiltersState)[]).filter((key) => filters[key] !== initialFilters[key]);
  function changeFilter<K extends keyof EventFiltersState>(key: K, value: EventFiltersState[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  function reset() { setFilters(initialFilters); setSort("recommended"); }
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <header className={styles.intro}><div><p className={styles.eyebrow}><Compass size={16} aria-hidden="true" /> FOLLOW YOUR CURIOSITY</p><h1>Go where your<br /><span>next begins.</span></h1></div><div className={styles.introAside}><p>Fresh ideas. New faces. Shared experiences.<br />Find something that moves you.</p><span className={styles.demo}>Discover upcoming events</span></div></header>
    {featuredEvent && <section aria-labelledby="featured-title" className={styles.featured}><div className={styles.sectionLabel}><h2 id="featured-title">COMING UP NEXT</h2><span>01 / IN THE SPOTLIGHT</span></div><EventCard event={featuredEvent} variant="featured" /></section>}
    <section aria-labelledby="discover-title" className={styles.discovery}>
      <header className={styles.discoverHeader}><h2 id="discover-title">Find your kind of moment<span>.</span></h2><p>A little exploration goes a long way.</p></header>
      <EventSearch value={filters.query} onChange={(value) => changeFilter("query", value)} />
      <EventFilters filters={filters} locations={locations} calendarNote={`Upcoming events · ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(now))}`} onChange={changeFilter} />
      {active.length > 0 && <div className={styles.chips} role="group" aria-label="Active filters">{active.map((key) => <FilterChip key={key} label={key === "query" ? `Search: ${filters[key]}` : filters[key]} onRemove={() => changeFilter(key, initialFilters[key])} />)}<button className={styles.reset} onClick={reset} type="button">Clear all</button></div>}
      <div className={styles.resultsBar}><p role="status" aria-live="polite" aria-atomic="true"><strong>{events.length}</strong> {events.length === 1 ? "event" : "events"} to explore</p><div className={styles.resultControls}><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as EventSort)}><option value="recommended">Recommended</option><option value="soonest">Soonest first</option><option value="title">Title A–Z</option></select></label><div className={styles.viewToggle} role="group" aria-label="Results view"><button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} type="button"><Grid2X2 size={18} aria-hidden="true" /></button><button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} type="button"><List size={18} aria-hidden="true" /></button></div></div></div>
      {unavailable ? <p role="status">Events are temporarily unavailable. Please try again shortly.</p> : <EventResults events={events} view={view} onReset={reset} transitionKey={JSON.stringify([filters, sort, view])} />}
      <p className={styles.endNote}>Stay curious. Your next great experience could start with showing up.</p>
    </section>
  </Container></main>;
}
