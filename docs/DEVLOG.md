# R2RA Development Log

**Handoff document.** Updated at the close of each working session so the
next session can resume cleanly.

---

## Header (always current)

- **Last session**: 2026-04-27 (Session 14)
- **Current phase**: Content layer complete — crosswalk v0.2 + role2_relevance tagged
- **Branch**: `claude/usmc-role2-checklist-wiSpY`
- **Last commit**: `3737c5f` (content: crosswalk v0.2 + role2_relevance tagging)
- **Open PR**: none yet
- **Blocked on**: Phase 3 pending stakeholder input (enclave, sponsor, SME review)

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
8. ~~**Evidence attachment**~~ — **done** (`54d6569`). Local-disk storage, SHA-256
   integrity, 10 MB cap, MIME allowlist (JPEG/PNG/WebP/GIF/PDF/TXT). Authenticated
   blob URL fetch for image thumbnails. Paperclip toggle in ResponseControls.
9. ~~**T&R polish**~~ — **done** (`a3eb74b`, `8d3376f`). T&R print/PDF page
   (cover + per-chapter GO/NO-GO table). Crosswalk panel wicket codes are now links
   to `/tr?wicket=<code>`; TrPage auto-switches chapter, scrolls to, and highlights
   the target wicket with a scarlet ring.
10. ~~**PDF export**~~ — **done** (`7953f29`). PrintPage redesigned: binary items in
    tabular YES/NO/N/A column layout with item ID margin; capture field values shown;
    table_yn rows rendered as reference checklist; signature/certification block.
11. ~~**Multi-assessor role assignment**~~ — **done** (`a22437b`). See session 9 log.

### Phase 2 — complete

12. ~~**Offline mode**~~ — **done** (`780b367`). Service Worker + AES-GCM encrypted `.r2ra` bundle.
13. ~~**Audit log**~~ — **done** (`780b367`). Hash-chained audit log, wired into all mutations.
14. ~~**User management**~~ — **done** (`de6355b`). Admin UI: create/deactivate/role-change accounts.

### Phase 2 additions (complete)

15. ~~**Profile / security settings**~~ — **done** (`c151ea7`). Password change + TOTP enroll/remove. `refreshUser()` in AuthContext so header badge updates. Auth-in-memory only, consistent with CUI posture.
16. ~~**Crosswalk SME editor**~~ — **done** (`ab16455`). See session 13 log.

### Phase 3 — pending stakeholder input

- **Hosting enclave** decision (drives CAC/smartcard auth integration).
- **Sponsor identification** (flips evocative → USMC-branded).
- **SME crosswalk review** (v0.1 → approved for field use; editor now exists to do this in-app).

### Content-side follow-ups (can parallelize with Phase 1)

- ~~**T&R Role-2 relevance tagging**~~ — **done** (`3737c5f`). All 159 wickets tagged.
- ~~**Deeper crosswalk**~~ — **done** (`3737c5f`). v0.2 with Ch 5/6/7/8/9 coverage.
- ~~**MET catalog expansion**~~ — **done** (already complete; all 9 T&R METs + hierarchy parents in catalog).
- ~~**Parser cleanups**~~ — **done** (investigated; no actual runover issues in current JSON).

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

### 2026-04-27 — Session 14: content layer — crosswalk v0.2 + role2_relevance tagging

**In**: Content-side follow-ups all outstanding. Crosswalk v0.1 was sparse (cra 1/13, cc 2/6, blood 2/4, fac 2/5, arsra 0/3). `role2_relevance` field absent from all 159 wickets. MET catalog and parser were investigated and found complete/clean.

