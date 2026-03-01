# DeckTakeoffPro Launch Plan

## Phase 1 - Launch Blockers (Now)

### 1) Runtime env validation
- Added strict startup validation for required env vars:
  - `DATABASE_URL`
  - `PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- Files:
  - `src/lib/config/env.ts`
  - `src/lib/db/client.ts`

### 2) Mutating endpoint access hardening
- Added centralized edit-access check (`owner` or accepted collaborator with role not `viewer`).
- Applied to key write APIs:
  - save inputs
  - save assumptions
  - generate takeoff
  - generate labor
  - calculate estimate
  - create/revoke share links
  - generate PDFs
- Files:
  - `src/lib/db/repo.ts`
  - `src/lib/utils/auth.ts`
  - multiple `src/pages/api/**` endpoints

### 3) Audit trail coverage expansion
- Added activity events for major estimating actions:
  - `design_inputs_saved`
  - `assumptions_saved`
  - `takeoff_generated`
  - `labor_generated`
  - `estimate_calculated`
  - `share_link_created`
  - `share_link_revoked`
  - `materials_pdf_generated`
  - `internal_estimate_pdf_generated`
  - `client_proposal_pdf_generated`

### 4) Safer public review link defaults
- Share-link API now:
  - validates email format
  - sets default estimate-link expiration to 30 days if omitted
  - requires expiration at least 1 hour ahead
  - caps expiration at 180 days

### 5) API guardrails
- Added stricter payload validation for project updates (name/address/status schema).
- Added server-side covered-package gating (already in place from previous pass) to prevent bypassing UI checks.

## Phase 2 - Pre-Launch QA
- Add e2e smoke tests for full deck/covered/fence flows.
- Add API integration tests for all write endpoints (auth + validation + expected side effects).
- Added migration replay/idempotency script (`npm run db:migrate:replay`) for CI gate.
- Add export reliability checks (retry/backoff surface in UI).

## Phase 3 - Production Readiness
- Add Sentry (or equivalent) with route-level error fingerprints.
- Added structured request logs (JSON) with request IDs in middleware + key routes.
- Added basic in-memory rate limiting for public review endpoints (`/review/*`).
- Add backup/restore runbook and scheduled backup verification.

## Phase 4 - Business Completion
- Proposal approval workflow with explicit revision cycle.
- Schedule board v2 with drag/drop and workload awareness.
- Pricebook management UI + import/export.
- Role model expansion (`viewer`, `estimator`, `manager`) with UI affordances.
