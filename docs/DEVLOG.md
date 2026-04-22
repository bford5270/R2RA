# R2RA Development Log

**Handoff document.** Updated at the close of each working session so the
next session can resume cleanly.

---

## Header (always current)

- **Last session**: 2026-04-22
- **Current phase**: Phase 0 **complete** — Phase 1 not yet started
- **Branch**: `claude/usmc-role2-checklist-wiSpY`
- **Last commit**: `986faf0` (Document content/ conventions, provenance, and regeneration)
- **Open PR**: none yet
- **Blocked on**: nothing — awaiting user direction on Phase 1 kickoff

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

1. **Phase 1 MVP scaffolding** — monorepo layout, FastAPI backend skeleton,
   Vite+React+Tailwind+shadcn/ui frontend skeleton, CUI banner, audit log
   stub, auth abstraction (local + TOTP), content loader that walks
   `jts_r2/_manifest.json`.
2. **Read-only JTS preview page** — renders the form from content/, no
   persistence, no auth. Proves the content shape is right.
3. **Data model migrations** — assessments, assignments, responses,
   evidence, signatures, audit_log (from STRATEGY §9).
4. **First writable flow** — create-assessment → assign-section →
   contributor fills → lead reconciles.
5. **PDF export** — JTS-faithful layout.

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
