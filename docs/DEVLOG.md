# R2RA Development Log

**Handoff document.** Updated at the close of each working session so the
next session can resume cleanly.

---

## Header (always current)

- **Last session**: 2026-04-24
- **Current phase**: Phase 1.5 — JTS assessment flow complete; T&R response flow live
- **Branch**: `claude/usmc-role2-checklist-wiSpY`
- **Last commit**: `09f5c67` (feat: visible_when branching, jump-to-unanswered, T&R PECL/MET response flow)
- **Open PR**: none yet
- **Blocked on**: nothing — evidence attachment and deeper T&R polish are next

---

## Quick resume — start-of-session protocol

When picking this up in a new session:

1. **Read this file top-to-bottom** (the session log below has the "why" for
   recent choices).
2. Skim `docs/STRATEGY.md` §13 (Decision log) and §15 (Next actions).
3. Run `git log --oneline -20` to see the last few commits.
4. Ask the user what thread to pull — don't assume.

Guardrails that repeatedly bit us in earlier sessions:

- **Streaming is unstable on large single responses.** Keep turns small —
  one atomic action (one Write or one section), commit, push, stop.
- **Push after every commit.** The stop hook (`~/.claude/stop-hook-git-check.sh`)
  blocks session close on unpushed commits.
- **`git remote -v` host/port rotates between turns.** A push may fail once
  with a stale URL; a retry normally works.
- **Prompts are verbatim**. Source typos are preserved in JTS transcriptions
  for traceability (`clincial`, `identifed`, `Cartriges`). Do not normalize.
- **Item IDs are permanent once published.** Add, never renumber.

---

## What's shipped

### Phase 0 — Content ingest (complete)

- `docs/STRATEGY.md` — strategic plan, decision log, phasing
- `content/source/` — hash-pinned originals (DOCX + 197 pg PDF)
- `content/frameworks/_schema/{assessment,tr,mets}.schema.json` — JSON Schemas
- `content/frameworks/jts_r2/` — JTS R2 form + ARSRA fully transcribed
  - `_manifest.json` — variables, section list, signoff blocks
  - `sections/01_…15_…` — one file per section
- `content/frameworks/hss_tr.json` — 159 wickets, 10 chapters (generated)
- `content/frameworks/mets/catalog.json` — 15 MCT entries (seeded)
- `content/frameworks/mets/_extracted_refs.json` — 9 MET refs (generated)
- `content/crosswalk/jts_r2__hss_tr.yaml` — v0.1 draft (needs SME review)
- `content/README.md` — content-layer conventions
- `scripts/ingest/parse_navmc.py` — T&R parser

---

## Next actions (recommended order)

1. ~~**Phase 1 MVP scaffolding**~~ — **done** (`0d84102`–`609b850`).
2. ~~**Read-only JTS preview page**~~ — **done** (`45d3de1`–`b530c17`).
3. ~~**Data model migrations**~~ — **done** (`2b11da2`, `032329f`).
4. ~~**Auth**~~ — **done** (`df7fa95`, `eb41718`).
5. ~~**Create-assessment flow + response controls**~~ — **done** (`ccbd3b3`, `0e49588`).
6. ~~**Status progression + T&R crosswalk panel + print/PDF**~~ — **done** (`5af12be`).
7. ~~**visible_when branching + jump-to-unanswered + T&R response flow**~~ — **done** (session 7).
8. **Evidence attachment** — file upload per response; `evidence` table already exists.
   Needs: `POST /api/assessments/{id}/responses/{item_id}/evidence`, file storage
   strategy (local disk for dev, S3-compatible for deploy), thumbnail in UI.
9. **T&R polish**: role2_relevance tagging (SME input needed), GO/NO-GO print
   page, crosswalk bi-directional link (click wicket → jump to JTS item).
10. **PDF export** — true JTS-form-faithful layout (vs current browser-print approach).

### Content-side follow-ups (can parallelize with Phase 1)

- **T&R Role-2 relevance tagging** (`role2_relevance: core|supporting|
  adjacent|none`) — requires medical SME.
- **Deeper crosswalk** for Ch 5 / 6 / 7 wickets (currently sparse).
- **MET catalog expansion** — fill in MCT families beyond 1.x and 4.5.x
  as they surface.
- **Parser cleanups**: a few wickets have multi-column runover in their
  `description`. Fix with column-aware extraction.

---

## Open questions / decisions pending

None right now. All eleven framework decisions are recorded in
`docs/STRATEGY.md` §13.

Will need user input to proceed on:

