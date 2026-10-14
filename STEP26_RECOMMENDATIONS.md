# Step 26 — Personalized event recommendations

## 1. Files created

- `src/features/recommendations/server/queries.ts`
- `src/features/recommendations/server/scoring.ts`
- `src/features/recommendations/components/recommendation-section.tsx`
- `src/features/recommendations/components/recommendations.module.css`
- `tests/recommendations.test.mjs`
- `tests/recommendations-runtime.mjs`
- `tests/recommendations-browser.mjs`
- `STEP26_RECOMMENDATIONS.md`

## 2. Files changed

- `src/app/(public)/page.tsx`: streamed authenticated recommendation section; original hero, search, category strip, and general discovery retained.
- `src/app/(protected)/dashboard/page.tsx`: three compact recommendation cards alongside existing dashboard sections.
- `src/features/attendees/server/actions.ts`: invalidate the root layout after check-in/undo for recommendation freshness.
- `src/features/tickets/server/actions.ts`: the same invalidation after QR check-in.
- `package.json`: Step 26 unit, Neon, browser, and regression commands.
- `tests/global-search-regression.mjs`: accept Step 26 disposable approval, save reports under Step 26, and include Step 25 runtime/browser suites.
- `tests/reminder-scheduler-runtime.mjs`: confirm server readiness before signup; bounded retries of explicit partial-failure summaries during the live 51-reminder batch, while retaining limit, count consistency, exactly-once, and eventual-drain assertions. Generic errors still fail the test.
- `.gitignore`: retain this report in source control.

## 3–4. Schema/index changes and migration

No schema or index changes. No migration was necessary. Existing indexes cover the query access patterns:

- `Event(status,startAt)` and `Event(category,status,startAt)` for published future/category candidates.
- `Event(organizationId,startAt)` for organization/time candidates.
- Unique `EventBookmark(userId,eventId)` and `EventBookmark(userId,createdAt)` for own saved-event existence/history.
- Unique `EventRegistration(userId,eventId)`, `(userId,status)`, and `(eventId,status)` for prior actions, category signals, and aggregate occupied seats.
- Unique `OrganizationFollower(userId,organizationId)` for follow signals.
- Unique `OrganizationMember(userId,organizationId)` for managed-organization exclusions.

Prisma validation/client generation passed; all 16 existing migrations remain applied. No previous migration was modified.

## 5. Architecture

The authenticated server entry point is `getRecommendedEventsForUser()` with no arguments. It obtains identity from `getAuthorizedUser()`, preserving the current email-verification policy. Anonymous and unverified new accounts receive ordinary homepage discovery.

`loadRecommendedEventsForViewer()` is a trusted server-only database primitive. `getRecommendationSignals()` builds parameterized, user-scoped SQL `EXISTS` expressions; it never materializes full history arrays. `scoreRecommendationCandidate()` applies the documented boolean weights. `selectRecommendationCandidates()` orders and diversifies the bounded pool.

Queries run in a repeatable-read transaction with a 2,500ms local statement timeout and a 15-second transaction timeout. Count/eligibility/selection and final public DTO hydration share the snapshot. Only the final six public events and one reason per event leave the query layer. No recommendation HTTP endpoint or client-supplied identity selector was introduced.

## 6–7. Signals and final scoring weights

| Signal | Weight |
| --- | ---: |
| Followed organization | +50 |
| Same category as an attended event | +30 |
| Same category as a currently registered event | +25 |
| Same category as a saved event | +20 |
| Organization previously joined/attended | +20 |
| Upcoming within 14 days, inclusive | +10 |

Each signal contributes once; repeated history does not multiply points. Category/organization history sources must currently be `PUBLISHED` or `COMPLETED`. Cancelled, waitlisted, and no-show registrations do not supply positive history signals. Only category, organization identity, and product-action state are used; no history title, email, feedback, ticket, session/device/IP signal is used.

Ordering is: within the 90-day horizon first; then descending score; ascending start instant; ascending public slug with binary comparison. Raw scores and signal booleans stay on the server.

