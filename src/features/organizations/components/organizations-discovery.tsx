"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Building2, Compass } from "lucide-react";
import { Container } from "@/components/layout/container";
import { FadeUp } from "@/components/animation/fade-up";
import type { PublicOrganization } from "../types";
import type { PublicEvent } from "@/features/events/types";
import { filterOrganizations, initialOrganizationFilters } from "../organization-helpers";
import type { OrganizationFiltersState, OrganizationSort } from "../types";
import { OrganizationCard } from "./organization-card";
import { OrganizationFilters } from "./organization-filters";
import { OrganizationSpotlight } from "./organization-spotlight";
import pageStyles from "./organizations-discovery.module.css";
import { cn } from "@/lib/utils";
import styles from "./organizations.module.css";
export function OrganizationsDiscovery({ allOrganizations, trending, unavailable = false }: { allOrganizations: PublicOrganization[]; trending: { organization: PublicOrganization; upcomingCount: number; nextEvent: PublicEvent | null } | null; unavailable?: boolean }) {
  const locations = [...new Set(allOrganizations.map((organization) => organization.city || organization.region).filter(Boolean))].sort();
  const industries = [...new Set(allOrganizations.map((organization) => organization.industry).filter(Boolean))].sort();
  const trendingOrganization = trending?.organization;
  const [filters, setFilters] = useState(initialOrganizationFilters);
  const [sort, setSort] = useState<OrganizationSort>("relevance");
  const reduced = useReducedMotion();
  const organizations = filterOrganizations(allOrganizations, filters, sort);
  function change<K extends keyof OrganizationFiltersState>(key: K, value: OrganizationFiltersState[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  function reset() { setFilters(initialOrganizationFilters); setSort("relevance"); }
  return <main id="main-content" tabIndex={-1} className={styles.discovery}><Container>
    <div className={pageStyles.topRow}>
      <header className={pageStyles.intro}>
        <FadeUp delay={0}><p className={pageStyles.eyebrow}><Compass size={16} aria-hidden="true" /> PEOPLE MAKING THINGS HAPPEN</p></FadeUp>
        <FadeUp delay={.07}><h1>Meet the people<br /><span>behind what’s next.</span></h1></FadeUp>
        <FadeUp delay={.14}><p>Discover active companies, communities, and organizers bringing people together through events.</p></FadeUp>
      </header>
      {trendingOrganization && <FadeUp delay={.1} distance={16}><OrganizationSpotlight organization={trendingOrganization} upcomingCount={trending!.upcomingCount} nextEvent={trending!.nextEvent} /></FadeUp>}
    </div>
    <section aria-labelledby="discover-organizations-title" className={cn(styles.directory, pageStyles.directory)}><header className={styles.directoryHeading}><h2 id="discover-organizations-title">All organizations</h2><p>More people and possibilities to discover.</p></header><OrganizationFilters filters={filters} industries={industries} locations={locations} onChange={change} onReset={reset} />
      <div className={styles.resultsBar}><p role="status" aria-live="polite" aria-atomic="true"><strong>{organizations.length}</strong> {organizations.length === 1 ? "organization" : "organizations"} to discover</p><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as OrganizationSort)}><option value="relevance">Relevance</option><option value="alphabetical">Name A–Z</option></select></label></div>
      <motion.div key={JSON.stringify([filters, sort])} initial={false} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .2 }} id="organization-results">{organizations.length ? <div className={styles.organizationGrid}>{organizations.map((organization, index) => <FadeUp className={pageStyles.gridCard} key={organization.slug} distance={12} duration={.4} delay={index * .035}><OrganizationCard organization={organization} /></FadeUp>)}</div> : <div className={styles.empty}><span><Building2 size={30} aria-hidden="true" /></span><h3>{unavailable ? "Organizations are temporarily unavailable." : "A new connection is still out there."}</h3><p>{unavailable ? "Please try again shortly." : "Try another name, industry, or location. A little more room can lead somewhere unexpected."}</p><button type="button" onClick={reset}>Reset all filters</button></div>}</motion.div>
      <p className={styles.endNote}>Good ideas need good company. Start with a little curiosity.</p>
    </section>
  </Container></main>;
}