- Target hosting enclave (when known — drives CAC integration timing).
- Sponsor identity (when known — flips USMC-evocative → USMC-branded).
- Which SMEs will review the crosswalk (determines when v0.1 → approved).

---

## Session log

### 2026-04-24 — Session 7: visible_when branching, jump-to-unanswered, T&R PECL/MET response flow

**In**: JTS assessment flow complete (create → respond → status → print). T&R crosswalk
panel was reference-only. User clarified: T&R wickets must be independently responded
to (GO/NO-GO) as a parallel reporting stream.

**Out**:
- **`visible_when` branching**: `arsra_appendix` section now hidden from nav and excluded
  from print when `mission_type !== 'arst'`. `isVisible()` helper checks
  `section.visible_when.mission_type`. Applied in `AssessmentPage` and `PrintPage`.
- **`item_prefix` in manifest**: Added `item_prefix` field to all 15 section manifest
  entries (e.g. `predeployment_prep → pdp`) so the frontend can identify which responses
  belong to which section without loading all section files.
- **Jump-to-unanswered**: Button "→ Jump to first unanswered" in assessment left pane.
  Iterates visible sections by `item_prefix`, finds first with no responses in the
  `responses` map, navigates there.
- **T&R PECL/MET response flow (Phase 1.5)**:
  - `TrResponse` SQLAlchemy model (`tr_responses` table — event_code, status: go|no_go|na|unanswered, note, versioned).
  - Alembic migration `a1b2c3d4e5f6` applied.
  - `GET /api/content/tr` — serves hss_tr.json with each wicket annotated with `chapter: int`
    (derived from event-code prefix via `_CHAPTER_MAP`); `lru_cache`-backed.
  - `GET /api/assessments/{id}/tr-responses` — list all T&R responses for an assessment.
  - `PUT /api/assessments/{id}/tr-responses/{event_code}` — upsert; `{event_code:path}`
    handles the embedded dashes (e.g. `HSS-OPS-7001`).
  - `TrPage` (`/assessments/:id/tr`) — left chapter nav (10 chapters, completion count
    per chapter), main pane with wicket cards: event_code, title, METs as mono chips,
    GO/NO-GO/NA toggle buttons, collapsible note, expandable condition/standard/components.
  - Status dot (green/red/grey/hollow) per wicket for at-a-glance readiness state.
  - "T&R Assessment →" and "Print / PDF →" split buttons in AssessmentPage left pane.
- **New frontend types**: `TrFramework`, `TrChapter`, `TrWicket`, `TrMet` in `types/tr.ts`;
  `TrResponse`, `TrResponseUpsert`, `TrResponseStatus` in `types/assessment.ts`.
- **api.ts** extended: `getTrFramework`, `listTrResponses`, `upsertTrResponse`.
- TypeScript clean (0 errors). Backend verified: all new routes confirmed live.

**Key decisions**:
- T&R wickets are a separate response stream from JTS items — different status vocabulary
  (go/no_go/na vs yes/no/na), separate table, separate page. They share the `assessment_id`
  FK so one assessment record covers both streams.
- Chapter grouping by event-code prefix (e.g. `HSS-MCCS-*` → Chapter 4) is hardcoded
  in `_CHAPTER_MAP`; accurate enough for all 159 wickets. Chapters 1–2 have no wickets
  (overview/METM only).

**Operational notes**:
- Backend restart needed after model + migration changes. Use PowerShell `Start-Process`
  from `C:\Users\bford\R2RA\backend`.
- The `{event_code:path}` FastAPI path type is required because event codes contain dashes;
  without it the router would match greedily. Frontend uses `encodeURIComponent` on the
  event code in the PUT URL.

**Commits this session**: `09f5c67` (pushed).

---

### 2026-04-24 — Session 6: status progression, T&R crosswalk panel, print/PDF export

**In**: Create-assessment + response controls done and tested.

**Out**:
- **Status progression**: forward-only `draft → in_progress → ready_for_review → certified`
  state machine. Backend `PATCH /api/assessments/{id}/status` validates transition.
  Frontend advance button shows `Start / Submit for Review / Certify →` per current status;
  `certified_at` timestamp set on certify.
- **T&R crosswalk panel**: right pane in `AssessmentPage`; fetches
  `/api/crosswalk/{sectionId}` on section change. Shows wicket event codes with
  confidence color (high=green, medium=yellow, low=grey) and rationale; MET refs
  in blue. Draft notice displayed. Sections with no crosswalk show "No mappings yet."