## 8. Eligibility and exclusions

Candidates must be `PUBLISHED`, start and end strictly after the query clock, and have no elapsed registration deadline. Finite-capacity events must still have room, using the existing `REGISTERED` + `ATTENDED` occupancy rules. Actual Join actions retain their original locking and final eligibility/capacity validation.

Already bookmarked events are excluded to favor new discoveries; their categories influence other events. Every existing registration row excludes that exact event, including `REGISTERED`, `ATTENDED`, `WAITLISTED`, `CANCELLED`, and `NO_SHOW`. A cancellation removes its positive joined signal but does not automatically recommend the cancelled event again; users can still deliberately rejoin through public discovery.

The viewer’s own authored events and events in organizations they manage as `OWNER`, `ADMIN`, or `EDITOR` are excluded as redundant. Ordinary `MEMBER` membership does not suppress public events.

## 9. Cold start and empty states

If selected candidates have no applicable personal signal, the section is labelled **Upcoming events to explore**, with generic **Upcoming event you can join** reasons. Followed organizations without eligible events do not generate fake personalized explanations. General upcoming timing supplies a truthful fallback.

If no eligible new events remain, the section explains that and links to Explore, joined, and saved collections. Existing signed-out general discovery remains intact. An authenticated database failure gives a safe temporary-unavailability message; authentication failure does not render a personalized surface.

## 10. Explainability

One deterministic reason per event, in this priority order:

1. `Because you follow [public organization name]`
2. `Similar to [category] events you attended`
3. `Similar to [category] events you joined`
4. `Similar to [category] events you saved`
5. `From an organization whose events you joined or attended`
6. `Upcoming event you can join`

Reasons appear as subtle secondary text. They contain public organization/category labels and do not name historical events or reveal a numeric score.

## 11. Diversity

The first selection pass allows at most two events per organization. Independent events are grouped by creator, with the same cap, so one prolific organizer cannot fill every slot when alternatives exist. These private grouping keys never enter UI data.

If the initial horizon cannot fill six diverse slots, the query considers later upcoming events before relaxing the cap. Only after all available alternatives in the bounded pools have been considered are deferred repeats used to fill remaining slots. This deliberate soft cap supports sparse calendars without pretending there are six distinct organizers.

## 12. Homepage/dashboard integration and freshness

Homepage: six standard EventCards in the primary recommendation section. Dashboard: three compact cards. Both reuse the existing card link/Save patterns and bookmark context; event detail owns the existing Join action.

The routes remain dynamic. Recommendations use only React request-scoped memoization. Save/unsave, join/cancel, follow/unfollow, event lifecycle changes, manual attendance, and QR attendance invalidate the relevant routes/root layout; client actions already call `router.refresh()`. There is no training job, polling pipeline, shared user cache, or background tracking.

Explore/global search ranking remains public and unchanged. No optional personalized Explore sort was added.

## 13. Performance

Within the next 90 days, six independently bounded candidate pools are selected before JavaScript scoring:

| Pool | Maximum |
| --- | ---: |
| Followed organization | 60 |
| Attended category | 60 |
| Joined category | 50 |
| Saved category | 50 |
| Prior organization interaction | 40 |
| General upcoming | 40 |
| Total before SQL deduplication | 300 |

Each pool orders by start instant and slug. `UNION` deduplicates candidate identities. If fewer than six diverse picks remain, a second pool considers events later than 90 days with the same 300 cap; maximum combined in-memory candidates is 600. Events inside 90 days retain priority over expansion results.

This prevents a followed organization’s later event from being buried behind a large chronological general feed. SQL performs indexed existence/aggregate checks; no full user history is fetched. Final hydration is bounded to six records. Actual Neon `EXPLAIN (ANALYZE, BUFFERS)` plans and index definitions are saved with the runtime evidence. The crowding fixture query selected 53 candidates and took 6.852ms inside PostgreSQL. This is a small-fixture verification, not a production-scale benchmark.

## 14. Privacy protections

