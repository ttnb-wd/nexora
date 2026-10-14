# Step 27 — Saved collections / personal event lists

## 1. Files created

- `prisma/migrations/20261014120000_saved_event_collections/migration.sql`
- `src/features/collections/schemas.ts`
- `src/features/collections/server/service.ts`
- `src/features/collections/server/queries.ts`
- `src/features/collections/server/actions.ts`
- `src/features/collections/components/collection-picker.tsx`
- `src/features/collections/components/collection-management.tsx`
- `src/features/collections/components/saved-navigation.tsx`
- `src/features/collections/components/collections.module.css`
- `src/app/(protected)/dashboard/saved/[collectionId]/page.tsx`
- `tests/collections.test.mjs`
- `tests/collections-runtime.mjs`
- `tests/collections-browser.mjs`
- `STEP27_SAVED_COLLECTIONS.md`

Generated test evidence remains under ignored `artifacts/step27/`.

## 2. Files changed

- `prisma/schema.prisma`: collection models and user/bookmark relations.
- `src/app/(protected)/dashboard/saved/page.tsx`: URL-driven All Saved/Collections views, counts, creation, and paging.
- `src/components/event/event-card.tsx`: subtle management control for authenticated saved database events; existing stretched event link remains intact.
- `src/features/events/components/event-registration-panel.tsx`: desktop detail picker.
- `src/features/events/components/event-detail-experience.tsx` and `event-detail.module.css`: mobile detail picker above the event sections.
- `src/features/participation/components/bookmark-provider.tsx`: expose the existing authenticated flag through the bookmark hook.
- `src/features/participation/components/personal-event-list.tsx`: manage retained non-public saved events without linking them publicly.
- `src/features/participation/server/service.ts`: document transactional membership cascade on Unsave.
- `src/features/participation/server/actions.ts`: invalidate collection detail routes after participation changes.
- `tests/global-search-regression.mjs`: Step 27 approval/report location and Step 26 runtime/browser coverage.
- `package.json`: collection unit/runtime/browser/regression scripts.
- `.gitignore`: retain this report in source control.

## 3. Schema changes

`EventCollection` has a stable private CUID, one owning user, display name, canonical normalized name, and timestamps. Names use `VARCHAR(60)`; normalized names allow case-fold expansion. PostgreSQL supplies `lower(name)` through a parameterized query. Names are trimmed, 1–60 Unicode characters, and cannot contain control characters. Internal whitespace and Unicode compatibility variants are not folded.

The database checks that names are nonempty, bounded and trimmed, and that `normalizedName = lower(name)`. A unique `(userId, normalizedName)` constraint prevents case-insensitive duplicate names per owner. Unique `(id, userId)` supports the ownership foreign key; the owner/name index already supports owner-scoped lists and counts.

`EventCollectionMembership` has an identity, collection, owner, event, and creation timestamp. Unique `(collectionId, eventId)` prevents duplicates. Composite foreign keys enforce both invariants in PostgreSQL:

- `(collectionId, userId)` references the same owner's collection.
- `(userId, eventId)` references an existing bookmark for that owner/event.

Both references cascade on deletion. An index on `(userId, eventId)` supports bookmark-deletion cascades and membership reads. The collection/event unique index supports collection counts and membership lookup. No event, registration, public DTO, or recommendation model was changed.

## 4. Migration result

The new `20261014120000_saved_event_collections` migration applied successfully to Neon. All 17 migrations are current. No older migration was edited and no existing bookmark was converted or moved. Original business-table counts and MD5 fingerprints matched before/after migration. Migration metadata and the new empty tables are intentionally separate from that business-data comparison.

Evidence: `artifacts/step27/migration-verification.json`.

## 5. Collection architecture

The server-only service derives identity from `getAuthorizedUser()` inside every mutation. Authenticated query wrappers use `requireUser()` or the same authorization guard. UI actions accept names, private collection identifiers, and public event slugs; no client `userId` is accepted.

Collections organize bookmarks. An event may have zero, one, or several memberships. Only owned collection summaries and the selected identifiers for one event are returned to the private picker. Owner identities, normalized names, bookmark identities, and database event identities remain on the server.

