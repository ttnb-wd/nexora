# Step 07: authentication and database foundation

Public events and organizations still use the approved mock fixtures. Database models are a separate persistence foundation; nothing seeds or migrates public fixtures automatically.

## Library and version decisions

- Better Auth 1.7.7 supports Next.js 16 App Router, Prisma, email/password credentials, database sessions, and server session retrieval. Its default salted scrypt hashing handles passwords; Nexora does not implement cryptography.
- Prisma 7.10.0 is the current stable compatible major. The registry's `latest` tag points to Prisma 8.0.0-rc.19, a prerelease outside Better Auth's declared Prisma peer range.
- Prisma 7 uses `prisma.config.ts`, the `prisma-client` generator, and the PostgreSQL driver adapter. Generated source lives under ignored `src/generated/prisma` and is recreated by `postinstall` or `npm run db:generate`.
- Scoped overrides pin patched `deepmerge-ts` and `mysql2` dependencies of Prisma's CLI. These fix npm advisories without changing Prisma's major version; the application database remains PostgreSQL.

References: https://better-auth.com/docs/integrations/next, https://better-auth.com/docs/authentication/email-password, https://better-auth.com/docs/adapters/prisma, https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7

## Environment and setup

1. Copy `.env.example` to `.env.local` and fill in the three values. All real `.env*` files are ignored; only `.env.example` is allowed in version control.
2. Supply a real PostgreSQL `DATABASE_URL`. Provisioning a hosted database is outside this change. Prisma CLI loads Next.js environment files using `@next/env`, so `.env.local` works for CLI and application alike.
3. Generate a secret privately with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and put it in `AUTH_SECRET`. Do not commit or share it. Keep the same secret across application instances.
4. Set `APP_URL` to the exact application origin, for example `http://localhost:3000`; it must match the port used for local auth tests. Production requires an HTTPS origin. No `NEXT_PUBLIC_` secret variables are used.
5. Run `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:status`.
6. Run the app and complete the runtime checklist below. Configure the deployment proxy to supply trustworthy client IP headers for Better Auth's rate limiting.

The SQL migration `20261002000000_init_auth_and_core_domain` was generated offline from the PostgreSQL schema. An offline SQL file is not evidence that any database was migrated. No database URL or auth secret existed when this step was implemented.

Without a configured environment, public mock pages remain available. Session retrieval returns null, protected dashboard access redirects to `/sign-in`, and valid credential submissions return a safe service-unavailable message. There is no mock authentication or development bypass.

## Models and deletion policy

- `User`: unique normalized email, display name, optional image, auth verification flag, timestamps.
- `Session`: unique token, expiration, user relation, optional IP/user agent; deletion cascades with the user.
- `Account`: auth provider identity and optional credential hash; unique `(providerId, accountId)`; deletion cascades with the user. Optional provider token columns are Better Auth's core schema, not enabled social login.
- `Verification`: required auth-library core storage; email verification/reset workflows remain unconfigured and unexposed.
- `RateLimit`: database-backed request limits shared across app instances.
- `Organization`: unique slug and core identity/location/theme fields. Presentation paragraphs, team previews, and topics stay in mock data.
- `OrganizationMember`: unique `(userId, organizationId)`, database-derived `OWNER/ADMIN/EDITOR/MEMBER` role, timestamps. Removing either parent cascades membership rows. The future account/organization deletion workflow must handle owner transfer before deleting an owner; no deletion endpoint is exposed now.
- `Event`: unique slug; required creating user; optional organization for individual events; timezone and timestamp fields; event type/status enums. Creator and organization deletion are restricted when events reference them, preserving event attribution until an explicit deletion/transfer workflow exists.
- SQL checks enforce end after start, positive nullable capacity, and a deadline no later than start. Foreign-key and lookup indexes cover membership, session, creator, organization/date, and status/date access.

## Auth flow and boundaries

`/api/auth/[...all]` exposes only email sign-up, email sign-in, sign-out, and session retrieval. The server revalidates credentials with shared Zod schemas, bounds JSON request size, and drops extra fields including supplied IDs, roles, profile URLs, and redirect URLs. Better Auth retains its origin/CSRF checks, secure HTTP-only cookie handling, password hashing, and session revocation. HTTPS uses secure cookies. Sessions expire after seven days and refresh after one day; cookie session caching is disabled so protected routes validate against database state.