**Out**:
- **Crosswalk v0.2** (`content/crosswalk/jts_r2__hss_tr.yaml`):
  - Added Ch 5 (Med Common Skills), Ch 6 (L03A), Ch 7 (Clinical), Ch 8 (NEC 8427), Ch 9 (NEC 8403) wicket mappings throughout.
  - cra: 1/13 → 9/13. Added CLIN-HSS-2104, L03A-PCC-2001, 8427-MED-2002/2005, L03A-EFWB-2001, L03A-TCCC-2004 across 8 new entries. Remaining 4 are IT/admin/theater-policy with explicit notes.
  - cc: 2/6 → 6/6. Added 8403-MED-2105 (sterilization), 8403-MED-2101 (surgical), L03A-PCC-2008 (hypothermia), HSS-SVCS-3003 (holding), 8427-MED-2007 (ACLS).
  - blood: 2/4 → 4/4. Added L03A-EFWB-2001/2002/2003, 8427-MED-2006 to blood.wbb; L03A-EFWB-2002/8427-MED-2006 to blood.storage; L03A-EFWB-2003/8427-MED-2006 to blood.prep.
  - fac: 2/5 → 5/7 (added fac.climate.backup, fac.power.backup, fac.mascal with HSS-SVCS-3002).
  - orsop: added orsop.uxo (HSS-MCCS-1015/1016), orsop.hn_transfer (HSS-SVCS-3004/HSS-MED-2007), enhanced orsop.medevac.
  - arsra: 0/3 → 3/3. weapons (HSS-MCCS-1001/2001), nav (HSS-MCCS-1013/2003), cbrn (HSS-CBRN-1001/1002).
  - Updated coverage summary comment.

- **role2_relevance tagging** (`content/frameworks/hss_tr.json`):
  - Added `role2_relevance` field to all 159 wickets via `scripts/tag_role2_relevance.py`.
  - Distribution: core 60 / supporting 40 / adjacent 35 / none 24.
  - Core clusters: all of Ch 6 L03A (PCC + TCCC series), Ch 7 CLIN-HSS, Ch 3 collective events, Ch 5 key clinical skills, Ch 8/9 NEC events.
  - None: Ch 4 MATN martial arts, MC heritage/history events.
  - Adjacent: Ch 10 Mountain Warfare, Ch 4 weapons/tactics (useful in field but not the medical mission).

- **MET catalog** — confirmed complete (all 9 T&R METs + 6 hierarchy parents in catalog.json). No changes needed.
- **Parser cleanups** — investigated; no actual runover or formatting issues in current hss_tr.json. No changes needed.

**Key decisions**:
- `role2_relevance` is a first curatorial pass, not a final SME ruling. Script is committed so tags can be regenerated cleanly after SME review.
- Wickets that are credential/admin/IT/policy artifacts carry explicit `note:` fields rather than empty wicket lists, so assessors understand why there's no T&R mapping.

**Commits**: `3737c5f` (pushed).

---

### 2026-04-27 — Session 13: crosswalk SME editor + profile/security settings

**In**: Profile page and crosswalk editor both unstarted. `MetRef.mct_task` in TS types didn't match the YAML `id` field.

**Out**:
- **Profile / security settings** (`c151ea7`):
  - `POST /api/auth/change-password`: verifies current password (bcrypt), requires new ≥ 8 chars.
  - `ProfilePage` at `/profile`: avatar initials, display_name/email/role. `PasswordSection` — 3-field form (current, new, confirm). `TotpSection` — shows raw secret + otpauth URI as copyable code blocks on enroll (no third-party QR library — consistent with no-external-CDN CUI posture); confirm with 6-digit input; unenroll with confirm dialog.
  - `refreshUser()` added to `AuthContext`; called after TOTP changes so user state reflects new `totp_enrolled`.
  - User display_name in HomePage header is now a link to `/profile`.

- **Crosswalk SME editor** (`ab16455`):
  - Migration `d4e5f6a7b8c9`: `crosswalk_overrides` (jts_item PK, wickets JSON, mets JSON, note, edited_by, edited_at) + `crosswalk_meta` (key/value singleton for status).
  - `crosswalk_editor.py` router (admin-only): `GET /full` (all 59 items merged with DB overrides + metadata), `PUT /{item}` (save override), `DELETE /{item}` (revert to YAML base), `PATCH /status` (draft/approved toggle), `GET /export.yaml` (merged YAML download for committing).
  - `crosswalk.py` read endpoint now merges DB overrides transparently — assessors see SME edits immediately, no restart needed.
  - `CrosswalkEditorPage` at `/admin/crosswalk` (admin nav link in HomePage header):
    - Left sidebar: 59 items grouped by section (pdp/c2/mroe/comms/orsop/cra/cc/blood/fac/arsra), amber dot on edited items, wicket count badge.
    - Right panel: inline wicket/MET row editors (event_code · confidence · rationale); note textarea; Save/Revert per item.
    - Top bar: status badge, "Mark approved"/"Reset to draft" toggle, "Export YAML" (auth-gated fetch → blob download).
  - Fixed `MetRef.mct_task` → `MetRef.id` in TS types and assessor crosswalk panel display.

