import Link from "next/link";
import { Container } from "@/components/layout/container";
import { EventCard } from "@/components/event/event-card";
import { GlobalSearch } from "./global-search";
import { getPopularTopics, searchEvents, searchOrganizations, searchSpeakers, type SearchPage } from "../server/queries";
import { parseSearchParams, searchHref, SEARCH_MAX_PAGE, SearchInputError, type RawSearchParams, type SearchParams, type SearchType } from "../params";
import styles from "./search.module.css";

function Pagination({ page, params, base }: { page: SearchPage<unknown>; params: SearchParams; base: string }) {
  if (page.pages <= 1 && page.page === 1) return null;
  return <nav aria-label="Search result pages" className={styles.pagination}>
    {page.page > 1 && <Link href={searchHref(params, { page: page.page - 1 }, base)}>Previous</Link>}
    <span>Page {page.page} of {Math.max(1, page.pages)}</span>
    {page.page < page.pages && <Link href={searchHref(params, { page: page.page + 1 }, base)}>Next</Link>}
    {page.total > SEARCH_MAX_PAGE * page.pageSize && <span>Showing the first {SEARCH_MAX_PAGE * page.pageSize} matches. Refine your search to see more.</span>}
  </nav>;
}
function Filters({ params, categories, base }: { params: SearchParams; categories: string[]; base: string }) {
  return <form action={base} className={styles.filters} aria-label="Event search filters" key={searchHref(params)}>
    <input type="hidden" name="q" value={params.q} /><input type="hidden" name="type" value={params.type} />
    <label>Category<select name="category" defaultValue={params.category}><option value="">All categories</option>{[...new Set([...categories, ...(params.category ? [params.category] : [])])].map((category) => <option key={category}>{category}</option>)}</select></label>
    <label>Event type<select name="eventType" defaultValue={params.eventType}><option value="">All types</option><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option><option value="HYBRID">Hybrid</option></select></label>
    <label>Date<select name="date" defaultValue={params.date}><option value="upcoming">Upcoming</option><option value="all">All public events</option></select></label>
    <label>City or venue<input type="text" name="location" maxLength={80} defaultValue={params.location} placeholder="Anywhere" /></label>
    {params.type === "events" && <label>Sort by<select name="sort" defaultValue={params.sort}><option value="relevance">Relevance</option><option value="soonest">Soonest</option><option value="newest">Newest</option></select></label>}
    <button type="submit">Apply filters</button><Link href={searchHref(params, { category: "", eventType: "", date: "upcoming", location: "", sort: "relevance", page: 1 }, base)}>Reset filters</Link>
  </form>;
}
function GroupHeader({ label, page, type, params }: { label: string; page: SearchPage<unknown>; type: SearchType; params: SearchParams }) {
  return <header className={styles.groupHeader}><h2 id={`${type}-results`}>{label}<small>{page.total.toLocaleString()} {page.total === 1 ? "match" : "matches"}{type === "speakers" ? " · event appearances" : ""}</small></h2>
    {params.type === "all" && page.total > page.results.length && <Link href={searchHref(params, { type, page: 1 })}>View all {label.toLowerCase()}</Link>}
  </header>;
}
export async function DiscoveryPage({ raw, explore = false }: { raw: RawSearchParams; explore?: boolean }) {
  const base = explore ? "/explore" : "/search";
  let params: SearchParams;
  try { params = parseSearchParams(explore ? { ...raw, type: "events" } : raw); }
  catch (error) { if (!(error instanceof SearchInputError)) throw error; return <main id="main-content" tabIndex={-1} className={styles.page}><Container><h1>Check your search</h1><p role="alert">{error.message}</p><Link href={base}>Start a new search</Link></Container></main>; }
  const now = new Date(), limit = params.type === "all" ? 3 : 12;
  const hasQuery = params.q.length >= 2, browseEvents = !params.q && params.type === "events";
  let events: Awaited<ReturnType<typeof searchEvents>> | null = null, organizations: Awaited<ReturnType<typeof searchOrganizations>> | null = null, speakers: Awaited<ReturnType<typeof searchSpeakers>> | null = null;
  let topics: Awaited<ReturnType<typeof getPopularTopics>> = [], matchingTopics: typeof topics = [], unavailable = false;
  try {
    [topics, matchingTopics, events, organizations, speakers] = await Promise.all([
      getPopularTopics(now), hasQuery && params.type === "all" ? getPopularTopics(now, params.q) : Promise.resolve([]),
      (hasQuery || browseEvents) && ["all", "events"].includes(params.type) ? searchEvents({ ...params, page: params.type === "all" ? 1 : params.page }, now, limit) : Promise.resolve(null),
      hasQuery && ["all", "organizations"].includes(params.type) ? searchOrganizations({ ...params, page: params.type === "all" ? 1 : params.page }, limit) : Promise.resolve(null),
      hasQuery && ["all", "speakers"].includes(params.type) ? searchSpeakers({ ...params, page: params.type === "all" ? 1 : params.page }, now, limit) : Promise.resolve(null),
    ]);
  } catch (error) { console.error("Public search unavailable", { name: error instanceof Error ? error.name : "UnknownError" }); unavailable = true; }
  const total = (events?.total ?? 0) + (organizations?.total ?? 0) + (speakers?.total ?? 0);
  return <main id="main-content" tabIndex={-1} className={styles.page}><Container>
    <header className={styles.intro}><p className={styles.eyebrow}>{explore ? "FOLLOW YOUR CURIOSITY" : "FIND YOUR NEXT CONNECTION"}</p><h1>{explore ? "Explore what’s next." : "Search Nexora."}</h1><p>{explore ? "Discover public events, fresh ideas, and good company." : "Find events, companies, speakers, and topics in one place."}</p></header>
    <GlobalSearch key={`${base}-${searchHref(params)}`} initialQuery={params.q} params={params} base={base} />
    {explore ? <p className={styles.empty}><Link href={searchHref(params, { type: "all", page: 1 })}>Search companies and speakers too →</Link></p> : <nav aria-label="Search result types" className={styles.tabs}>{(["all", "events", "organizations", "speakers"] as const).map((type) => <Link key={type} href={searchHref(params, { type, page: 1 })} aria-current={params.type === type ? "page" : undefined}>{type === "all" ? "All" : type[0].toUpperCase() + type.slice(1)}</Link>)}</nav>}
    {["all", "events", "speakers"].includes(params.type) && <Filters params={params} categories={topics.map((topic) => topic.category)} base={base} />}
    {unavailable ? <p role="status" className={styles.empty}>Search is temporarily unavailable. Please try again shortly.</p> : <>
      {!hasQuery && !browseEvents && <div className={styles.empty}><h2>Where will curiosity take you?</h2><p>Enter at least two characters to search public events, companies, and speakers.</p><Link href="/explore">Explore upcoming events</Link></div>}
      {(hasQuery || browseEvents) && total === 0 && <div className={styles.empty}><h2>No matches {params.q ? `for “${params.q}”` : "with these filters"}</h2><p>Try a broader term, reset your filters, or explore upcoming events.</p><Link href="/explore">Explore events</Link></div>}
      {events && <section className={styles.group} aria-labelledby="events-results"><GroupHeader label="Events" page={events} type="events" params={params} /><div className={styles.grid}>{events.results.map((event) => <EventCard key={event.slug} event={event} />)}</div>{events.total > 0 && events.results.length === 0 && <p>No results on this page. <Link href={searchHref(params, { page: 1 }, base)}>Return to page 1</Link>.</p>}{params.type === "events" && <Pagination page={events} params={params} base={base} />}</section>}
      {organizations && <section className={styles.group} aria-labelledby="organizations-results"><GroupHeader label="Organizations" page={organizations} type="organizations" params={params} /><div className={styles.grid}>{organizations.results.map((organization) => <Link key={organization.slug} href={`/companies/${encodeURIComponent(organization.slug)}`} className={styles.entity}><small>{organization.industry || "Organization"}</small><h3>{organization.name}</h3>{organization.description && <p>{organization.description.slice(0, 180)}{organization.description.length > 180 ? "…" : ""}</p>}<p>{[organization.city, organization.region].filter(Boolean).join(", ")}</p></Link>)}</div>{params.type === "organizations" && <Pagination page={organizations} params={params} base={base} />}</section>}
      {speakers && <section className={styles.group} aria-labelledby="speakers-results"><GroupHeader label="Speakers" page={speakers} type="speakers" params={params} /><div className={styles.grid}>{speakers.results.map((speaker) => <Link key={`${speaker.eventSlug}-${speaker.position}`} href={`/events/${encodeURIComponent(speaker.eventSlug)}#speakers`} className={styles.entity}><small>Speaker</small><h3>{speaker.name}</h3><p>{[speaker.role, speaker.company].filter(Boolean).join(" · ")}</p><p>At {speaker.eventTitle}</p></Link>)}</div>{params.type === "speakers" && <Pagination page={speakers} params={params} base={base} />}</section>}
    </>}
    {(matchingTopics.length > 0 || topics.length > 0) && <section className={styles.group} aria-labelledby="topics-title"><h2 id="topics-title">{matchingTopics.length ? "Matching topics" : "Popular topics"}</h2><div className={styles.topics}>{(matchingTopics.length ? matchingTopics : topics).map((topic) => <Link key={topic.category} href={searchHref(parseSearchParams({ type: "events" }), { category: topic.category })}>{topic.category}<span>{topic.count} upcoming</span></Link>)}</div></section>}
  </Container></main>;
}