Recommendation logic and weights are `server-only`; no new API accepts `userId`. The session determines identity, including on URLs with a forged `userId` parameter. The response contains only `{mode, results: [{event, reason}]}`, plus safe availability state on failure. Events use the existing public allowlist mapper, whose public `id` is the slug and whose legacy organization identity is empty.

No full history, database identities, raw scores, signal breakdowns, private feedback, invitations, tickets, device information, or IP data are passed as recommendation props. No tracking tables, click/impression events, cookies, analytics, AI, embeddings, external vendors, or recommendation campaigns were introduced. Authentication still uses the existing session mechanism; it is not a recommendation signal.

## 15–18. Verification

The Step 26 Neon suite passed 31 scenario groups, including all 24 requested cases, closed deadlines/full capacity, authored/managed-organization exclusions, ordinary-member eligibility, attendance/undo freshness, public-search separation, and a 350-event crowding scenario. A later high-interest event still ranked first despite those earlier unrelated candidates. Actual SQL candidate counts stayed within the documented cap, and query plans were captured. A future test clock verified a genuinely empty eligible set without modifying business events.

All isolated users, organizations, events, registrations, bookmarks, followers, memberships, auth accounts/sessions, and scoped limiter rows were cleaned. Existing business-table counts and MD5 row fingerprints matched before/after. The shared ephemeral `RateLimit` table is excluded from business fingerprints because normal authentication updates those counters; owned limiter prefixes have scoped cleanup.

The Step 26 browser suite passed 17 checks: signed-in/signed-out homepage, six explanations, session isolation, public event links, keyboard focus/Enter, Save/Unsave, Join/Cancel, Follow/Unfollow, three compact dashboard cards, cold start, 390px and 320px overflow/clickability, sign-out freshness, and no runtime exceptions or nested interactive controls. Screenshots were visually reviewed. Browser fixtures, server processes, and the owned Chrome profile were cleaned; business-table fingerprints matched.

All 150 unit tests passed. All 23 existing runtime suites passed, with 355 recorded scenario groups and 20 separately verified organization-team browser checks. This covers core events/organizations, public routes, participation, following/notifications, event content, attendees, calendar/reminders, tickets, analytics, post-event lifecycle/feedback, team management, transactional email, auth lifecycle, account settings, and public global search/browser discovery.

Some legacy retries encountered test-server startup timing and transient Neon connection/transaction failures. The reminder harness now confirms readiness and retries only explicit, bounded partial-failure batch summaries while requiring eventual exactly-once delivery of all 51 fixture reminders. Generic errors remain failures. One team run's cleanup was interrupted by a connection timeout; exact-run recovery removed only its fixtures and verified the original fingerprints, then a fresh team runtime run passed normal cleanup. The previously completed 20 team browser checks were retained. All remaining retries passed, with no application behavior weakened or business records changed.

| Required check | Result |
| --- | --- |
| All unit suites | 150 passed |
| Existing runtime suites | 23 passed |
| Step 26 Neon scenarios | 31 passed |
| Step 26 browser checks | 17 passed |
| Typecheck | Passed |
| Lint, zero warnings | Passed |
| Production build | Passed |
| Prisma validate | Passed |
| Prisma generate | Passed |
| Database migration status | All 16 current |
| Patch whitespace check | Passed |

Owned test servers and Chrome profiles were cleaned. Existing business-table hashes/counts match the original baselines. No migration was run because no schema/index change was required.

Neon evidence: `artifacts/step26/8c94a632-ade5-4379-8521-a2591c277864/runtime.json`.

Browser evidence: `artifacts/step26/browser-8dcc1ea7-9afa-4871-b707-465734f9b8a4/browser.json`.

Existing regression evidence: `artifacts/step26/final-regression-summary.json`. Exact-run cleanup recovery evidence: `artifacts/step26/team-recovery.json`.

## 19. Release action

Deploy the application changes through the existing Render workflow. There is no new migration, environment variable, key, service, or scheduler configuration to apply. Step 27 is outside this work.