## 6. Existing bookmark compatibility

`EventBookmark` remains the Saved source of truth. Save still creates only the bookmark, with no collection prompt required. All previous bookmarks appear under All Saved and can stay uncollected. The existing saved-event query remains available for dashboard summaries and legacy callers.

Existing bookmarks for events later cancelled, archived, or unpublished can be privately organized. Their public visibility/link rules remain unchanged. Newly saving through a collection follows existing Save eligibility: `PUBLISHED` or `COMPLETED` only.

## 7. Create / rename / delete

Create and rename validate trimmed names and use PostgreSQL's canonical case comparison. `Work` and ` work ` collide for the same owner. Mutations serialize on the owner's row, enforcing a maximum of 50 collections even under concurrent creates. Duplicate names return clear errors; database constraints provide the final protection.

Rename preserves the identifier and URL. Delete requires explicit confirmation in a labelled native dialog, with Cancel initially focused and Escape cancelling. Deletion cascades only collection memberships, leaving all event bookmarks saved. Missing or foreign collections return the same unavailable response rather than revealing ownership.

## 8. Membership behavior

The picker applies the complete selected set of up to 50 owned collection identifiers for one event. It validates every requested collection before writing, adds only missing memberships, and removes only deselected memberships. Empty selection removes memberships without deleting an existing bookmark.

Selecting a collection for an unsaved public event upserts its bookmark and creates membership in the same transaction. A real injected transaction failure verified that both roll back together. Empty selection on an unsaved public event does not force Save and reports that accurately; an ineligible event without an own retained bookmark is rejected even for empty selection. Inline creation creates an empty collection immediately and selects it locally; Apply changes commits event membership.

## 9. Unsave behavior

The existing event-row-locked Unsave transaction deletes the owner's bookmark. The composite bookmark foreign key cascades all of that owner's memberships for the event in the same transaction. Other users' bookmarks/memberships are unaffected. No orphan membership can exist in PostgreSQL.

## 10. Ownership and privacy

Reads, writes, collection detail routes, and lazy picker actions are session-scoped. Forged identity fields are rejected by strict schemas; identity query parameters cannot change the viewer. Anonymous and unverified new accounts cannot mutate collections. Foreign detail routes return a generic 404 to authenticated viewers, with no private name in the response.

No public collection endpoint, sharing URL product, collaboration, follower system, tracking, or social functionality was introduced. Public event/search DTOs and initial public event HTML contain no collection names or membership data. The authenticated picker fetches personal data only after opening. Private routes are dynamic and noindex; no shared personalized cache was added.

## 11. Concurrency and idempotency

Collection CRUD uses a per-owner row lock for cap/name consistency. Membership updates lock the event first, matching existing participation writes, then the owner. Unsave and membership updates therefore serialize: whichever commits last leaves either a saved bookmark with its selected memberships or neither. Both outcomes are valid; an orphan is impossible.

Unique constraints protect simultaneous normalized creates and repeated membership inserts. Repeated adds/removals are safe. Transactions use Read Committed, a 10-second acquisition bound, and a 15-second transaction timeout. Failures return safe messages without database/private details.

## 12. Dashboard and routes

- `/dashboard/saved`: All Saved, including uncollected bookmarks.
- `/dashboard/saved?view=collections`: owned collection counts and creation.
- `/dashboard/saved/[collectionId]`: private collection detail, rename/delete, event cards, and picker-based removal.

Views and page numbers survive refresh and back/forward navigation. Private collection links grant no access to another user. All Saved/detail event pages fetch 24 rows, ordered by bookmark creation descending and identifier ascending. Offset pagination is used for the existing dashboard architecture, bounded to page 10,000; membership itself has no event-count cap.

Collections lists fetch at most 50 summaries with aggregate counts, without loading their events. Event grids do not query memberships per card. A picker uses scoped, bounded collection/bookmark reads only when opened, and refreshes its counts after successful Apply.

## 13. Collection picker UX

Save remains primary. Saved event cards show a separate small Manage collections control. Detail pages also offer Add to collection before saving, with desktop and mobile placements. Picker controls sit above the existing stretched card link; image/title/body navigation and Save remain independent.