**Key decisions**:
- DB overlay (not YAML-write-back) keeps the file in version control as the authoritative canonical source; the editor is a working layer. Export + commit is the intentional path to make edits permanent.
- `lru_cache` on `_load_crosswalk()` is still valid — YAML base is static between restarts; DB override query runs per-request but is a single indexed lookup.

**Commits**: `c151ea7` (profile), `ab16455` (crosswalk editor) — both pushed.

---

### 2026-04-27 — Session 12 (continued): standing unit evidence library

**In**: Phase 3 evidence library not started. Existing evidence table is per-assessment only.

**Out**:
- `unit_evidence` model + migration `c3d4e5f6a7b8`: per-unit document shelf; columns:
  id, unit_id (FK), category (roster|cert|sop|equipment|eval|other), label, description,
  blob_ref, hash, filename, content_type, uploaded_by, uploaded_at.
- `unit_library.py` router: `GET/POST /api/units/{uic}/library`, `DELETE /{uic}/library/{id}`,
  `GET /{uic}/library/{id}/file`. Same MIME allowlist (JPEG/PNG/WebP/GIF/PDF/TXT) + 10 MB cap.
  Files stored under `uploads/library/{item_id}/{filename}`.
- `UnitLibraryPage` at `/units/:uic/library`:
  - Upload form: label (required), category select, file picker, optional description.
  - Category filter pills (All / Roster / Cert / SOP / Equipment / Eval / Other) with counts.
  - `ItemRow`: file-type icon, label as authenticated-fetch link (blob URL popup), category badge,
    description, filename + date + hash truncated. ✕ delete with confirm dialog.
- "Unit document library →" link added to AssessmentPage sidebar.
- Route `/units/:uic/library` registered in App.tsx.

**Key decisions**:
- Separate `unit_evidence` table (not extending `evidence`) keeps assessment evidence
  and standing library cleanly separated; future S3 swap is identical in both paths.
- File served via authenticated fetch → blob URL to preserve JWT-gated access.

**Commits**: `e90ba13` (pushed).

---

### 2026-04-27 — Session 12: HHQ readiness dashboard

**In**: Phase 2 (strategy) not started. All assessments fully functional and certifiable.

**Out**:
- `backend/app/routers/reports.py`: `GET /api/reports/readiness` — latest assessment per unit,
  aggregated by unit, response counts (yes/no/na/unanswered) grouped by item_id prefix.
  Returned sorted by unit_name. No new models or migrations needed.
- `ReadinessPage` at `/reports/readiness`:
  - Header summary: total units / certified / in-progress count badges.
  - Heatmap table: rows = units (link to assessment), cols = sections from manifest;
    color scale: green (≥90% answered, mostly YES), yellow-50/yellow-100 (partial), red (many NO), gray (none).
    Cell tooltip shows section title + raw counts. Sticky first column.
  - Date column: certified_at in green, started_at otherwise.
  - Domain gap analysis panel (certified units only): stacked bar per section (green=YES, red=NO)
    across all certified units. Shows unit count per section.
- "Readiness" nav link added to HomePage header (all roles).

**Key decisions**:
- Section grouping uses `item_id.split('.')[0]` — works because all item IDs follow
  `{prefix}.{ordinal}` format (pdp.1, c2.3, cra.2.a, etc.).
- Latest-per-unit computed in Python (sort by started_at desc, first-seen per unit_id) rather
  than a SQL window function — simpler with SQLite.

**Commits**: `5c5064b` (pushed).

---

### 2026-04-27 — Session 11: Phase 1.5 — OIC sign-off + certification lock

**In**: Phase 1.5 unstarted. Signature model + table existed. No sign-off flow, no lock.

**Out**:
- **Migration** (`b2c3d4e5f6a7`): added `print_name String(200)` to `signatures` table.
- **Certification lock**: `upsert_response` and `upsert_tr_response` return HTTP 403 if
  `assessment.status == "certified"`. Hard-enforced server-side.
- **`advance_status` → certified**: requires `print_name` (non-empty); creates `Signature` row
  with `print_name`, `signer_role`, `method=local`, `signed_at`, and `payload_hash` (SHA-256
  of sorted response snapshot). `_snapshot_hash()` helper in assessments router.
