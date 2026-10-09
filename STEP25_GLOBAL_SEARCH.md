# Step 25 — Global search and discovery

## Implementation

`/search?q=design` searches events, organizations, and event-speaker appearances. The page and suggestions endpoint are dynamic. Search and parameterized Explore URLs have `noindex, follow`; unfiltered Explore and entity pages retain their existing indexing behavior. No search service, AI ranking, analytics tracking, or server/browser search-history store was added.

### Created files

- `src/app/(public)/search/page.tsx`
- `src/app/(public)/search/loading.tsx`
- `src/app/(public)/search/error.tsx`
- `src/app/api/search/suggestions/route.ts`
- `src/features/search/params.ts`
- `src/features/search/server/queries.ts`
- `src/features/search/components/global-search.tsx`
- `src/features/search/components/discovery-page.tsx`
- `src/features/search/components/search.module.css`
- `prisma/migrations/20261009000000_global_search_discovery/migration.sql`
- `tests/global-search.test.mjs`
- `tests/global-search-runtime.mjs`
- `tests/global-search-browser.mjs`
- `tests/global-search-regression.mjs`
- `tests/support/search-regression-cleanup.mjs`
- `STEP25_GLOBAL_SEARCH.md`

### Changed files

- `.gitignore`: retain this report in source control.
- `package.json`: add Step 25 unit, Neon, browser, and regression commands.
- `prisma/schema.prisma`: category/status/start-time index and expression-index documentation.
- `src/app/(public)/explore/page.tsx`: use shared database-backed discovery and URL state.
- `src/app/(public)/page.tsx`: homepage search.
- `src/components/layout/site-header.tsx`: compact desktop search.
- `src/components/layout/site-header.module.css`: bounded search-control width.
- `src/components/layout/mobile-nav.tsx`: mobile search; include its input in existing dialog focus handling.
- `tests/reminder-scheduler-runtime.mjs`: clean Step 23 HMAC buckets for the fixture; compare all business-table fingerprints exactly, with ephemeral limiter activity checked separately; isolate the reminder CLI from server-only preloads.
- `tests/post-event-runtime.mjs`, `tests/organization-team-runtime.mjs`, `tests/transactional-email-runtime.mjs`: keep server-only preload hooks out of browser-controller child processes.
- `tests/post-event-browser.mjs`, `tests/organization-team-browser.mjs`, `tests/transactional-email-browser.mjs`: scope submit selectors to page content so the new header search form does not intercept the test; send a proper native Enter character.

## Public data and query architecture

Server-only `searchEvents`, `searchOrganizations`, `searchSpeakers`, `getSearchSuggestions`, and `getPopularTopics` own all search database access. The UI contains no Prisma calls.

Search matching and ranking run in PostgreSQL using parameterized `Prisma.sql`/`$queryRaw`; LIKE `%`, `_`, and backslash characters are escaped as literal input. Event text and organization-name candidate branches use `UNION` to remain independently indexable, instead of a cross-table OR that can force a scan; duplicate candidate identities are removed inside PostgreSQL. No user-controlled SQL fragments or identifiers are interpolated. Bounded SQL results identify events/organizations by public slug; existing allowlist mappers hydrate only those results inside the same repeatable-read transaction. Speaker SQL selects only name, role, company, public event title/slug, and public position within that event. A speaker repeated across events remains a distinct appearance with its own context; no speaker-profile product was introduced.

| Entity | Searchable authored public fields | Visibility |
| --- | --- | --- |
| Events | title, short description, full description, category, venue/location name, city, region, organization name | Default: upcoming `PUBLISHED`. All dates: `PUBLISHED` and `COMPLETED`, matching public detail access. Never draft, cancelled, or archived. |
| Organizations | name, short name, description, industry, city, region | Existing public organization rules and public DTO allowlist; no private-organization flag currently exists. |
| Speakers | name, role, company, bio | Attached event must satisfy public event visibility and selected event filters. |
| Topics | stored category | Counts from current/upcoming `PUBLISHED` events only; no invented recommendations or time-sensitive “trending” claim. |

User/account email, membership, invitation, attendee, feedback, ticket, session, and private analytics fields are never queried for search or serialized. Existing event cards receive the existing public DTO, whose `id` is a public slug and whose legacy `organizationId` is empty; actual database IDs never leave the server. Event creator display names follow existing intentionally public organizer presentation, with no user-account search entity. Save remains an independent button and the original stretched event-card link is unchanged.