- **Print / PDF export**: `PrintPage` at `/assessments/:id/print`. Loads all sections
  + responses. Cover block (unit, UIC, mission type, date, status, YES/NO/NA/answered
  counts). Per-section ✓/✗/N/A/○ per item with notes. `print:hidden` toolbar with
  "Print / Save as PDF" button. `break-inside-avoid-page` on section blocks.

**Commits**: `5af12be` (all pushed).

---

### 2026-04-24 — Session 5: create-assessment flow, response controls, auth bug fix

**In**: Auth complete and tested. Login was returning 500 (root cause: `api.me()` called
before token was set).

**Out**:
- **Auth bug fix**: `LoginPage.tsx` — `setToken(res.access_token)` now called before
  `api.me()`. Same fix applied to the TOTP-completion path. Previously `api.me()` had
  no Bearer header → 401 → 500 surface.
- **CORS fix**: `allow_origin_regex=r"http://localhost:\d+"` replaced hardcoded port
  list; Vite port bumps no longer break auth.
- **Port consolidation**: backend moved to `:8082`; `vite.config.ts` proxy target
  updated.
- **Create-assessment flow** (`CreateAssessmentPage`): unit UIC + name + mission-type
  radio cards (R2 LM Non-Split / Split / R2E / ARST) + optional service/component.
  `POST /api/assessments` with unit upsert-by-UIC on backend.
- **HomePage**: assessment list with status badge + unit info; "+ New assessment" button.
- **AssessmentPage** (`/assessments/:id`): three-pane layout (section nav | response
  items | T&R crosswalk). `ResponseControls`: YES/NO/NA toggle + collapsible note +
  debounced 600ms auto-save. `ResponseItem` dispatches all six item types.
- Backend schemas + router extended: `AssessmentCreate`, `AssessmentOut`, `ResponseOut`,
  `ResponseUpsert`, `StatusAdvance`; `PUT /api/assessments/{id}/responses/{item_id}`.

**Key decisions**:
- Response auto-save on toggle (immediate) and on note edit (600ms debounce). No
  explicit "Save" button needed.
- Status progression is forward-only; no rollback exposed in UI.

**Commits**: `ccbd3b3`, `0e49588` (all pushed).

---

### 2026-04-24 — Session 4: auth — backend + frontend

**In**: Data model done; no auth; all routes unprotected; frontend had no
login flow.

**Out**:
- **Backend auth package** (`app/auth/`): `security.py` (bcrypt via passlib,
  HS256 JWT via python-jose — 8-hr full tokens, 5-min partial tokens for
  TOTP-pending state), `totp.py` (pyotp — random secret, provisioning URI,
  verify with ±30 s clock-skew window), `deps.py` (`get_current_user` /
  `require_admin` FastAPI dependencies; partial tokens explicitly rejected).
- **Backend schemas** (`app/schemas/auth.py`): Pydantic I/O models for all
  auth endpoints.
- **Backend router** (`app/routers/auth.py`): `POST /api/auth/login`,
  `POST /api/auth/totp/complete`, `GET /api/auth/me`, `POST /api/auth/totp/enroll`,
  `POST /api/auth/totp/confirm`, `DELETE /api/auth/totp`,
  `POST /api/auth/register` (bootstrap-only — open when 0 users exist).
- **Frontend auth context** (`src/lib/auth.tsx`): `AuthProvider` + `useAuth`
  hook; token in memory only (no localStorage) per CUI posture.
- **Frontend api.ts** updated: `post`/`delete`, Bearer injection via
  module-level `setToken()`, all auth endpoints typed.
- **LoginPage** (`src/pages/LoginPage.tsx`): two-screen state machine —
  credentials form → 6-digit TOTP input if enrolled; USMC scarlet styling.
- **ProtectedRoute** (`src/components/ProtectedRoute.tsx`): redirects to
  `/login` preserving intended destination.
- **App.tsx + main.tsx** wired: `AuthProvider` added; `/login` redirects away
  when already authenticated; `/` and `/preview` protected.

TypeScript clean, Vite build clean (99 modules, 0 errors).

**Key decisions**: Token in memory only (not sessionStorage or localStorage)
— deliberate for CUI field posture; refresh = re-login.

**Operational notes**:
- Bootstrap: hit `POST /api/auth/register` with first user (role=admin)
  while DB is empty; endpoint closes itself after that.
- TOTP enroll flow: `POST /auth/totp/enroll` → returns secret + URI →
  user scans QR → `POST /auth/totp/confirm` with {secret, code} → activated.

**Commits this session**: `df7fa95` → `eb41718` (all pushed).

---

### 2026-04-23 — Session 3: preview polish + data model

