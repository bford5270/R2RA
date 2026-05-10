# `content/` — R2RA source frameworks & crosswalks

This directory holds the **structured content** the R2RA application runs on,
separated from application code by intent: frameworks and crosswalks are
curated reference material with their own review cycle.

```
content/
├── source/                # Original source artifacts (DOCX/PDF), read-only
├── frameworks/
│   ├── _schema/           # JSON Schemas for framework files
│   ├── jts_r2/            # JTS Role 2 Readiness Assessment (+ ARSRA)
│   │   ├── _manifest.json     # Framework metadata + section order
│   │   └── sections/          # One file per section
│   ├── hss_tr.json        # USMC NAVMC 3500.84B T&R wickets (generated)
│   └── mets/
│       ├── catalog.json           # Seeded MCT catalog (hand-curated)
│       └── _extracted_refs.json   # MET tokens seen in hss_tr.json (generated)
└── crosswalk/
    └── jts_r2__hss_tr.yaml  # Maps JTS items -> wickets + METs
```

## Source artifacts

`source/` holds the originals, **never modified**:

| File | SHA-256 |
|---|---|
| `Role_2_Readiness_Assessment_with_ARSRA_Appendix.docx` | `001492c6…3c1e42` |
| `NAVMC 3500.84B Ch 2.pdf` | `66ebb718…a60610` |

If either document is updated, replace the file in `source/`, bump the
`version` in the matching framework, and re-run any generators.

## Frameworks

A **framework** is an immutable, versioned definition of a checklist or
T&R manual. Two frameworks exist today:

### `jts_r2` — JTS Role 2 Readiness Assessment

Hand-transcribed from the DOCX, split into one file per section for
reviewability and to stay under single-write size limits.

Load order: `_manifest.json.sections_manifest[]`, each entry pointing at
`sections/NN_<id>.json`. The manifest also declares form-scoped
`variables` (mission_type, service, component) and framework-level
`signoff` blocks (including an ARSRA-conditional ARST Chief signature).

**Item IDs**: dotted, stable, source-derived. `<section>.<ordinal>` for
numbered items (`pdp.1`, `c2.3`), `<section>.<slug>` for named items
(`orsop.medevac`, `blood.wbb`). Sub-items nest further (`orsop.rehearsed_on.cpg`).
Once published, **item IDs are permanent**; only add, never renumber.

**Source fidelity**: prompt text is verbatim from the DOCX. Source typos
(e.g., "clincial", "identifed", "Cartriges") are preserved with the
original wording so an assessor can trace any prompt back to the paper
form. Normalization is a UI-layer concern (an optional display transform)
not a content-layer one.

**Conditional visibility**: the ARSRA Appendix and the ARST Chief
signature both carry `visible_when: { mission_type: "arst" }`. The
runtime only renders and validates items whose predicates resolve true.

### `hss_tr` — USMC HSS T&R Manual (NAVMC 3500.84B Ch 2)

**Generated** by `scripts/ingest/parse_navmc.py`. Current state:
- 159 wickets
- 10 chapters (deduped from TOC + body headers)
- 9 unique MCT METs referenced

To regenerate:

```bash
python3 scripts/ingest/parse_navmc.py \
  --pdf "content/source/NAVMC 3500.84B Ch 2.pdf" \
  --out content/frameworks/hss_tr.json \
  --mets-out content/frameworks/mets/_extracted_refs.json
```

**Event code IDs** are the T&R codes themselves (`HSS-MED-2002`,
`L03A-HSS-2002`). The first dash-segment is the community
(`HSS`, `L03A`, …).

**Role-2 relevance tagging** (`role2_relevance: core | supporting |
adjacent | none`) is a curatorial pass — the parser does not set it;
SME review does. Populate incrementally, not in bulk.

### `mets/catalog.json` — MCT seed catalog

Hand-authored lookup for hover/press-and-hold definitions in the UI.
Contains the 9 METs referenced by the T&R plus their hierarchical parents
(e.g., `MCT 4.5` and `MCT 4` above `MCT 4.5.5`) so the UI can render a
breadcrumb trail in tooltips. Expand as new METs surface during
assessments.

`_extracted_refs.json` is the raw output of the parser — it's the
**to-do list** for catalog expansion, not the catalog itself. When a new
MET appears there that isn't in `catalog.json`, hand-author an entry.

## Crosswalk

`crosswalk/jts_r2__hss_tr.yaml` maps JTS items to T&R wickets and METs.
It is the **single most SME-sensitive artifact** in the repo.

Each mapping carries:

- `jts_item`: the JTS item ID
- `wickets`: list of `{ event_code, confidence, rationale }`
- `mets`: list of `{ id, confidence, rationale }`
- `note`: when there's no T&R mapping, where the evidence lives

**Confidence ladder**: `high` (near-1:1 correspondence), `medium`
(plausible, SME to confirm), `low` (thematic context only; not gating).

**Lifecycle**: every crosswalk file carries a top-level `status` field.
v0.1 ships as `draft-needs-sme-review`. A mapping is only gating when
the file is flipped to `approved`.

**Proposing edits**: open a PR. The review bar is: a named SME,
reviewing on a named date, with their reasoning captured in the PR body.
The repo's history *is* the audit trail.

## Regeneration checklist

When the JTS or T&R source is revised:

1. Replace the file in `content/source/`; update the SHA-256 in the
   framework's `_manifest.json` (JTS) or re-run the parser (T&R) — the
   parser writes the fresh hash automatically.
2. Bump the framework `version`.
3. For JTS: hand-diff the new DOCX against the per-section JSON; add/
   update items **by appending** (preserve existing IDs).
4. For T&R: re-run `parse_navmc.py`; review the diff; fix any
   regressions in the parser rather than in the output JSON.
5. Re-check the crosswalk — flag any mapping whose referenced ID no
   longer exists (`scripts/check/validate_crosswalk.py`, future).
6. Bump `crosswalk.version` and reset `status: draft-needs-sme-review`.

## Conventions

- **IDs are lowercase snake-dotted**. Never Unicode, never spaces.
- **Prompts are verbatim**. Help text and labels can be authored/normalized.
- **Dates are ISO-8601**.
- **Files are JSON unless they carry comments**; the crosswalk uses YAML
  specifically so the rationale and notes can live next to the mapping.
- **No secrets, no PII, no PHI** ever land here. This directory is
  unclassified content by design.