## Ranking

Events: exact title (0), title prefix (1), title substring (2), category substring (3), organization-name substring (4), other authored event text/location (5). Each relevance tier orders upcoming before past, then start time ascending, then unique public slug ascending. Descriptions/location share the final tier. Title matching is case-insensitive, and an input such as `desig` matches `Design`; edit-distance typo correction is intentionally not implemented.

Organizations: exact name, prefix name, name substring, then other public-field matches; ties use lowercased name and unique slug. Speakers: the same name tiers; ties use lowercased name, event start time, event slug, and the existing unique event-local speaker position. Ranking is explicit SQL, not AI scoring.

## Suggestions and keyboard behavior

The shared search component appears in the desktop header, mobile drawer, homepage, Search, and Explore. At least two trimmed characters open lightweight suggestions after a 250ms debounce. Abandoned requests are aborted and stale-query results are hidden. Limits: three events, two organizations, two speaker appearances (seven total), plus a “search for this term” option. Suggestions use upcoming public events, consistent with the default search date filter; full results can switch to all public dates.

Combobox/listbox/option roles, associated labels, active-descendant state, ArrowUp/Down, Enter, Escape, outside click, blur, and visible focus indicators are supported. Active options scroll into view. The suggestion list fits the available visual viewport, flips above the field when useful, and responds to scrolling/resizing and an on-screen keyboard. Enter explicitly opens the selected result or submits the query. Escape closes suggestions and preserves focus/query; in the mobile dialog it closes suggestions before closing navigation. IME composition does not submit. No focus trap is introduced by search; the existing mobile navigation dialog still manages its own focus.

## URL filters, pagination, and Explore

Supported state: `q`, `type=all|events|organizations|speakers`, `category`, `eventType=IN_PERSON|ONLINE|HYBRID`, `date=upcoming|all`, `location`, `sort=relevance|soonest|newest`, and `page`. Search forms, filter forms, type links, and pagination retain URL state; changing filters resets the page. Event filters also constrain the public event context of speaker results; organization matches remain independent of event filters. Category options and topic links come from real event data, and city/venue filtering uses stored public location fields. Soonest is chronological start time; newest is event creation time, each with stable slug ties.

All results have three-item initial groups with accurate counts and View all links. Type-specific results show 12 items per page. Offset pagination is deliberately bounded to 100 pages (1,200 results); callers cannot raise the result limit. A refinement message appears above this cap. Unique tie breakers and repeatable-read transactions keep count/result hydration consistent per request. As with any live offset search, publication/deletion between separate page requests can shift later boundaries; unchanged data has deterministic, duplicate-free pages. Deep arbitrary offsets are rejected rather than scanned.

Explore remains event-specific and defaults to upcoming published events, but uses exactly the same search primitives, cards, filters, sorting, suggestions, and URL persistence. It no longer searches a preloaded 100-event client array. The live routes have one search implementation.

Empty queries show real popular topics and an Explore link; Explore/Events can intentionally browse bounded public event pages. One-character text never triggers an unfiltered search. Zero matches, a single matching group, empty filters, and out-of-range pages are handled without fabricated content.

## Migration and performance

New migration only: `20261009000000_global_search_discovery`. No older migration was changed. It installs `pg_trgm` if needed and adds:

- Partial GIN `Event_public_search_trgm_idx` on the immutable lowercased authored public text expression, for public statuses only.
- GIN `Organization_public_search_trgm_idx` on public organization text.
- GIN `Organization_name_search_trgm_idx` for organization-name event matching.
- GIN `EventSpeaker_public_search_trgm_idx` on authored speaker text.
- B-tree `Event_category_status_startAt_idx` for category/date filtering and topic counts.

Existing `Event(status,startAt)`, `Event(organizationId,startAt)`, unique organization slug, and speaker `(eventId,sortOrder)` indexes are reused. No redundant speaker event-ID or organization-slug index was added. Expression GIN indexes live in SQL because Prisma does not represent these expressions in its schema.

