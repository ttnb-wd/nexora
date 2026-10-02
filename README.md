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
