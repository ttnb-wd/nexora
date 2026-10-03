# Nexora

Event discovery and knowledge-sharing platform. This foundation contains only a minimal homepage and reserved folders for future development.

## Local development

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
```

Run `npm start` to serve the production build.

## Architecture

- Next.js App Router with TypeScript and Tailwind CSS; `@/*` resolves to `src/*`.
- The homepage is a Server Component in `src/app/(public)`; its URL remains `/`.
- `src/app` owns routes and layouts; `src/features` reserves feature-specific code.
- `src/components` reserves shared UI; `src/lib/utils.ts` provides `cn()`.
- `src/services` reserves business logic; future Server Actions and Route Handlers will act as entry points, allowing a separate API to be extracted later.
- Empty directories have `.gitkeep` files; they do not expose routes.
- System fonts keep builds independent of external font downloads.
- shadcn/ui components and configuration are deferred until a component is needed.

Database, authentication, event features, and integrations are deferred.

## Ticket QR links and local phone testing

`APP_URL` remains the Better Auth origin. Optional `PUBLIC_APP_URL` controls
user-facing ticket QR and calendar event links, falling back to `APP_URL` when
unset. Use an origin without a path, query, fragment, or credentials. Production
requires the real deployed HTTPS Nexora domain. Invalid configured values fail
closed; they do not silently fall back to localhost.

To scan from a phone on the same Wi-Fi:

1. Run `ipconfig` on Windows and find the active Wi-Fi/Ethernet adapter’s IPv4 address.
2. In `.env.local`, set `PUBLIC_APP_URL=http://192.168.1.50:3000`, replacing the sample address with your PC’s IPv4 address. Leave `APP_URL` at its existing authentication origin.
3. Restart with `npm run dev -- --hostname 0.0.0.0`.
4. Open `http://192.168.1.50:3000/explore` on the phone, using your actual PC address. If unreachable, check the Windows firewall’s private-network permission for Node and Wi-Fi client isolation.
5. Reopen View ticket on the PC to generate a QR with the new origin, then scan it on the phone. Previously printed localhost QRs do not change automatically.

Never hardcode a LAN IP in source code. QR generation logs a development warning
when its selected origin is loopback. LAN binding does not change Better Auth’s
trusted origins: sign-in and authenticated actions still use the configured auth
origin. Phone testing here verifies QR reachability; use the deployed HTTPS origin
for the full authenticated phone flow. Camera scanning may require HTTPS; organizer
manual token/URL entry remains available.

QRs keep the opaque credential in the URL fragment, out of requests and referrers.
New QRs also carry a public event slug so the landing page can show the event name.
The landing page reports “awaiting organizer verification”; it does not expose
attendee identity or validate/mutate attendance. An organizer check-in link appears
only for an authenticated event manager. Legacy fragment-only QRs remain valid;
their landing page shows generic event-ticket guidance.

## Private organizer analytics (Step 18)

Event analytics: `/organizer/[organizationSlug]/events/[eventId]/analytics`.
Individual creators: `/dashboard/events/[eventId]/analytics`.
Organization analytics: `/organizer/[organizationSlug]/analytics`.
OWNER, ADMIN and EDITOR can read analytics; MEMBER is denied consistently.
An individual creator can read only their own individual event. Every query
resolves the authenticated actor and checks persisted access in a repeatable-read
transaction before aggregates. Pages render dynamically, do not persist an
analytics cache, and show when data was read. Reload for current operational counts.
No tracking, new cookies, external analytics, reports or background jobs are added.

Event KPIs are lifetime current-record totals. Registration records includes all
statuses; Registered counts REGISTERED, Attended counts ATTENDED and Cancelled
counts CANCELLED. Optional WAITLISTED/NO_SHOW rows appear when records exist.
Attendance rate is `ATTENDED / (REGISTERED + ATTENDED)`; zero eligible registrations
shows Not available. Occupied seats uses REGISTERED + ATTENDED, remaining seats
is max(0, capacity - occupied), and utilization is occupied / capacity. Null
capacity shows Unlimited rather than a percentage.

Saved means current bookmarks. Reminders enabled counts enabled preferences only
for users currently REGISTERED for the event; it is not a delivery count. Tickets
issued counts active REGISTERED/ATTENDED records with a persisted issuance time
and credential hash; no credentials are selected or displayed. Check-ins recorded
counts ATTENDED records with checkedInAt, so it can differ from legacy attendance.

Event date presets change only the registration trend. The trend groups the first
EventRegistration.createdAt in the event timezone, daily for 30/90 days and monthly
for All time. It includes cancelled records, does not invent a new registration
when an existing row is rejoined, and adds records before the window as the
cumulative opening balance. Only periods containing first registrations are
plotted, with exact values available in an accessible table. Trend SQL is typed
and parameterized; it never loads individual registration rows into application
memory.

Organization KPIs cover only its PUBLISHED and COMPLETED event records. Published
events includes both statuses; Upcoming is PUBLISHED with startAt in the future;
Completed is COMPLETED or PUBLISHED with endAt already passed. Draft, CANCELLED
and ARCHIVED event records are excluded because publication history is not stored.
Last 30/90 days filters event startAt from the rolling cutoff through now; All time
includes future events. Registration and save counts are current lifetime totals
for the selected events, not activity performed within the date window. Current
followers are organization-wide and unaffected by this filter. Average attendance
rate is an equal-weight mean of completed-event rates with nonzero eligible
registrations; empty denominators are omitted. Recent performance lists at most
10 most recently scheduled events. Follower context counts distinct current
followers with a REGISTERED/ATTENDED place in those events, without identities or
an invented conversion rate.

Counts use Prisma COUNT/GROUP BY and bounded event projections. PostgreSQL computes
the completed-event mean and registration trend. `analytics_query_indexes` adds
only EventRegistration(eventId, createdAt). Existing event/status, bookmark/event,
reminder/event/enabled, follower/organization and organization/startAt indexes
already cover the other access patterns. No previous migration is modified.

Run `npm run test:analytics` for unit regressions. Neon tests require explicit
approval and `STEP18_DISPOSABLE_APPROVED=1` before `npm run test:analytics:runtime`.
They create isolated fixtures, remove them, and verify existing records unchanged.
To retain fixtures for browser verification, also set STEP18_BROWSER_HOLD=1, run
isolated headless Chrome with remote debugging on port 9334 and a temporary profile,
then run `node tests/analytics-browser.mjs`. The browser test releases the runtime
fixtures in its finally block. Runtime hold expires after 20 minutes even if the
browser test never starts. For the full approved runtime suite set
NEXORA_DISPOSABLE_APPROVED=1 and STEP18_DISPOSABLE_APPROVED=1 before npm run test:runtime.
Use a separate test-server port and temporary APP_URL environment override if an
older localhost server is already running; no .env edit is needed.

## Scheduled in-app reminders (Step 19)

Enabled preferences deliver EVENT_REMINDER notifications only for REGISTERED
attendees of upcoming PUBLISHED events. PostgreSQL's clock and stored UTC startAt
control scheduling; timezone is display-only. Supported offsets are 15 minutes,
30 minutes, 1 hour and 1 day. Notifications use the existing inbox and unread count,
with title "Event starts soon", the configured offset in the message, and an
/events/[slug] link. Polling can deliver slightly after the exact due instant;
missed reminders are never delivered after the event has started.

POST /api/internal/reminders/run is server-only and requires Authorization:
Bearer <CRON_SECRET>. Configure an independent random secret with at least 32
bytes of entropy on the server and scheduled caller. An unset/short/whitespace
secret disables the job (503). Missing/wrong credentials return 401; GET cannot
mutate (405). SHA-256 digests are compared using timingSafeEqual. Requests must
have no body or query parameters: clients cannot select users/events, override
server time, or increase the batch. Secrets never enter public env variables,
responses or logs. Responses contain processed, delivered, skipped and failed
counts only; partial failures return 503 so the caller can retry safely.

Each invocation selects at most 50 eligible, undelivered preferences ordered by
due time then preference id. The query restricts event startAt to the next day
and uses existing Event(status,startAt), reminder(eventId,enabled), registration
unique(userId,eventId), and Notification(dedupeKey) indexes. No schema change or
migration is needed. Per-candidate transactions lock the parent event before
re-reading eligibility. Notification creation is atomic: its unique dedupeKey
is itself the persistent delivery record (reminder:preferenceId:startAtEpochMs).
Concurrent attempts use skipDuplicates. Reading the notification preserves this
record. Off/on toggles, offset edits and cancel/rejoin do not resend a delivered
reminder for the same event start. Rescheduling startAt creates a new occurrence.
Rejoin continues to leave the preference Off until the attendee explicitly sets
it again. Disabling/cancellation before processing prevents delivery; it does not
retract a notification already delivered. Failures leave no new delivery record.

For local development, configure CRON_SECRET in .env.local, restart the server,
and run npm run reminders:run while the server is running. The command calls the
same secure endpoint at APP_URL; it contains no duplicate scheduler logic and
does not use the LAN/public ticket URL. It refuses redirects and non-HTTPS remote
origins to protect the bearer token. This command performs real writes: use it
only when reminder delivery against the configured database is intended.

For deployment, arrange an existing scheduled HTTP caller to POST to the deployed
HTTPS endpoint every minute with the bearer header and no body/query. Store the
secret in that caller's secret configuration, not a committed URL or cron command.
Use a 65-second caller timeout, avoid overlapping runs where practical, and retry
non-2xx responses with bounded backoff. Each call drains up to 50; monitor summary
counts and call again for a sustained backlog. The route allows 60 seconds; verify
that the hosting plan supports that runtime. A scheduler that only sends GET
requires a secure POST adapter; this endpoint intentionally does not enable GET
mutation. No external scheduler or infrastructure is provisioned in this step.

Run npm run test:reminders for isolated in-memory scheduler/security tests and
node tests/reminder-scheduler-readonly.mjs for PostgreSQL-enforced read-only SQL,
query plan and SQL/JavaScript delivery-key parity checks. Real delivery,
PostgreSQL concurrency, notification UI and cleanup verification require explicit
disposable-data approval. Never run the mutation-based runtime suites without it.
The processor also stops starting new transactions after a 40-second soft work
budget, leaving remaining candidates for the next invocation. processed counts
only attempted candidates; delivered + skipped + failed equals processed.

Step 19 real-write verification is available as npm run test:reminders:runtime.
It requires explicit approval and STEP19_DISPOSABLE_APPROVED=1. The suite launches
its own local production server on 127.0.0.1:3003 with an ephemeral CRON_SECRET,
checks that no business reminder can become due during testing, creates unique
step19-runtime-test fixtures, exercises the real endpoint/runner/inbox, and cleans
up in finally. It compares hashes/counts of every public table and schema metadata
before/after. The batch test uses 51 due preferences (plus five ineligible cases),
not hundreds of records. Three concurrency rounds hold only a disposable event
lock to force both HTTP jobs to overlap. Failure safety injects a division-by-zero
query inside one disposable delivery transaction; it never changes schema.
Run npm run build first. The existing dev server and saved env files are untouched.
Run ledgers and sanitized server logs are saved under artifacts/step19/real-world-*.
