# R2RA Development Log

**Handoff document.** Updated at the close of each working session so the
next session can resume cleanly.

---

## Header (always current)

- **Last session**: 2026-04-23
- **Current phase**: Phase 1 — data model done, auth + writable flow next
- **Branch**: `claude/usmc-role2-checklist-wiSpY`
- **Last commit**: `b530c17` (fix(content+frontend): use real section titles in nav)
- **Open PR**: none yet
- **Blocked on**: nothing — next step is auth (login, JWT, TOTP)

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
2. ~~**Read-only JTS preview page**~~ — **done** (`45d3de1`–`b530c17`). Three-pane
   layout, all six item types (binary, text_long, table_counts, table_yn, group,
   select_one), acronym define-on-first-use per section, real section titles in nav.
3. ~~**Data model migrations**~~ — **done** (`2b11da2`, `032329f`). All 9 tables
   (users, units, assessments, assessment_assignments, responses, response_comments,
   evidence, signatures, audit_log). Alembic applied to `r2ra_dev.db`.
4. **Auth** — local login (email + bcrypt password + JWT), TOTP enrollment,
   `/api/auth/login`, `/api/auth/me`, `Authorization: Bearer` middleware.
   Start here next session.
5. **First writable flow** — create-assessment → assign-section →
   contributor fills → lead reconciles.
6. **PDF export** — JTS-faithful layout.

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
