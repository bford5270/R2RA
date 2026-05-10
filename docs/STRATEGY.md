# R2RA — Role 2 Readiness Assessment

**Strategic Plan v0.1 — living document**

> **Unofficial — not endorsed by USMC, the Navy, DHA, or JTS.** This tool
> operationalizes the publicly available JTS *Role 2 Readiness Assessment (with
> ARSRA Appendix)* and references NAVMC 3500.84B (USMC HSS T&R Manual). It does
> not replace the official JTS form; it produces it.

---

## 1. Vision

A digital, auditable, field-usable instrument that lets a certifying assessor
walk a Marine Corps HSS unit through the JTS *Role 2 Readiness Assessment* and
the corresponding USMC HSS T&R wickets *simultaneously*, producing:

1. A completed JTS-format report (PDF) indistinguishable in content from the
   official paper form.
2. A T&R-aligned certification record (per-wicket GO / NO-GO / N-A with
   evidence).
3. A gap/trend dashboard a unit OIC or HHQ can read in under 60 seconds.

**Success** = (a) an assessor completes a Role 2 assessment faster with the
tool than on paper, (b) zero loss of fidelity to the source frameworks, and
(c) the exported artifact is accepted by the unit's certifying authority.

---

## 2. Guiding principles

- **Source-of-truth integrity.** Every item traces to an ID in the JTS form
  and/or a T&R event code. Item wording is verbatim from the source; any local
  annotation is surfaced separately, never silently rewritten.
- **Assessor-first UX.** The person holding the clipboard is the primary user;
  everything else (commander view, HHQ rollup) is secondary.
- **Offline-capable.** Role 2 assessments happen in motor pools, BAS tents, and
  shipboard spaces with no signal. The tool must function disconnected and
  sync later.
- **Evidence over assertion.** Every GO can attach a photo, document, or note.
  The report is defensible.
- **Plain, not flashy.** Think *1040 meets Linear* — quiet, dense,
  keyboard-driven.
- **Privacy / OPSEC by default.** No PHI required; CUI handling baked in from
  day one. No third-party analytics, fonts, or CDNs.

---

## 3. Users and jobs-to-be-done

| Persona | Primary JTBD | Frequency |
|---|---|---|
| **Lead Assessor / Certifier** (typically O-4/O-5 medical, or SME team lead) | Scope the assessment, assign sections, reconcile contributor work, sign and submit | Per assessment (hours to days) |
| **Contributing Assessor** (SME: surgeon, anesthesia, nursing, blood, logistics, C2) | Complete assigned section(s), attach evidence, submit for lead review | Per assessment |
| **Unit OIC / SMO** | Self-assess pre-visit, remediate gaps, sign final | Quarterly-ish |
| **SNCOIC / Chief** | Maintain standing evidence library (rosters, certs, SOPs) | Continuous |
| **HHQ / MARFOR Surgeon staff** | Roll up readiness across units, identify systemic gaps | Monthly |
| **Auditor** (post-hoc) | Re-open an assessment, verify chain-of-custody of evidence | Ad hoc |

---

## 4. Source-framework mapping

Two instruments are reconciled:

**A. JTS Role 2 Readiness Assessment + ARSRA Appendix** (the capability
standard). Front matter captures Service, Component, and mission type:

- Role 2 Light Maneuver — non-split DCS
- Role 2 Light Maneuver — split-based DCS
- Role 2 Enhanced (includes primary surgery, ICU beds, dental, radiology, lab)
- Austere Resuscitative Surgical Team (SOST / GST / GHOST) — triggers the
  ARSRA Appendix

The form **branches by mission type**. Our data model treats `mission_type` as
a top-level variable and items carry a `visible_when` predicate.

Confirmed sections (partial, will be exhaustively enumerated during Phase 0):

- Predeployment Prep
- Command and Control (C2)
- *(remaining sections transcribed from the DOCX in Phase 0)*
- ARSRA Appendix (conditional)