Neon documents native [pg_trgm support](https://neon.com/blog/ten-most-popular-postgres-extensions); PostgreSQL documents [GIN substring matching](https://www.postgresql.org/docs/current/pgtrgm.html). The live database confirmed extension version 1.6, all five new indexes, and successful migration deployment. The final test captured seven `EXPLAIN (ANALYZE, BUFFERS)` plans from the actual application SQL: event/organization/speaker counts and result queries, plus topics. Warm database execution times ranged from 0.057ms to 0.322ms. PostgreSQL chose sequential scans for this tiny fixture dataset (33 events); the independently indexable candidate branches and GIN indexes are ready for larger datasets. These measurements exclude network latency and do not establish production-scale capacity.

Text is capped at 100 characters (filters at 80); duplicate/invalid parameters, control characters, invalid types/sorts/pages, and oversized inputs fail before database access. Literal wildcard escaping prevents wildcard-only scans. All search SQL, including topic queries, has a transaction-local 2,500ms statement timeout; results and offsets are bounded. Suggestions have `Cache-Control: no-store` and friendly 400/503 responses. Failure logging includes error category only, never raw query SQL, credentials, or private data. There is no new IP/history persistence or public login requirement. Existing connection pool limits remain unchanged.

## Verification results

Migration deployment passed; Neon reports all 16 migrations applied and schema up to date. Prisma validation and client generation passed. Typecheck, lint, and production build passed. All 145 unit tests passed, including Step 25 URL/validation/literal-matching tests. Patch formatting checks passed.

The final isolated Neon runtime suite passed 31 scenario groups: all 24 requested verification cases plus wildcard/SQL-looking input, public short description, category/location filtering, real popular topics, sorting, and anonymous no-cache endpoint checks. All disposable users, organizations, events, and attached speakers were removed. Every existing public-schema table had identical before/after record counts and MD5 record fingerprints, including auth, rate-limit, and migration tables.

The final production Chrome suite passed 22 checks. Desktop header widths 1024/1280/1440 fit; header and page suggestions, ArrowUp/Down, Enter, Escape, outside click, focus, grouped counts, View all, pagination, filters, refresh, back/forward, and noindex metadata passed. Event artwork/title/body clicks, organization and speaker links, Save/bookmark, Join, account menu, and Explore passed. At 390×844 and 320×740, both page and mobile-navigation suggestions fit the viewport in both dimensions, filters wrapped, cards were clickable, and no horizontal overflow occurred. No browser runtime exceptions were captured. Screenshots were visually reviewed. Browser fixtures and their registrations, bookmarks, notifications, sessions/accounts, and scoped rate keys were removed; all pre-existing table fingerprints matched.

All 21 existing runtime suites passed, totaling 323 scenario groups. This includes 15 core suites plus reminders, post-event feedback, teams, transactional email, authentication lifecycle, and account security; integrated legacy desktop/mobile browser cases passed as well. Older scripts needed verified fixture accounts under Step 23 policy, browser submit selectors scoped away from the new header form, and server-only preloads isolated from browser/CLI child processes. The reminder cleanup assertion now checks every business table exactly and separately asserts zero owned limiter rows; ordinary temporary authentication-counter updates are documented. No production authentication policy or permission rule was changed. Every regression wrapper verified unchanged business-table fingerprints. Test mail transports blocked real Resend delivery.

Final evidence (generated artifacts stay ignored):

- Neon: `artifacts/step25/4b9ce3d9-2608-426b-a3ae-4fb300ccea0d/runtime.json`
- Production browser and screenshots: `artifacts/step25/browser-3ec86f39-5b05-40a2-86ba-13b043952b5a/`
- All 21 runtime suites: `artifacts/step25/final-regression-summary.json`, with source report paths for each passing result.
- Temporary browser profiles were removed, including the known profile from an earlier failed legacy browser run. Test servers and browsers were stopped.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run build` | Passed, Search and suggestions rendered dynamically |
| `node --test tests/*.test.mjs` | 145/145 passed |
| Existing runtime suites | 21/21 passed; 323 scenario groups |
| `npm run test:search:runtime` | 31 scenario groups passed; seven actual SQL plans; complete cleanup |
| `npm run test:search:browser` | 22 checks passed; complete cleanup |
| `npx prisma validate` | Passed |
| `npx prisma generate` | Passed, client 7.10.0 |
| `npm run db:migrate` | New migration applied successfully |
| `npm run db:status` | All 16 migrations applied; schema up to date |
| `git diff --check` | Passed |

## Release action

Deploy the changed app through the existing Render workflow. The Neon migration is already applied; the normal deployment migration command remains idempotent. No new service, key, scheduler setting, or environment variable is required. Step 26 is outside this change.
