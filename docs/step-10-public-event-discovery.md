# Step 10 — public event discovery migration

Completed October 2, 2026. Public event discovery and detail now read Neon through a server-only query layer. Existing page layouts, artwork, cards, animations, and styles are retained. No Prisma schema or migration changes were needed.

## 1. Files created

| File | Purpose |
| --- | --- |
| `src/features/events/server/public-event-queries.ts` | Central public database queries and visibility rules |
| `src/features/events/server/public-event-mapper.ts` | Explicit public projection and DTO mapping |
| `src/features/events/data/mock-event-helpers.ts` | Isolated development/design fixture helpers |
| `src/app/(public)/events/[slug]/error.tsx` | Safe database-failure detail UI |
| `tests/public-event-mapper.test.mjs` | Privacy, timezone, fallbacks, preview bounds, and filter tests |
| `tests/public-event-runtime.mjs` | Real Neon tests using normal application forms/actions with cleanup |
| `docs/step-10-public-event-discovery.md` | This implementation and verification report |
| `docs/step10/*.jpg` | Five browser verification screenshots: real Explore, homepage, initial/updated detail, and cancelled URL |

## 2. Files changed

| Area | Files |
| --- | --- |
| Public routes | `src/app/(public)/page.tsx`, `src/app/(public)/explore/page.tsx`, `src/app/(public)/events/[slug]/page.tsx` |
| Shared cards and homepage artwork | `src/components/event/event-card.tsx`, `src/components/event/event-orbit.tsx` |
| Discovery | `src/features/events/components/explore-experience.tsx`, `event-filters.tsx`, `event-search.tsx`, `src/features/events/filter-events.ts` |
| Detail | `src/features/events/components/event-detail-experience.tsx`, `event-detail-hero.tsx`, `event-organizer.tsx`, `event-venue.tsx` |
| Organizer workflow | `src/features/events/components/event-management-page.tsx`, `event-transition-form.tsx`, `event-wizard.tsx`, `src/features/events/server/actions.ts` |
| Types/helpers/fixtures | `src/features/events/types.ts`, `event-helpers.ts`, `data/mock-events.ts`, `data/mock-event-details.ts` |
| Supporting changes | `src/lib/db.ts` (comment only), `package.json` (test scripts), `tests/event-runtime.mjs` (Step 09 public-visibility expectation updated) |

No CSS files, Companies routes, database models, or schema migrations changed.

## 3. Public query layer

All public Prisma access is in `server/public-event-queries.ts`, protected by `server-only`.

- `getPublishedEvents(now)`: the nearest 100 upcoming PUBLISHED events for discovery.
- `getPublishedEventBySlug(slug, now)`: PUBLISHED or COMPLETED only; otherwise null.
- `getUpcomingPublishedEvents(limit, now)`: upcoming PUBLISHED records, ordered by start instant then event ID.
- `getCompletedPublishedEvents(limit, now)`: COMPLETED records or past PUBLISHED records, for future past-event contexts.
- `getFeaturedPublishedEvents(now)`: nearest upcoming PUBLISHED event or null.
- `getRelatedPublishedEvents(event, limit, now)`: ranked upcoming PUBLISHED candidates, excluding the current event.

There is no public status override or preview query parameter. The completed helper is available without adding an archive interface.

## 4. DTO / view model

`publicEventSelect` lists the permitted database fields. `mapPublicEvent` returns the serializable `PublicEvent` UI model: event ID, title, slug, category, ISO start instant, calendar date in the event timezone, formatted time range with timezone, location, event type, organizer identity, summary, About text, generated artwork theme, and public upcoming/completed presentation state.

The legacy `organizationId` UI property is an empty string for database events. Internal organization/user identity and authorization fields do not cross the public boundary. Organizer identity is a dedicated object containing name and optional organization slug, industry, and location. Unknown/missing categories display Other; a valid organization visual theme wins over the category-based fallback.

Full descriptions remain in About. Card summaries and decorative artwork text are bounded to fit the existing layouts. Agenda, speakers, and resources map to empty arrays because the database does not store them.

## 5. Explore

The server loads a bounded set of upcoming PUBLISHED events and passes DTOs plus one server time anchor to the existing client experience. Search includes the real organizer name. Category, type, location, date windows, sorting, filter chips/reset, grid/list controls, local save preview, and empty results remain available. Filters have no Prisma dependency.

Date windows use numeric instants and UTC calendar boundaries. This week ends at the following Monday; this month ends at the first instant of the next month; Later begins there. Display dates/times use each event's stored timezone. Past events do not dominate normal discovery.

## 6. Homepage

Happening Soon loads at most three nearest upcoming PUBLISHED events. Fewer records produce fewer cards. No records produce the discovery/create invitation. The decorative EventOrbit also receives these real events; it retains its ambient artwork when the list is empty. There is no silent mock fallback.

## 7. Detail

`/events/[slug]` uses the public query for both metadata and page content. Unknown or unpublished slugs call `notFound()` with the same generic result. PUBLISHED events that have started, and COMPLETED events, remain accessible and display as completed.