**In**: Phase 1 scaffold done; read-only preview page done but missing item
types and acronym handling; data model not yet wired.

**Out**:
- **Acronym handling**: `lib/acronyms.ts` (70+ term glossary), `AcronymText`
  component (define-on-first-use per section with hover tooltip on repeat),
  `AcronymProvider` keyed on section ID for clean reset.
- **New item renderers**: `TableYnItem` (Y/N/NA checkbox tables, used in §11),
  `GroupItem` (indented sub-items, used in ARSRA), `SelectOneItem` (option
  chips), `ItemRenderer` dispatch — all six item types now render correctly.
- **ARSRA nested sub-sections** handled in `SectionView`.
- **Section nav titles**: added `title` field to all 15 manifest entries;
  nav now shows "Medical Rules of Engagement (MROE)", "ARSRA Appendix", etc.
  instead of formatted IDs.
- **Data model**: `app/models/` (User, Unit, Assessment, AssessmentAssignment,
  Response, ResponseComment, Evidence, Signature, AuditLog), `app/database.py`
  (sync SQLAlchemy engine), Alembic `alembic.ini` + `env.py` + initial
  migration applied to `r2ra_dev.db`.
- **Install fix**: corrected `pyproject.toml` build backend for Python 3.11.
- Both dev servers running: backend :8000, frontend :5173.

**Key decisions**: None new.

**Operational lessons**:
- Python 3.11 on this machine — use `setuptools.build_meta` not
  `setuptools.backends.legacy:build`. `requires-python = ">=3.11"`.
- setuptools autogenerate needs `[tool.setuptools.packages.find] include = ["app*"]`
  when `alembic/` is also a top-level directory.
- Tailwind `@apply border-border` fails without shadcn/ui's CSS variable setup —
  removed from `index.css`.

**Commits this session**: `8fbebe0` → `b530c17` (all pushed).

---

### 2026-04-23 — Session 2: Phase 1 MVP scaffolding

**In**: Phase 0 complete, no application code existed.

**Out**: Full monorepo scaffold committed and pushed.
- Root: `.gitignore` (Python + Node + secrets + field bundles), `Makefile`
- `backend/`: `pyproject.toml` (FastAPI, SQLAlchemy, Alembic, Pydantic v2, TOTP),
  `app/main.py`, `app/config.py` (pydantic-settings), `app/routers/health.py`,
  `app/routers/content.py` (walks `jts_r2/_manifest.json`, serves manifest +
  section list + individual sections), `.env.example`
- `frontend/`: `package.json`, Vite+React+TS config, Tailwind (USMC scarlet/gold/
  CUI green palette), persistent CUI banners top+bottom, TanStack Query, React
  Router, `lib/api.ts` typed fetch wrapper, placeholder `HomePage`

**Key decisions**: None new — followed STRATEGY §6 stack exactly.

**Commits this session**: `0d84102` → `609b850` (all pushed).

---

### 2026-04-22 — Session 1: planning + Phase 0 complete

**In**: Empty repo, user request to build a digital Role 2 assessment
tool aligned to the JTS R2 form and USMC HSS T&R.

**Out**: Full strategic plan, full JTS R2 transcription, generated T&R
framework, seeded MET catalog, draft crosswalk, content conventions.

**Key decisions** (full list in STRATEGY §13): cloud + offline PWA,
full chain from MVP, side-by-side T&R crosswalk, CUI-Basic, pluggable
auth (CAC-ready), React+TS + FastAPI + Postgres, USMC-evocative
branding (no protected marks), section-level multi-assessor with soft
claim + Lead reconciliation, read-all/write-own visibility.

**Expanded scope during session**: User added requirement for
multi-assessor collaborative completion (rolled up into assessment),
and for PECL/MET/METL tooltips with hover/press-and-hold definitions.
Both accommodated — collaboration model documented in STRATEGY §8;
MET catalog added to content layer.

**Operational lessons**: Single large JSON writes caused repeated
stream timeouts. Switched to per-section transcription with commit
+ push per file. Stable after that. Retain this pattern for large
artifacts going forward.

**Commits this session**: `a7d2e9a` → `986faf0` (all pushed to
`claude/usmc-role2-checklist-wiSpY`).

---

## Session-close checklist (end of every session)

- [ ] All work committed.
- [ ] All commits pushed.
- [ ] This file's Header block updated (date, last commit, phase, blocked-on).
- [ ] New session entry appended under **Session log** with In / Out /
      Decisions / Lessons / Commit range.
- [ ] Next-actions list refreshed (remove done, add discovered).
- [ ] Follow-ups / tech debt updated.
