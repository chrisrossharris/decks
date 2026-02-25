# DeckTakeoffPro (MVP: Takeoff + Estimate Engine)

## Stack
- Astro + TypeScript
- TailwindCSS
- Clerk Auth
- Neon Postgres
- Netlify (server adapter + blobs storage)
- Zod + React Hook Form
- @react-pdf/renderer
- Vitest

## Architecture Overview
- UI routes follow the estimating flow: project -> inputs -> takeoff -> labor -> estimate -> export.
- Server API routes handle all writes and computation triggers.
- Core business logic is pure functions in `src/lib/engines` for deterministic, testable takeoff/labor/estimate math.
- Persistence uses Postgres tables with versioned `design_inputs` and `takeoffs`.
- PDF documents are generated server-side and stored in Netlify Blobs, then tracked in the `documents` table.
- RLS policies are included in SQL migration; API also validates authenticated user ownership on all sensitive operations.

## Routes
- `/login`
- `/projects`
- `/projects/new`
- `/projects/[id]/inputs`
- `/projects/[id]/takeoff`
- `/projects/[id]/labor`
- `/projects/[id]/estimate`
- `/projects/[id]/export`

## Environment Variables
Create `.env`:

```bash
DATABASE_URL=postgres://...
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NETLIFY_BLOBS_SITE_ID=...
NETLIFY_BLOBS_TOKEN=...
SEED_USER_ID=user_seed_demo
```

## Setup
```bash
npm install
npm run dev
```

## Database
Run migration on Neon:

```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```

## Seed
```bash
npm run db:seed
```

Seed creates:
- 2 labor templates
- 1 deck project with versioned inputs + generated takeoff + labor + estimate
- 1 covered deck project with versioned inputs + generated takeoff + labor + estimate

## Tests
```bash
npm test
```

Covers:
- Joist + hanger calculation
- Railing LF logic
- Roof area derived quantities
- Fastener box rounding

## Notes
- Takeoff formulas are assumptions and explicitly non-structural.
- Pricing allowances are flagged in the takeoff table and editable per line item.
- Generating takeoff always creates a new `takeoffs.version`.
- Inline takeoff editing autosaves with debounce.
# decks