Unavailable agenda/speakers/resources sections and their navigation links are hidden for database events. Venue uses authored location information; missing long venue text is omitted. About has a compact details-coming-soon message only when no description exists. No fictional agenda, speakers, resources, or long organizer biography is attached to real records.

## 8. Draft/cancel visibility

DRAFT, CANCELLED, and ARCHIVED never enter public discovery, related results, detail, or metadata. Query parameters cannot bypass these database predicates. The normal 404 does not disclose an unpublished event's title, organizer, or existence.

## 9. Organizer identity and temporary profile bridge

Organization events display their real Organization name, slug, industry, and location when available. Individual events display only the creator's display name. Names always come from Neon for database events.

Companies remains mock-based. A real organization receives a `/companies/[slug]` link only when a matching existing public company fixture exists. Otherwise, the organizer card shows its real identity without a profile link. No protected management link is exposed publicly. The existing compact card styling is reused without substituting mock profile text.

## 10. Related events / featured selection

Related results use up to 100 upcoming PUBLISHED candidates and rank lexicographically by same category, same organization slug, then absolute distance from the current start instant. Event ID breaks ties. The current event is excluded; at most three are rendered.

No featured field exists in the schema. Explore's featured area deterministically uses the first nearest upcoming published record from the same server-loaded list; the reusable featured helper implements that rule separately. An empty list omits the area. No popularity is fabricated.

## 11. Freshness and invalidation

The three public routes use `dynamic = "force-dynamic"`. Database reads are not placed in a persistent Next cache. The build confirms all three are rendered on demand.

Create, update, publish, and cancel actions invalidate `/`, `/explore`, the exact event URL, and the `/events/[slug]` page pattern. The pattern also refreshes related cards on other detail pages and covers slug changes. Existing organizer/dashboard invalidation remains. Normal event changes need no server restart.

## 12. Fixture retirement

Mock events/details are retained and marked as development/design fixtures. Their lookup helpers moved to `data/mock-event-helpers.ts`. Shared date formatting and filters no longer import event fixtures. Production event discovery, homepage artwork, public detail, and related results do not depend on mock event data. The company profile bridge and Companies' own fixture use remain temporary and explicit.

## 13. Neon and browser results

The final Neon runtime test passed:

- Real organization draft creation and publication through application form actions.
- Real individual direct publication through the normal creation form action.
- Both records visible on Explore and the homepage when eligible; detail returns 200.
- Correct organization/individual identity with no email or internal user/organization ID exposure.
- Draft and unknown slug 404; forged status/preview query parameters remain 404.
- Published edits reflected on detail and Explore immediately.
- Related detail includes the other published event and excludes the unrelated draft.
- Cancellation removes discovery visibility; detail returns 404; cancelled candidates disappear from related results.
- ARCHIVED detail 404; COMPLETED and past PUBLISHED detail 200; these past records do not enter upcoming discovery.

A disposable account was also created in the real browser. The event was authored through all five wizard steps and published, appeared on Explore and Happening Soon, opened with the correct individual organizer, and retained the existing detail design. Organizer search, category/type/location/date filters, sort/list controls, and the empty state were verified. Browser edits appeared immediately; browser cancellation removed the event and produced the generic not-found page. HTTP confirmed 404 with no cancelled title/organizer in the response.

Browser verification revealed an existing preview-to-save button reuse issue that could automatically submit an edit. The Next handler now prevents default activation. The final browser check confirmed that step five waits for the explicit Save changes action.

Runtime fixtures cleaned themselves up. A final scoped audit removed the single browser account and its cancelled event and confirmed no scoped records remained. The interrupted runtime run left no records needing removal. Temporary cleanup code was removed.

## 14. Security and failure handling

Public projections select creator name only, and only public organization display fields. They exclude email, creatorId, organizationId, sessions, accounts, passwords, memberships, roles, and auth data. DTO tests also inspect the projection and output shape. Online meeting URLs are not included in public payloads.

Database errors are logged on the server. Explore/homepage render a safe temporarily-unavailable message; detail has a generic error boundary; metadata emits no private information. No database message is printed in the public UI and no fake records are substituted.

One intermediate run hit the existing five-second database connection timeout. It exercised the safe discovery failure state; the repeat and final runtime tests passed. No connection configuration change was made.

No extra client loading mechanism was added. Public pages resolve on the server and retain the existing lightweight UI.

## 15. Quality checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm run build` | Pass; public event routes are dynamic |
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| `npm run db:status` | Pass; three migrations, schema up to date |
| `npm run test:events` | Pass, 7 tests |
| `npm run test:events:public` | Pass, 5 tests |
| `test:events:public:runtime` against Neon | Pass, all six scenario groups |
| Real browser creation/discovery/edit/cancel | Pass |
| `git diff --check` | Pass |

Runtime tests use a localhost APP_URL (or STEP10_ORIGIN override) matching the running application's configured origin. Network-restricted test environments must allow the configured Neon connection. Runtime tests create disposable fixture records and delete them in finally blocks.

## 16. User action and scope

No user action is required. Public company/profile migration remains a later step. No registration model, bookmark/follow persistence, agenda/speaker/resource model, notification, payment, upload, search engine, analytics, or archive interface was added. Step 11 was not started.