**B. NAVMC 3500.84B — USMC HSS T&R Manual** (the training events / wickets
that gate unit and individual readiness). 197 pages. Ch 1 inserts a new
Chapter 6 (Field Medical Service Technician, L03A, with Prolonged Field Care
48–72 hr content highly relevant to Role 2). Standard T&R format — event
codes, conditions, standards, references, chained prerequisites.

**Crosswalk.** A JTS item ↔ one-to-many T&R wickets. A wicket may satisfy
multiple JTS items. Modeled as a join table so future T&R revisions don't
break JTS compliance.

---

## 5. Scope & phasing

**Phase 0 — Content ingest** *(critical path, starts immediately)*

- Transcribe the JTS Role 2 form + ARSRA Appendix into
  `content/frameworks/jts_r2.json` with stable item IDs.
- Extract HSS T&R wickets into `content/frameworks/hss_tr.json`.
- Hand-author `content/crosswalk/jts_r2__hss_tr.yaml` v1; flag for SME review.
- Author JSON Schemas for both under `content/frameworks/_schema/`.

**Phase 1 — MVP Assessor flow**

- Auth (local accounts + TOTP; OIDC/CAC abstraction in place).
- Run an assessment end-to-end for a single unit: create → assign sections →
  contributors fill → lead reconciles → OIC signs → certified.
- Side-by-side T&R crosswalk panel.
- Evidence attachments (photo, document, note).
- JTS-format PDF export that mirrors the official form layout.
- CUI banner, audit log (hash-chained), encrypted at rest.
- Offline mode: Service Worker shell + IndexedDB + encrypted `.r2ra`
  import/export bundle.

**Phase 1.5 — OIC sign-off polish**

- Review queue, e-signature, certification lock, versioned snapshot on sign.

**Phase 2 — HHQ rollup**

- Unit readiness heatmap by domain.
- Time-series of deficiencies and remediation.
- Cross-unit comparison (de-identified at HHQ level).

**Phase 3 — Evidence library + CAC**

- Standing per-unit evidence shelf (rosters, SOPs, cert cards) reused across
  assessments.
- CAC/PIV integration once target enclave is known.

**Phase 4 — Field hardening**

- Full air-gapped single-binary build.
- Real-time presence via WebSockets.
- Peer review between contributors (optional).

---

## 6. Architecture

```
                        ┌───────────────────────────┐
                        │  PWA shell (installable)  │
                        │  React + TS + Tailwind    │
                        │  shadcn/ui + Radix        │
                        └──────┬──────────┬─────────┘
                               │          │
                        online │          │ offline
                               ▼          ▼
                   ┌───────────────┐  ┌──────────────────┐
                   │ FastAPI + PG  │  │ SQLite + local   │
                   │ OIDC (CAC-rdy)│  │ service worker   │
                   │ S3-compatible │  │ IndexedDB + FS   │
                   └───────┬───────┘  └────────┬─────────┘
                           │    encrypted      │
                           └────── .r2ra ──────┘
                                 bundle
```

**Stack**

- **Frontend**: React + TypeScript, Vite, Tailwind, shadcn/ui (Radix
  primitives), TanStack Query, Zustand, `react-pdf` for export, Service Worker
  + IndexedDB for offline.
- **Backend**: FastAPI (Python 3.12), SQLAlchemy, Alembic, Pydantic v2,
  auth abstraction (local + OIDC + CAC-ready).
- **DB**: PostgreSQL in cloud, SQLite (SQLCipher) in field.
- **Storage**: S3-compatible (MinIO for offline parity).
- **Audit**: append-only, hash-chained event log.

**Offline ↔ online parity**

Same SQLAlchemy models run on both engines. Export produces an encrypted
`.r2ra` bundle (zip + AES-256) that only the tool can import. Sync is
assessment-scoped; merges happen per item with deterministic conflict
detection based on a monotonic `version` column.

---

## 7. UX / design approach

