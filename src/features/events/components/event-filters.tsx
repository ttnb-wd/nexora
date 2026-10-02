import { eventCategories, eventTypes, type EventFiltersState } from "../types";
import styles from "./explore.module.css";
const dates = ["Any date", "This week", "This month", "Later"] as const;
export function EventFilters({ filters, locations, onChange }: { filters: EventFiltersState; locations: string[]; onChange: <K extends keyof EventFiltersState>(key: K, value: EventFiltersState[K]) => void }) {
  return <fieldset className={styles.filterGroup}>
    <legend className="sr-only">Filter events</legend>
    <div className={styles.categories} role="group" aria-label="Category">
      {["All categories", ...eventCategories].map((category) => <button key={category} type="button" aria-pressed={filters.category === category} onClick={() => onChange("category", category as EventFiltersState["category"])}>{category}</button>)}
    </div>
    <div className={styles.selects}>
      <label>Date<select value={filters.date} onChange={(event) => onChange("date", event.target.value as EventFiltersState["date"])}>{dates.map((date) => <option key={date}>{date}</option>)}</select></label>
      <label>Event type<select value={filters.type} onChange={(event) => onChange("type", event.target.value as EventFiltersState["type"])}>{["All types", ...eventTypes].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>Location<select value={filters.location} onChange={(event) => onChange("location", event.target.value)}>{["Anywhere", ...locations].map((location) => <option key={location}>{location}</option>)}</select></label>
      <p className={styles.calendarNote}>Demo calendar · Oct 2, 2026<br />This week ends Sunday, Oct 4.</p>
    </div>
  </fieldset>;
}
