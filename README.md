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
Attendance rate is `ATTENDED / (REGISTERED + ATTENDED + NO_SHOW)`; zero eligible registrations
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

Vercel deployment uses GET /api/cron/reminders, a server-only adapter importing the
same processor directly with the same constant-time bearer validation. vercel.json
selects */5 * * * * (every five minutes). The existing POST endpoint remains the
fallback for another trusted scheduled HTTP caller. Both routes reject query
parameters, return only counts and use no-store. Each call drains up to 50 within
the work budget; monitor failed counts/backlogs. Neither route accepts caller time
or recipient input. No external infrastructure is provisioned by this repository.

### Vercel deployment setup

1. Import the Nexora Git repository into Vercel using the Next.js preset, repository
   root, npm install and npm run build. Select the intended production branch and
   HTTPS domain. Do not replace existing project settings with test-server values.
2. In the project dashboard, Settings → Environment Variables, select Production.
   Add DATABASE_URL (runtime pooled Neon URL), AUTH_SECRET, APP_URL and optionally
   PUBLIC_APP_URL. Use your real HTTPS origin for APP_URL and PUBLIC_APP_URL, e.g.
   https://nexora.example.com (example only). APP_URL remains Better Auth's origin;
   PUBLIC_APP_URL controls absolute QR/calendar links and falls back to APP_URL.
   Notification hrefs stay relative /events/[slug]. Store database/auth values as
   Secrets. DIRECT_URL is only needed by tooling using prisma.config.ts, such as
   db:status or migration deployment; runtime never uses it. No new migration is
   required for this wiring. If your deployment tooling runs those commands, supply
   DIRECT_URL there. Do not put credentials in NEXT_PUBLIC_ variables.
3. Generate an independent production CRON_SECRET yourself on your Windows PC.
   This PowerShell command works with Windows PowerShell 5.1 and PowerShell 7:

   ```powershell
   $reminderSecretBytes = New-Object byte[] 32
   $reminderSecretRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   try {
     $reminderSecretRng.GetBytes($reminderSecretBytes)
     [BitConverter]::ToString($reminderSecretBytes).Replace('-', '').ToLowerInvariant()
   } finally {
     $reminderSecretRng.Dispose()
     [Array]::Clear($reminderSecretBytes, 0, $reminderSecretBytes.Length)
   }
   ```

   Paste the generated value into CRON_SECRET with Type=Secret (the former
   Sensitive setting), target Production, and Save. Keep the value out of Git,
   shared logs and screenshots. The app requires at least 32 characters; this
   command generates 64 hex characters from 32 random bytes. No actual production
   secret is generated or committed by this step. Vercel's current UI terminology
   is documented in [environment variable types](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
4. Redeploy Production with these environment variables and vercel.json. Use
   Settings → Cron Jobs to confirm /api/cron/reminders with */5 * * * * is enabled.
   Vercel supplies the bearer header using CRON_SECRET. Cron registration belongs
   to production deployment; local/preview HTTP tests do not prove registration.
5. Use Cron Jobs → View Log to inspect invocation status and the four safe counts.
   Confirm the next scheduled execution succeeds. Vercel does not automatically
   retry failures; the next scheduled tick can retry an undelivered occurrence
   while its event remains upcoming. These controls and authentication are covered
   by [Vercel's cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
6. For final deployed verification, use a disposable attendee/event/registration
   with a due, enabled reminder. Wait for a real scheduled tick, check the reminder
   in that attendee's inbox and unread count, then remove only those fixtures.
   Never use existing business records as test data. Check QR/calendar links use
   the HTTPS deployment domain and the notification links resolve to the event.

The configured five-minute schedule requires a supported Vercel plan. Hobby allows
only daily cron jobs and rejects more frequent schedules at deployment; Pro and
Enterprise support minute-level schedules. Your actual project plan has not been
inspected. Daily delivery is unacceptable for 15-minute reminders; do not downgrade
the schedule or change reminder offsets. See [current Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
Under normal execution, five-minute polling can deliver up to about five minutes
after the requested reminder instant; platform delays or backlogs can add latency.
Verify that your plan supports the 60-second function limit and monitor counts.

For an external scheduled caller (such as an existing Render Cron or GitHub Actions
workflow), the generic contract remains:

```http
POST https://nexora.example.com/api/internal/reminders/run
Authorization: Bearer <CRON_SECRET>
```

The body is empty (Content-Length: 0 is valid); no query parameters. Store the token
in the caller's secret configuration, call every five minutes or faster, and use
a 65-second timeout plus bounded retries for non-2xx responses. No provider is
provisioned. If using Vercel Hobby with an external caller, remove only the Vercel
crons entry for that deployment to avoid its unsupported-cadence deployment error;
preserve unrelated vercel.json settings and retain the five-minute external cadence.

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

## Step 20: post-event lifecycle and private feedback

Completion is manual. OWNER, ADMIN and EDITOR can complete their organization's
PUBLISHED event after its database end time; an individual creator can complete
only their own event. Event management requires an explicit confirmation after
check-ins have been reviewed. CANCELLED, ARCHIVED and future events cannot complete.
A parent-event row lock and one transaction finalize attendance and event status.
ATTENDED and CANCELLED are preserved; unchecked REGISTERED becomes NO_SHOW.
Attendance is then read-only. Existing public resources and completed-event resource
management remain available. Reminders are disabled at completion. No completion
notifications, email surveys, automatic completion or public ratings are added.

Only a session-authenticated ATTENDED user on a database-COMPLETED event can submit
or edit their single response. Ratings are integers 1–5; optional comments are
trimmed and limited to 1000 characters, with whitespace-only input rejected.
The event page contains a separate post-event feedback section; no-show users see
“Not checked in” and retain public resource access. Organizers see aggregates and
anonymous, escaped comments on the event management Feedback page. MEMBER and
unrelated users cannot access that page. Emails and identity/ticket fields are not
selected for feedback insights. Comment pages contain at most 20 entries.

Attendance rate = ATTENDED / (REGISTERED + ATTENDED + NO_SHOW).
Feedback response rate = responses / ATTENDED. Zero denominators display
Not available. Capacity calculations still use only REGISTERED + ATTENDED.
The new post_event_feedback migration adds EventFeedback, cascading relations,
unique (eventId, userId), database rating/comment checks, a userId relation index,
and (eventId, createdAt, id) for scoped comment pagination. Older migrations remain
unchanged. Deploy with the existing Render/Neon setup and run `npm run db:migrate`
before serving the new code; cron-job.org continues to run the secure Step 19 POST.

Run `npm run test:post-event` for focused unit tests. The real Neon/browser suite
requires explicit disposable-write authorization and
`$env:STEP20_DISPOSABLE_APPROVED='1'; npm run test:post-event:runtime`.
It starts an isolated production server and headless Chrome, creates uniquely
prefixed fixtures, and cleans them in finally. Cookies stay in memory. Artifacts
under artifacts/step20 record exact created/cleaned counts and business-table
before/after hashes (ephemeral authentication rate-limit maintenance is excluded). Do not run mutating suites simultaneously.
