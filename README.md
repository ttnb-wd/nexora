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