- **Layout**: three-pane — section tree (left) · current item + response
  (center) · reference/crosswalk (right). Collapsible for tablet.
- **Typography**: system stack, tabular numerals, generous line-height, 16 px
  minimum.
- **Palette**: USMC-evocative — scarlet `#CC0000` and gold `#FFCC33` as
  accents, neutral grey base. **No EGA**, no official marks, until a
  sponsor is secured. One config flag flips to full marks later.
- **Accessibility**: WCAG 2.2 AA, full keyboard nav, visible focus rings,
  screen-reader labels, 508-conformant.
- **Information density**: one item visible at a time with context; batch
  review mode for the lead/certifier.
- **Micro-interactions**: autosave toast, unsaved-change guard,
  jump-to-unanswered, "last edited by" attribution chip per item.
- **Print fidelity**: exported PDF matches the JTS form's page layout so it
  files alongside paper records.
- **CUI banner**: persistent top + bottom of every screen and every export.
- **Footer**: "Unofficial — not endorsed by USMC or JTS" until sponsored.

---

## 8. Multi-assessor collaboration model

**Per-assessment roles**

| Role | Rights |
|---|---|
| **Lead Assessor** | Creates assessment, assigns scope, can edit anything, resolves conflicts, submits to OIC |
| **Contributing Assessor** | Edits only assigned scope, submits for review, can comment anywhere |
| **Observer** | Read-only across the assessment |
| **OIC / Certifier** | Sign-off only, cannot edit responses |

**Scope assignment**: section-level in MVP, item-level in a later phase.

**Visibility**: read-all, write-own. Contributors can read every section
at all times; edits are limited to assigned scope (UI-soft, server-hard
enforcement). A "Focus mode" toggle hides other sections for contributors who
want to tune out.

**Conflict handling**: soft claim + Lead reconciliation. Opening an item
soft-claims it; others see a badge but can still open it. Save warns on
concurrent edit. True conflicts (same item, different values, post-sync)
preserve both versions and go to the Lead's reconciliation queue. Every
response carries a monotonic `version` for deterministic merge.

**Workflow**

```
Lead creates assessment
        │
        ▼
Lead assigns sections to contributors
        │
        ▼
Contributors work in parallel  ─── online: live presence
                               └── offline: local cache, sync later
        │
        ▼
Each contributor marks scope "Ready for review"
        │
        ▼
Lead reconciles (accept / request rework / edit)
        │
        ▼
Lead locks assessment → routes to OIC → signature → Certified
```

---

## 9. Data model (first cut)

Content (versioned, immutable per version):

- `frameworks` — e.g., `jts_r2@2024`, `hss_tr@2018-ch2`
- `sections` — `(framework, ordinal, title, parent)`
- `items` — `(section, source_id, prompt, response_type, guidance, visible_when)`
- `wickets` — `(framework=hss_tr, event_code, title, conditions, standard, refs)`
- `crosswalk` — `(item_id, wicket_id, rationale, reviewer)`

Operational:

- `units` — `(uic, name, echelon, parent_uic)`
- `users` — `(id, display_name, email, global_role)`
- `assessments` — `(unit_id, framework_version, mission_type, lead_id, status, started_at)`
- `assessment_assignments` — `(assessment_id, user_id, role, scope_type, scope_ids[], status)`
- `responses` — `(assessment_id, item_id, status, note, evidence_ids[], authored_by, last_modified_by, review_status, assignment_id, version)`
- `response_comments` — `(response_id, author, body, ts)`
- `evidence` — `(assessment_id, type, blob_ref, hash, uploaded_by)`
- `signatures` — `(assessment_id, role, signer_id, method, signed_at, payload_hash)`
- `audit_log` — `(actor, action, entity, before, after, ts, prev_hash, hash)` *(append-only)*

Ephemeral:

- `presence` — Redis, `{assessment_id, item_id, user_id, editing_since}`

---

## 10. Security & compliance posture

