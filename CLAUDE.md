# CLAUDE.md

Context for Claude Code sessions on this repo.

## Read these first, in order

1. **`docs/DEVLOG.md`** — session-by-session handoff. Start here. The
   Header block tells you what phase we're in, the last commit, and
   what's blocked.
2. **`docs/STRATEGY.md`** — strategic plan, decision log (§13), phased
   roadmap (§5, §15), data model (§9), security posture (§10).
3. **`content/README.md`** — content conventions (IDs, source fidelity,
   regeneration, crosswalk lifecycle).

If you're about to change the content layer, `content/README.md` is
required reading.

## Project in one sentence

R2RA is a digital, auditable, field-usable tool that walks a Role 2 HSS
unit through the JTS *Role 2 Readiness Assessment (with ARSRA Appendix)*
and the corresponding USMC HSS T&R wickets (NAVMC 3500.84B), producing
an official-form PDF and a T&R-aligned certification record.

## Current status (short form)

- **Phase 0 — Content ingest**: complete.
- **Phase 1 — MVP assessor flow**: not started.
- **Branch**: `claude/usmc-role2-checklist-wiSpY`.

## Working agreements

- **One atomic action per turn** when producing large artifacts; commit
  and push after each.
- **Push after every commit.** A repo stop hook blocks session close on
  unpushed commits.
- **Never push to `main`** without explicit instruction.
- **No PR unless explicitly asked.**
- **Prompts are verbatim.** Preserve source typos in transcriptions for
  traceability; normalization is a UI concern.
- **IDs are permanent once published** — add, never renumber.
- **No secrets, PII, or PHI** ever land in this repo.

## Where things live

```
CLAUDE.md            ← you are here
docs/
  STRATEGY.md        ← strategic plan + decision log
  DEVLOG.md          ← session handoff log (read first)
content/
  source/            ← read-only originals, hash-pinned
  frameworks/        ← JTS form, T&R, MET catalog, schemas
  crosswalk/         ← JTS items ↔ T&R wickets + METs
  README.md          ← content-layer conventions
scripts/ingest/
  parse_navmc.py     ← T&R PDF → JSON
```

## Session-close reminder

Before ending a session: update `docs/DEVLOG.md` per its own close
checklist, commit, push.
