"use client";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { organizationIndustries, type OrganizationFiltersState } from "../types";
import { initialOrganizationFilters } from "../organization-helpers";
import styles from "./organizations.module.css";
export function OrganizationFilters({ filters, locations, onChange, onReset }: { filters: OrganizationFiltersState; locations: string[]; onChange: <K extends keyof OrganizationFiltersState>(key: K, value: OrganizationFiltersState[K]) => void; onReset: () => void }) {
  const search = useRef<HTMLInputElement>(null);
  const active = (Object.keys(filters) as (keyof OrganizationFiltersState)[]).filter((key) => filters[key] !== initialOrganizationFilters[key]);
  return <div>
    <form role="search" aria-label="Search organizations" onSubmit={(event) => event.preventDefault()} className={styles.search}><Search size={20} aria-hidden="true" /><label htmlFor="organization-search" className="sr-only">Search organizations by name, industry, or location</label><input ref={search} id="organization-search" type="search" value={filters.query} onChange={(event) => onChange("query", event.target.value)} autoComplete="off" placeholder="Find a studio, community, or new point of view…" />{filters.query && <button type="button" aria-label="Clear organization search" onClick={() => { onChange("query", ""); search.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}</form>
    <fieldset className={styles.filterGroup}><legend className="sr-only">Filter organizations</legend><div className={styles.industryFilters} role="group" aria-label="Industry">{(["All industries", ...organizationIndustries] as const).map((industry) => <button type="button" key={industry} aria-pressed={industry === filters.industry} onClick={() => onChange("industry", industry)}>{industry}</button>)}</div><label className={styles.locationFilter}>Location<select value={filters.location} onChange={(event) => onChange("location", event.target.value)}>{["Anywhere", ...locations].map((location) => <option key={location}>{location}</option>)}</select></label></fieldset>
    {active.length > 0 && <div className={styles.filterChips} role="group" aria-label="Active organization filters">{active.map((key) => <button key={key} type="button" className={styles.chip} aria-label={`Remove organization filter: ${filters[key]}`} onClick={() => onChange(key, initialOrganizationFilters[key])}><span>{key === "query" ? `Search: ${filters[key]}` : filters[key]}</span><X size={14} aria-hidden="true" /></button>)}<button type="button" className={styles.reset} onClick={onReset}>Clear all</button></div>}
  </div>;
}