- **`SignatureOut` schema** + `GET /api/assessments/{id}/signatures` endpoint.
- **`certified_at`** added to `AssessmentOut` (already on model, just not serialized).
- **`api.certify()`** / `api.listSignatures()` added to frontend api.ts.
- **CertifyModal**: full-screen overlay with print_name input (pre-filled from user's
  display_name), signing capacity dropdown (Lead Assessor / TMD / Unit OIC / ARST Chief),
  certification statement checkbox, and "Certify Assessment" submit. Opens when
  "Advance to Certified" is clicked from `ready_for_review`.
- **ResponseControls locked prop**: disables YES/NO/NA buttons + note textarea when
  `locked=true`; shows "✓ Certified — read-only" label. Threaded through
  ResponseItem → ResponseSectionView → AssessmentPage (pass `assessment.status === 'certified'`).
- **Sidebar certification block**: green card replaces simple "✓ Certified" — shows print_name,
  capacity label, date, and truncated payload_hash for chain-of-custody reference.
- Jump-to-unanswered button hidden when certified (irrelevant on a locked assessment).

**Key decisions**:
- `print_name` stored on `Signature` (not just via user join) so the official signed name
  is preserved even if the user's display_name changes.
- Import/certify path remains lead-only for now; OIC role enforcement deferred.
- Payload hash is SHA-256 of item_id/status/note/version tuples sorted by item_id — stable
  enough for integrity verification without being too brittle to schema changes.

**Commits**: `557ca09` (pushed).

---

### 2026-04-27 — Session 10: audit log + offline bundle

**In**: Phase 2 priorities — audit log and offline mode. Admin user management already
shipped in Session 9 (items 13+14). Audit log model existed; no helper or endpoints. No SW.

