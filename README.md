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
- `/resources`
- `/projects`
- `/projects/schedule`
- `/projects/new`
- `/projects/[id]/inputs`
- `/projects/[id]/takeoff`
- `/projects/[id]/labor`
- `/projects/[id]/estimate`
- `/projects/[id]/export`
- `/projects/[id]/share`
- `/projects/[id]/schedule`
- `/projects/[id]/collaborators`
- `/projects/[id]/media`
- `/review/[token]`

## Environment Variables
Create `.env.local` (or `.env`):

```bash
DATABASE_URL=postgres://...
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NETLIFY_BLOBS_SITE_ID=...
NETLIFY_BLOBS_TOKEN=...
SEED_USER_ID=user_seed_demo
RESEND_API_KEY=re_...              # optional for outbound email
RESEND_FROM_EMAIL=ops@example.com  # optional for outbound email
INTERNAL_ALERT_EMAIL=owner@example.com # optional approval alert recipient
NOTIFICATION_CRON_SECRET=change_me # required for queue processor endpoint auth
```

For Neon, use the full connection string with SSL, e.g. `?sslmode=require`.

## Setup
```bash
npm install
npm run dev
```

## Database
Run migration on Neon:

```bash
npm run db:migrate
```

(Alternative)
```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
psql "$DATABASE_URL" -f db/migrations/002_collab_images.sql
psql "$DATABASE_URL" -f db/migrations/003_client_share_links.sql
psql "$DATABASE_URL" -f db/migrations/004_project_assumptions.sql
psql "$DATABASE_URL" -f db/migrations/005_fence_type.sql
psql "$DATABASE_URL" -f db/migrations/006_proposal_approvals.sql
psql "$DATABASE_URL" -f db/migrations/007_schedule_handoff.sql
psql "$DATABASE_URL" -f db/migrations/008_rls_new_tables.sql
psql "$DATABASE_URL" -f db/migrations/009_notification_queue.sql
```

## Seed
```bash
npm run db:seed
```

Seed creates:
- 3 labor templates
- 1 deck project with versioned inputs + generated takeoff + labor + estimate
- 1 covered deck project with versioned inputs + generated takeoff + labor + estimate
- 1 fence project with generated takeoff + labor + estimate

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
- Collaborator invites are email-based with invite codes; project owner can issue invites.
- Project images are stored in Netlify Blobs and served through authenticated API routes.
- Client review links support public blueprint/estimate review pages with revocable tokens.
- Estimate review links support client decision submission (`approved` / `changes_requested`) with timeline activity tracking.
- Basic scheduling handoff board is available on `/projects/[id]/schedule` (backlog -> ready -> scheduled -> in_progress -> done).
- Cross-project schedule board is available on `/projects/schedule`.
- Retry queue processor endpoint:
  - `POST /api/system/notifications/process`
  - Header: `x-cron-secret: $NOTIFICATION_CRON_SECRET`
- Health endpoint:
  - `GET /api/system/health`
- Takeoff page includes project-level assumption controls (span/spacing/beam thresholds) used for new generated versions.
- Design Inputs includes a polygon shape drawer for custom footprints (including L-shapes), with sqft/perimeter overrides used in takeoff math.
- Project type `fence` is supported with fence-specific inputs, takeoff formulas, and labor template.

## Estimator Logic (Carpenter Review)
This section documents the current rules engine behavior so field leadership can verify assumptions.

### 1) Deck Geometry Source
- Rectangle mode:
  - `deck_sqft = deck_length_ft * deck_width_ft`
  - `perimeter_lf = 2 * (deck_length_ft + deck_width_ft)`
- Polygon mode:
  - `deck_sqft = shoelace area from polygon points`
  - `perimeter_lf = perimeter from polygon segments`

### 2) Framing + Joists
- Effective joist spacing:
  - Wood: use selected spacing (12/16/24)
  - Composite: forced to `min(selected spacing, 12)` (max 12" O.C.)
- Beam line auto-adjust:
  - Starts from selected `beam_count`
  - Increases until joist span rule is met:
  - `deck_length_ft / (effective_beam_count + ledger_support_lines) <= max_joist_span_ft`
- Joist count:
  - `joist_count = floor((framing_width_ft * 12) / effective_joist_spacing_in) + 1`

### 3) Posts + Footings
- Beam support posts:
  - `post_count_per_beam = ceil(deck_length_ft / post_spacing_ft) + 1`
  - `beam_support_post_count = post_count_per_beam * effective_beam_count`
- Perimeter railing support posts:
  - `perimeter_railing_support_post_count = ceil(railing_lf / railing_post_spacing_ft) + 1`
  - default `railing_post_spacing_ft = 6`
- Final structural post count:
  - `post_count_total = max(beam_support_post_count, perimeter_railing_support_post_count, 4)`
- Concrete bags:
  - `concrete_bags = post_count_total * 2` (2 bags per footing assumption)

### 4) Railing
- Railing LF:
  - If custom LF is provided with `railing_sides = custom`, use custom value
  - Else: `railing_lf = perimeter_lf - stair_opening_lf`
  - `stair_opening_lf = stair_count * stair_width_ft`
- Railing posts line item:
  - `railing_posts = ceil(railing_lf / railing_post_spacing_ft) + 1`

### 5) Decking + Hardware
- Decking summary quantity:
  - `decking_sqft = deck_sqft`
- Fasteners:
  - `screw_boxes = ceil(deck_sqft / 100)`
- Board length optimization:
  - chooses 8/10/12/14/16ft combinations per run
  - minimizes overage, then multiplies by number of courses

### 6) Labor
- Uses template production factors, then multiplies by quantity drivers:
  - framing hours by deck sqft
  - decking hours by deck sqft
  - railing hours by railing LF
  - stairs hours by stair count
  - footings hours by structural post count
- Burdened labor rate:
  - `rate = base_rate * (1 + burden_pct)`

### 7) Estimate Totals
- `materials_subtotal = sum(qty * (1 + waste_factor) * unit_cost)`
- `labor_subtotal = total_labor_cost`
- `overhead = (materials + labor) * overhead_pct`
- `profit = (materials + labor + overhead) * profit_pct`
- tax mode:
  - `materials_only` (default) or `grand_total`

### 8) Practical Disclaimer
- This tool is for transparent estimating/takeoff assumptions, not stamped engineering.
- Review post/beam/joist/span assumptions against local code, load conditions, and site constraints before build.

## Netlify Deployment Checklist
1. Create a Netlify site from this repo.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Set all env vars from `.env.example` in Netlify Site Settings.
5. Run migrations against your production database:
   - `npm run db:migrate`
6. Seed optional demo data:
   - `npm run db:seed`
7. Smoke test:
   - `GET /api/system/health` returns `{ "ok": true, ... }`
   - Login works
   - Create project -> inputs -> takeoff -> labor -> estimate -> exports
8. Optional queue processing:
   - call `POST /api/system/notifications/process` with header `x-cron-secret`
   - wire this to Netlify Scheduled Functions or an external cron.
# decks