Sign-up requires a trimmed 2–80 character name, normalized email, and a 12–128 character password. Password whitespace is preserved. Success goes only to `/dashboard`, avoiding open redirects. Client and server errors use safe messages rather than SQL/Prisma/auth internals. Query logging and auth-library logging are disabled; unexpected route failures log only the error class, never request bodies or credentials.

`getCurrentUser()` caches only within the React server request. `requireUser()` checks the validated session and redirects unauthenticated visitors. Membership/role helpers derive the user from that session and the role from the database; callers never supply a trusted user ID or role.

The header reads Better Auth's reactive session and replaces only the existing sign-in/get-started controls with an initials account dropdown. This visual header state is not an authorization boundary. Mobile navigation uses the same account actions. The dashboard is a server-protected shell with no persisted registrations, saves, or follows.

## Verification

Offline checks:

- `npm run test:auth`: normalization, input bounds, stripping client privilege/redirect fields, safe error messages, and real Better Auth password hash/salt verification.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run db:validate`, `npm run db:generate`.
- HTTP/browser checks without a database: public mock routes, auth forms, validation, password visibility, unavailable-service handling, unconfigured session retrieval, dashboard redirects, forged-cookie denial, and disabled auth endpoints.

Runtime checklist **requires PostgreSQL and an applied migration**:

1. Sign up a new fictional test account. Confirm dashboard welcome and account header dropdown.
2. Inspect that `User`, credential `Account`, and `Session` rows exist, and that `Account.password` is a hash rather than the submitted password. Never log the password or hash.
3. Sign out. Confirm the session is revoked, the header returns to Sign in/Get started, and `/dashboard` redirects to `/sign-in`.
4. Sign in with the wrong password. Confirm “Invalid email or password.” and no session.
5. Sign in with the correct password. Confirm a valid session and protected dashboard access.
6. Try sign-up again with the same normalized email. Confirm the duplicate-account message and no duplicate user.
7. Check sign-in/sign-up rate limiting and a request from an untrusted origin.
8. Create membership fixtures only if needed later; check non-members and insufficient roles are denied. No public role-management endpoint exists.

These database-backed behaviors were not claimed as passed in the absence of a connection.

## Files created in Step 07

- `.env.example`
- `prisma.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20261002000000_init_auth_and_core_domain/migration.sql`
- `src/lib/env.ts`
- `src/lib/db.ts`
- `src/features/auth/client.ts`
- `src/features/auth/schemas.ts`
- `src/features/auth/errors.ts`
- `src/features/auth/server/auth.ts`
- `src/features/auth/server/session.ts`
- `src/features/auth/server/authorization.ts`
- `src/features/auth/components/auth-form.tsx`
- `src/features/auth/components/auth.module.css`
- `src/features/auth/components/account-menu.tsx`
- `src/features/auth/components/account-menu.module.css`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/(protected)/dashboard/error.tsx`
- `tests/auth-validation.test.mjs`
- `docs/step-07-foundation.md`
- `artifacts/step-07/sign-in-desktop.jpg`
- `artifacts/step-07/sign-up-mobile.jpg`

Generated Prisma source is intentionally ignored and recreated during installation.

## Files changed in Step 07

- `package.json` and `package-lock.json`
- `.gitignore`
- `eslint.config.mjs` (ignore generated Prisma source)
- `src/components/layout/site-header.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/app/(public)/sign-in/page.tsx`
- `src/app/(public)/get-started/page.tsx`

## Results in this environment

Prisma validation/generation, typecheck, lint, build, and all five auth security/validation tests passed. Installation reported zero remaining npm vulnerabilities after applying the scoped patches. HTTP checks passed for public routes, null unconfigured session retrieval, safe 400/503 errors, 413 oversized body rejection, disabled reset/social endpoints, and 307 dashboard redirects for anonymous/forged-cookie requests. Browser checks passed for both forms, password visibility, safe setup errors, unauthenticated header state, and no overflow at 320px.

Migration application/status and real sign-up, sign-in, invalid credentials, sign-out, duplicate email, authenticated header, and membership authorization against PostgreSQL remain untested because no connection/secret was supplied. No successful database-backed auth or migration is claimed.