- **Classification**: CUI-Basic (rosters, UIC, provider names).
- **Banners**: persistent CUI banner, top and bottom, on every screen and
  every exported artifact.
- **Encryption at rest**: AES-256 — SQLCipher in field mode; pgcrypto / KMS
  in cloud mode.
- **Encryption in transit**: TLS 1.3 only; HSTS preloaded.
- **Authentication**: pluggable — local + TOTP in dev/field; OIDC abstraction
  ready for CAC/PIV once enclave is known.
- **Authorization**: RBAC globally, per-assessment roles locally, scope-hard
  enforcement on server.
- **Audit log**: append-only, hash-chained, every mutation recorded with
  actor, before/after, timestamp.
- **No third-party exfil**: no external analytics, fonts, CDNs, or error
  reporting services. Everything self-hosted.
- **Export safety**: `.r2ra` bundles are encrypted; PDF exports stamped with
  CUI banner and classification authority block.
- **Data minimization**: no PHI; EDIPI optional and encrypted if stored.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Source form updates (JTS/T&R revise) | Framework versioning, schema migration tool, never overwrite in place |
| CUI exposure | No PHI fields; default-deny network; encryption at rest |
| Auth in target enclave unknown | Keep auth pluggable; no hard-coded CAC until enclave is identified |
| Scope creep into EHR territory | Hard line: readiness tool, not patient care |
| SME bandwidth for crosswalk | Build a crosswalk editor in the admin UI so SMEs can curate iteratively |
| Branding risk before sponsor | USMC-evocative but no protected marks; "Unofficial" footer |
| Offline merge edge cases | Deterministic version column + Lead reconciliation queue |

---

## 12. Non-goals

- Not an EHR, not TCCC documentation, not a credentialing system.
- Not a replacement for the official JTS form — it *produces* that form.
- Not a training LMS — it *consumes* currency data.
- Not an official USMC/JTS/DHA product until explicitly sponsored.

---

## 13. Decision log

| # | Decision | Choice | Date |
|---|---|---|---|
| 1 | Deployment target | Cloud + offline-capable PWA | 2026-04-21 |
| 2 | MVP user chain | Full chain: Assessor → OIC → HHQ | 2026-04-21 |
| 3 | T&R integration | Side-by-side crosswalk panel | 2026-04-21 |
| 4 | Data sensitivity | CUI-Basic | 2026-04-21 |
| 5 | Authentication | Pluggable, CAC-ready | 2026-04-21 |
| 6 | Stack | React + TS + Tailwind + shadcn/ui → FastAPI + Postgres (SQLite in field) | 2026-04-21 |
| 7 | Visual identity | USMC-evocative, no protected marks until sponsored | 2026-04-21 |
| 8 | Multi-assessor assignment | Section-level for MVP, item-level later | 2026-04-21 |
| 9 | Conflict model | Soft claim + Lead reconciliation | 2026-04-21 |
| 10 | Visibility | Read-all, write-own (with Focus mode) | 2026-04-21 |
| 11 | Source docs | Committed under `content/source/` | 2026-04-21 |

---

## 14. Open questions (to resolve during Phase 0 / early Phase 1)

- Final enumeration of JTS sections after full DOCX transcription.
- Scope of HSS T&R wickets relevant to Role 2 (vs. general HSS) — SME call.
- Target enclave for eventual hosting (NIPR / MHS enclave / MARFOR).
- Sponsor identity — drives when we can adopt official marks.
- Unit taxonomy (UIC canonical source; echelon model).

---

## 15. Next actions

1. **Phase 0 content ingest** — transcribe JTS form to
   `content/frameworks/jts_r2.json`; extract T&R wickets to
   `content/frameworks/hss_tr.json`; draft crosswalk v1.
2. Author JSON Schemas for both frameworks.
3. Stand up project scaffolding (frontend + backend) *only after* the content
   schema is stable, so Phase 1 has a real target.

No application code is written until (1) and (2) are complete.
