"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Building2, Compass } from "lucide-react";
import { Container } from "@/components/layout/container";
import { FadeUp } from "@/components/animation/fade-up";
import { mockOrganizations } from "../data/mock-organizations";
import { filterOrganizations, initialOrganizationFilters } from "../organization-helpers";
import { getTrendingOrganization } from "../organization-events";
import type { OrganizationFiltersState, OrganizationSort } from "../types";
import { OrganizationCard } from "./organization-card";
import { OrganizationFilters } from "./organization-filters";
import { OrganizationSpotlight } from "./organization-spotlight";
import pageStyles from "./organizations-discovery.module.css";
import { cn } from "@/lib/utils";
import styles from "./organizations.module.css";
const locations = [...new Set(mockOrganizations.map((organization) => organization.location.city))];
const trendingOrganization = getTrendingOrganization();
const remainingOrganizations = mockOrganizations.filter((organization) => organization.id !== trendingOrganization?.id);
export function OrganizationsDiscovery() {
  const [filters, setFilters] = useState(initialOrganizationFilters);
  const [sort, setSort] = useState<OrganizationSort>("relevance");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const reduced = useReducedMotion();
  const organizations = filterOrganizations(remainingOrganizations, filters, sort);
  function change<K extends keyof OrganizationFiltersState>(key: K, value: OrganizationFiltersState[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  function toggleFollow(id: string) { setFollowingIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function reset() { setFilters(initialOrganizationFilters); setSort("relevance"); }
  return <main id="main-content" tabIndex={-1} className={styles.discovery}><Container>
    <div className={pageStyles.topRow}>
      <header className={pageStyles.intro}>
        <FadeUp delay={0}><p className={pageStyles.eyebrow}><Compass size={16} aria-hidden="true" /> PEOPLE MAKING THINGS HAPPEN</p></FadeUp>
        <FadeUp delay={.07}><h1>Meet the people<br /><span>behind what’s next.</span></h1></FadeUp>
        <FadeUp delay={.14}><p>Discover active companies, communities, and organizers bringing people together through events.</p></FadeUp>
      </header>
      {trendingOrganization && <FadeUp delay={.1} distance={16}><OrganizationSpotlight organization={trendingOrganization} following={followingIds.includes(trendingOrganization.id)} onToggleFollow={() => toggleFollow(trendingOrganization.id)} /></FadeUp>}
    </div>
    <section aria-labelledby="discover-organizations-title" className={cn(styles.directory, pageStyles.directory)}><header className={styles.directoryHeading}><h2 id="discover-organizations-title">All organizations</h2><p>More people and possibilities to discover.</p></header><OrganizationFilters filters={filters} locations={locations} onChange={change} onReset={reset} />
      <div className={styles.resultsBar}><p role="status" aria-live="polite" aria-atomic="true"><strong>{organizations.length}</strong> {organizations.length === 1 ? "organization" : "organizations"} to discover</p><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as OrganizationSort)}><option value="relevance">Relevance</option><option value="alphabetical">Name A–Z</option></select></label></div>
      <motion.div key={JSON.stringify([filters, sort])} initial={false} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .2 }} id="organization-results">{organizations.length ? <div className={styles.organizationGrid}>{organizations.map((organization, index) => <FadeUp className={pageStyles.gridCard} key={organization.id} distance={12} duration={.4} delay={index * .035}><OrganizationCard organization={organization} following={followingIds.includes(organization.id)} onToggleFollow={() => toggleFollow(organization.id)} /></FadeUp>)}</div> : <div className={styles.empty}><span><Building2 size={30} aria-hidden="true" /></span><h3>A new connection is still out there.</h3><p>Try another name, industry, or location. A little more room can lead somewhere unexpected.</p><button type="button" onClick={reset}>Reset all filters</button></div>}</motion.div>
      <p className={styles.endNote}>Good ideas need good company. Start with a little curiosity.</p>
    </section>
  </Container></main>;
}