Native modal dialogs provide labelled headings, focus containment, checked native checkbox semantics, Escape, Close, and outside dismissal. Focus returns to the trigger; if removing the final collection row unmounts its open picker, focus moves to the page's main content. Loading, pending, success and error states are explicit. Selections are local drafts; database state changes only after successful server actions. The narrow layout wraps inputs/actions and scrolls within the viewport.

## 14. Recommendation / search regressions

Step 26 continues to exclude saved events through `EventBookmark`. Collection membership supplies no scoring signal. Real-Neon comparison verified unchanged recommendations before/after organizing an already-saved event.

Global search, Explore ranking, and public event mappers are unchanged. Public search/event DTO tests verify no collection data. Existing card navigation, Save/Unsave, Join/Cancel, account menu, recommendations, and discovery are included in browser/regression verification.

## 15. Neon runtime results

All 31 Step 27 scenario groups passed, including the 24 requested cases, empty-selection/no-forced-save safety, strict/session-based ownership denial, database ownership/name constraints, injected rollback, privately retained non-public bookmarks, stable 24-row pagination, and a concurrent 50-collection cap test.

Evidence: `artifacts/step27/runtime-fc6a1757-cc2b-4698-86e9-b90a7bddac5d/runtime.json`.

## 16. Browser results

All 42 Step 27 browser checks passed at desktop 1440px, 390px, and 320px. Each viewport exercised Save, picker loading/empty state, inline creation, two collection memberships, removing one while staying Saved, All Saved, counts, collection detail, final-row removal/empty state and focus fallback, event-detail management, rename, delete confirmation/Escape, deletion retaining bookmarks, card navigation, outside dismissal, and no horizontal overflow.

Additional checks covered anonymous/foreign route privacy, atomic save-plus-add on an unsaved detail event, Unsave cascades, Join/Cancel, Explore/Search keyboard links, public event HTML, forged identity parameters, recommendation exclusions, signed-out discovery, and zero runtime exceptions. Desktop and mobile screenshots were visually reviewed.

Evidence: `artifacts/step27/browser-b55827b6-25d9-4088-b3a8-68c0c83a6b10/browser.json`.

## 17. Cleanup

Migration, runtime, browser and all existing regression fixtures were isolated. Users, credential accounts/sessions, events, bookmarks, memberships, collections and scoped limiter rows were removed. Owned test servers/Chrome profiles were cleaned; no owned verification server remained running at the final process check. All original business-table fingerprints matched. The shared ephemeral RateLimit table is excluded from business fingerprints because normal authentication updates it; each owned raw limiter prefix has scoped cleanup.

## 18. Quality checks

All 25 existing regression suites passed, recording 424 scenario groups. This includes the 15 core runtime suites; dedicated reminder/post-event/team/email/auth/account suites; global search runtime/browser suites; and Step 26 recommendation runtime/browser suites. Search, Explore, event detail/card navigation, Save/Unsave, Join/Cancel, account menu, mobile navigation, recommendations, and security/privacy checks passed.

| Check | Result |
| --- | --- |
| All unit suites | 153 passed |
| Step 27 Neon runtime | 31 scenario groups passed |
| Step 27 browser | 42 checks passed; desktop, 390px, 320px |
| All existing regressions | 25 suites / 424 scenario groups passed |
| Typecheck | Passed |
| Lint | Passed with zero warnings |
| Production build | Passed |
| Prisma validate | Passed |
| Prisma generate | Passed, client 7.10.0 |
| Database migration deployment | New migration applied successfully |
| Database migration status | All 17 current |
| Patch whitespace check | Passed |
| Fixture cleanup / business fingerprints | Verified unchanged |

Final evidence: `artifacts/step27/final-verification-summary.json`. Full existing-regression evidence: `artifacts/step27/regression-235f0b48-dfa9-465b-b87e-eb86abf737e8/regression.json`. Unit output: `artifacts/step27/unit-tests.log`.

## 19. Action required

Deploy the application through the existing Render workflow. This Neon database already has the migration; any other environment needs `npm run db:migrate` before running the new application. There are no new secrets, services or scheduler settings. Step 28 is outside this work.