**Out**:
- **Audit log** (`780b367`):
  - `backend/app/audit.py`: `append_entry(db, actor_id, action, entity_type, entity_id,
    before, after)` — SHA-256 hash-chain (prev row's hash → new hash), single-call helper.
  - Wired into 5 mutation endpoints: `upsert_response`, `upsert_tr_response`, `advance_status`,
    `upsert_assignment`, `delete_assignment`. before/after payloads capture status/note/role.
  - `AuditLogOut` schema added; `GET /api/assessments/{id}/audit` returns last 200 entries
    (scoped by `entity_id.startswith(assessment_id)`), newest-first.
  - `AuditPage` (`/assessments/:id/audit`): collapsible entry rows showing timestamp, action
    badge, before→after diff summary; expand shows raw JSON + entity/actor info.
  - "Audit log →" link added to AssessmentPage sidebar nav.

- **Offline mode** (`780b367`):
  - `public/sw.js`: registers as service worker; cache-first for static assets (stale-while-
    revalidate), network-first for navigation (falls back to cached `/index.html`), transparent
    for all `/api/` calls. Auto-deletes old cache versions on activate.
  - SW registered on window `load` in `main.tsx`.
  - `lib/bundle.ts`: `encryptBundle(payload, passphrase)` → PBKDF2-SHA256 (250k iter) →
    AES-GCM 256-bit; binary layout: `salt(16) | iv(12) | ciphertext`. `decryptBundle` reverses.
  - `BundlePanel` in AssessmentPage sidebar: collapsible; passphrase input; Export button
    fetches assessment + responses + tr_responses + assignments → encrypts → downloads `.r2ra`;
    Import file picker + Decrypt button shows unit/count summary on success.

**Key decisions**:
- Import is decrypt-and-verify only (Phase 2). Full offline write-back (IndexedDB + sync)
  deferred to Phase 3; the `.r2ra` format is forward-compatible.
- SW does not intercept `/api/` so auth token management is unaffected.
- Audit log does NOT filter by assessment at the DB layer for flexibility;
  the endpoint filter is `entity_id.like(f"{assessment_id}%")` which covers all sub-entities.

**Commits**: `780b367` (pushed).

---

### 2026-04-27 — Session 9: capture fields, section dots, form-faithful print, multi-assessor

**In**: Phase 1.5 — evidence/T&R/crosswalk done; capture inputs uncontrolled; section nav had
no progress indicators; print was simplified list; multi-assessor had data model but no UI.

**Out**:
- **Capture field saving** (`9d4630c`): binary item `capture` fields are now controlled inputs
  with 600ms debounce, saving via `handleSaveCapture` → `PUT /responses/{id}` with `capture_data`.
- **Section completion indicators** (`9d4630c`): `SectionNav` now shows a green/gray 1.5px dot
  per section based on whether any responses exist for that section's `item_prefix`.
- **Form-faithful JTS print layout** (`7953f29`): `PrintPage` redesigned with columnar YES/NO/N/A
  layout for binary items; table_yn rows shown as reference checklist; table_counts as summary
  table; capture field values shown inline; certification/signature block at end with blank lines
  for TMD Assessor + Unit OIC signatures.
- **Multi-assessor role assignment** (`a22437b`):
  - Backend: `lead_id` added to `AssessmentOut`; `GET /api/users`; `GET/PUT/DELETE
    /api/assessments/{id}/assignments`; `AssignmentOut`/`AssignmentUpsert`/`UserOut` schemas.
  - Frontend: `types/user.ts`; `api.ts` — listUsers/listAssignments/upsertAssignment/deleteAssignment;
    `AssessmentPage` loads assignments in initial fetch; `TeamPanel` component (collapsible) in
    left pane — lead sees current team with initials avatars, can add contributor via user picker +
    section checkboxes, can remove contributors; `SectionNav` shows assignee initials badge per
    section alongside the completion dot.

**Key decisions**:
- `assessment.lead_id` exposed on `AssessmentOut` so frontend can gate lead-only actions
  without a separate `/me` comparison.
- Contributors with `scope_ids: []` are treated as assigned to all sections.
- No per-section authorization enforcement on `upsert_response` yet — that's Phase 2.

**Commits**: `9d4630c`, `7953f29`, `a22437b` (all pushed).

---

### 2026-04-27 — Session 8: evidence attachment, T&R print page, crosswalk bi-directional link

**In**: Phase 1.5 complete. Evidence table existed in DB; no upload endpoints or UI.
T&R page had no print export. Crosswalk panel showed wicket codes as plain text.

**Out**:
- **Evidence attachment** (`54d6569`):
  - `config.py`: `uploads_dir` (./uploads), `max_upload_bytes` (10 MB) settings.
  - `evidence.py` router: `POST /api/assessments/{id}/responses/{item_id}/evidence`
    (multipart upload → `uploads/{evidence_id}/{filename}` on disk; SHA-256 integrity;
    MIME allowlist: JPEG/PNG/WebP/GIF/PDF/TXT); `GET /api/evidence/{id}/file`
    (authenticated `FileResponse`); `DELETE` removes file + trims `evidence_ids` on
    response row.
  - `EvidencePanel` component: lazy-loads evidence list per item; uses exported
    `authHeaders()` to fetch blob URLs for authenticated image thumbnails; file icon
    for non-images; click to download; inline ✕ delete; + Attach file button.
  - `ResponseControls`: paperclip 📎 button toggles `EvidencePanel`; `assessmentId`
    threaded through `ResponseItem` → `ResponseSectionView` → `ResponseControls`.
  - `api.ts`: `listEvidence`, `uploadEvidence` (FormData), `deleteEvidence`,
    `evidenceFileUrl`; `postForm` helper; `authHeaders` exported.
  - `.gitignore`: `backend/uploads/` excluded.

- **T&R print page** (`a3eb74b`):
  - `TrPrintPage` at `/assessments/:id/tr/print`: cover block (unit, UIC, mission
    type, date, GO/NO-GO/N/A/answered counts), per-chapter wicket list with status
    symbols, event codes, titles, METs, and notes. Same CUI/disclaimer footer.
  - Print toolbar with "Print / Save as PDF" button, hidden on print.
  - "Print / Export PDF →" link added to TrPage left-pane header.

- **Crosswalk bi-directional link** (`8d3376f`):
  - Crosswalk panel: wicket event codes are now scarlet `↗` links to
    `/assessments/:id/tr?wicket=<event_code>`.
  - TrPage: reads `?wicket=` search param; switches active chapter to the matched
    wicket's chapter on load; `WicketCard` scrolls into view (smooth) and renders
    with scarlet ring + tinted background when it matches the linked wicket.

**Key decisions**:
- Evidence stored locally under `backend/uploads/{evidence_id}/{filename}`. `blob_ref`
  column stores the relative path so it can be swapped for an S3 key later without
  schema changes.
- File serving requires auth (Bearer header); frontend fetches blob and creates object
  URL rather than using a bare `<img src>` since we have no cookie auth.
- Crosswalk link uses `?wicket=` query param (not a hash/fragment) so React Router
  can read it without any server changes.

**Commits**: `54d6569`, `a3eb74b`, `8d3376f` (all pushed).

---

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
