#!/usr/bin/env python3
"""
NAVMC 3500.84B (HSS T&R) wicket parser.

Reads the PDF, walks each page of text, finds every wicket (identified by an
event-code header line), and emits a structured JSON document that conforms
to content/frameworks/_schema/tr.schema.json.

Fields extracted per wicket:
  - event_code, title
  - evaluation_coded, readiness_coded, sustainment_interval_months
  - grades, initial_learning_setting
  - description, condition, standard
  - event_components, performance_steps   (PECL candidates)
  - references
  - chained_events.{internal_supporting, external_supporting, supported_mets}
  - provenance.source_page

A second output lists every unique MCT/MET token referenced, suitable for
seeding content/frameworks/mets/catalog.json.

Usage:
    python3 scripts/ingest/parse_navmc.py \
        --pdf content/source/'NAVMC 3500.84B Ch 2.pdf' \
        --out content/frameworks/hss_tr.json \
        --mets-out content/frameworks/mets/_extracted_refs.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pypdfium2 as pdfium


EVENT_CODE_RE = re.compile(
    r"^\s*([A-Z0-9]{2,6}(?:-[A-Z0-9]+){2,3}):\s*(.+?)\s*$"
)
MET_TOKEN_RE = re.compile(
    r"\b(MCT|UJTL|JMET|MET)\s*([0-9]+(?:\.[0-9]+)*)\b"
)
MONTHS_RE = re.compile(r"(\d+)\s*months?", re.IGNORECASE)

FIELD_LABELS = {
    "EVALUATION-CODED": "evaluation_coded",
    "READINESS-CODED":  "readiness_coded",
    "SUSTAINMENT INTERVAL": "sustainment_interval",
    "GRADES": "grades",
    "INITIAL LEARNING SETTING": "initial_learning_setting",
    "DESCRIPTION": "description",
    "CONDITION": "condition",
    "STANDARD": "standard",
    "EVENT COMPONENTS": "event_components",
    "PERFORMANCE STEPS": "performance_steps",
    "REFERENCES": "references",
    "CHAINED EVENTS": "chained_events_raw",
    "INTERNAL SUPPORTING EVENTS": "internal_supporting",
    "EXTERNAL SUPPORTING EVENTS": "external_supporting",
    "SUPPORTED MET(S)": "supported_mets",
    "MOS PERFORMING EVENT": "mos_performing",
    "BILLETS": "billets",
}


def extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return list of (page_number_1_indexed, text)."""
    out = []
    pdf = pdfium.PdfDocument(str(pdf_path))
    for idx in range(len(pdf)):
        t = pdf[idx].get_textpage().get_text_range() or ""
        out.append((idx + 1, t))
    return out


def flatten_pages(pages: list[tuple[int, str]]) -> tuple[str, list[int]]:
    """Join page text into one string; track page for each line."""
    lines: list[str] = []
    page_of_line: list[int] = []
    for page_no, text in pages:
        for raw in text.splitlines():
            lines.append(raw.rstrip())
            page_of_line.append(page_no)
    return "\n".join(lines), page_of_line


def strip_header_footer(line: str) -> bool:
    """Return True if this line is page noise (header/footer), not content."""
    s = line.strip()
    if not s:
        return True
    if s.startswith("NAVMC 3500.84B"):
        return True
    if re.match(r"^\d+\s+Enclosure\s*\(\d+\)\s*$", s):
        return True
    if re.match(r"^\d{1,2}\s+\w+\s+\d{4}\s*$", s):  # date stamp
        return True
    if re.match(r"^[0-9]+-[0-9]+\s+Enclosure", s):
        return True
    # Guid-looking fingerprint lines the PDF emits between wickets
    if re.match(r"^\{[0-9A-Fa-f ]{4,}-[0-9A-Fa-f ]{3,}", s):
        return True
    return False


def find_wicket_starts(lines: list[str]) -> list[tuple[int, str, str]]:
    """Scan lines, return (line_index, event_code, title) for each wicket start."""
    starts = []
    for i, line in enumerate(lines):
        m = EVENT_CODE_RE.match(line)
        if not m:
            continue
        code = m.group(1)
        title = m.group(2).strip()
        # Filter out false positives: event codes are upper + digits + dashes.
        if not re.fullmatch(r"[A-Z0-9]+(?:-[A-Z0-9]+){2,3}", code):
            continue
        # Skip chapter/index-style references where the "title" looks like a
        # page number or leader-dots only.
        if re.fullmatch(r"\.+\s*\d+.*", title):
            continue
        # Skip placeholder example codes like XXXX-XXX-XXXX used in the
        # Overview chapter to illustrate the event-code grammar.
        if re.fullmatch(r"X+(?:-X+){2,3}", code):
            continue
        starts.append((i, code, title))
    return starts


def split_fields(body_lines: list[str]) -> list[tuple[str, str]]:
    """
    Walk body lines and split into (label, value) pairs.
    A label is a known header token followed by a colon.
    """
    label_pattern = re.compile(
        r"^\s*(" + "|".join(re.escape(k) for k in FIELD_LABELS.keys()) + r")\s*:\s*(.*)$"
    )
    fields: list[tuple[str, list[str]]] = []
    current: tuple[str, list[str]] | None = None
    for line in body_lines:
        if strip_header_footer(line):
            continue
        m = label_pattern.match(line)
        if m:
            if current:
                fields.append(current)
            current = (m.group(1), [m.group(2)] if m.group(2) else [])
        else:
            if current:
                current[1].append(line)
    if current:
        fields.append(current)
    return [(k, "\n".join(v).strip()) for k, v in fields]


def parse_yn(s: str) -> bool | None:
    t = s.strip().upper()
    if t.startswith("YES"):
        return True
    if t.startswith("NO"):
        return False
    return None


def parse_months(s: str) -> int | None:
    m = MONTHS_RE.search(s)
    if m:
        return int(m.group(1))
    return None


def parse_list(s: str) -> list[str]:
    """Parse a numbered or comma-separated list into trimmed items."""
    if not s.strip():
        return []
    # Numbered items "1. ..., 2. ..."
    items = re.split(r"(?:^|\n)\s*\d+\.\s+", s)
    items = [i.strip() for i in items if i.strip()]
    if len(items) > 1:
        return items
    # Comma-separated
    return [p.strip() for p in re.split(r"[,;\n]", s) if p.strip()]


def parse_refs(s: str) -> list[str]:
    """References often come as numbered lines."""
    return parse_list(s)


def parse_chained(field_text: str) -> list[str]:
    """Chained event lists are often lines like 'HSS-MED-2002 Perform TCCC'."""
    out = []
    for line in field_text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+){1,2})\s*:?(.*)?", line)
        if m:
            out.append(line)
    return out


def parse_mets(s: str) -> list[dict]:
    mets: list[dict] = []
    seen: set[str] = set()
    for m in MET_TOKEN_RE.finditer(s):
        token = f"{m.group(1)} {m.group(2)}"
        if token in seen:
            continue
        seen.add(token)
        # Grab trailing description up to end of line
        start = m.end()
        tail = s[start:start + 200]
        tail_line = tail.split("\n", 1)[0].strip(" -:\t")
        mets.append({"id": token, "description": tail_line})
    return mets


def wicket_from_body(code: str, title: str, body_lines: list[str],
                     source_page: int) -> dict:
    fields = split_fields(body_lines)
    w: dict = {
        "event_code": code,
        "title": title,
        "provenance": {"source_page": source_page},
    }
    chained: dict[str, list[str]] = {}
    for label, value in fields:
        key = FIELD_LABELS[label]
        if key == "evaluation_coded":
            w[key] = parse_yn(value)
        elif key == "readiness_coded":
            w[key] = parse_yn(value)
        elif key == "sustainment_interval":
            w["sustainment_interval_months"] = parse_months(value)
        elif key == "grades":
            w["grades"] = [g.strip() for g in re.split(r"[,\s]+", value) if g.strip()]
        elif key == "initial_learning_setting":
            w["initial_learning_setting"] = value.splitlines()[0].strip() if value else ""
        elif key in ("description", "condition", "standard"):
            w[key] = value
        elif key in ("event_components", "performance_steps"):
            w[key] = parse_list(value)
        elif key == "references":
            w["references"] = parse_refs(value)
        elif key == "internal_supporting":
            chained["internal_supporting"] = parse_chained(value)
        elif key == "external_supporting":
            chained["external_supporting"] = parse_chained(value)
        elif key == "supported_mets":
            # Raw MET tokens (MCT x.y.z), plus a structured list
            chained["supported_mets"] = parse_chained(value)
            mets = parse_mets(value)
            if mets:
                w.setdefault("mets_extracted", []).extend(mets)
        elif key == "chained_events_raw":
            # This is often a noop label just preceding the three sub-lists.
            pass
    if chained:
        w["chained_events"] = chained
    # Community is the first segment of the event code.
    w["community"] = code.split("-", 1)[0]
    return w


def chunk_wickets(lines: list[str], page_of_line: list[int]) -> list[dict]:
    starts = find_wicket_starts(lines)
    wickets: list[dict] = []
    for idx, (line_idx, code, title) in enumerate(starts):
        next_line_idx = starts[idx + 1][0] if idx + 1 < len(starts) else len(lines)
        body = lines[line_idx + 1:next_line_idx]
        page = page_of_line[line_idx] if line_idx < len(page_of_line) else 0
        wickets.append(wicket_from_body(code, title, body, page))
    return wickets


def detect_chapters(lines: list[str], page_of_line: list[int]) -> list[dict]:
    """Heuristic chapter detector."""
    out: list[dict] = []
    ch_re = re.compile(r"^\s*CHAPTER\s+(\d+)\s*$", re.IGNORECASE)
    for i, line in enumerate(lines):
        m = ch_re.match(line)
        if m:
            title = ""
            # Title is typically one of the next 2 non-empty lines
            for j in range(i + 1, min(i + 6, len(lines))):
                s = lines[j].strip()
                if s and not strip_header_footer(s):
                    title = s
                    break
            out.append({
                "number": int(m.group(1)),
                "title": title,
                "page": page_of_line[i] if i < len(page_of_line) else 0,
            })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--mets-out", type=Path, default=None)
    args = ap.parse_args()

    pages = extract_pages(args.pdf)
    flat, page_of_line = flatten_pages(pages)
    lines = flat.split("\n")

    raw_chapters = detect_chapters(lines, page_of_line)
    # Dedupe by chapter number, keeping the longest title (body header usually
    # has the full title; TOC sometimes truncates).
    by_num: dict[int, dict] = {}
    for c in raw_chapters:
        prev = by_num.get(c["number"])
        if prev is None or len(c["title"]) > len(prev["title"]):
            by_num[c["number"]] = c
    chapters = [by_num[n] for n in sorted(by_num)]
    wickets = chunk_wickets(lines, page_of_line)

    checksum = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    framework = {
        "framework_id": "hss_tr",
        "version": "3500.84B-ch2",
        "title": "USMC Health Services Support Training & Readiness Manual",
        "source": {
            "authority": "USMC",
            "document": args.pdf.name,
            "checksum": f"sha256:{checksum}",
        },
        "chapters": [{"number": c["number"], "title": c["title"]} for c in chapters],
        "wickets": wickets,
        "_meta": {
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            "ingested_by": "scripts/ingest/parse_navmc.py",
            "pages_total": len(pages),
            "wickets_extracted": len(wickets),
            "chapters_detected": len(chapters),
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(framework, indent=2) + "\n")
    print(f"Wrote {args.out} ({len(wickets)} wickets, {len(chapters)} chapters)")

    if args.mets_out:
        met_index: dict[str, str] = {}
        for w in wickets:
            for met in w.get("mets_extracted", []):
                met_index.setdefault(met["id"], met["description"])
        args.mets_out.parent.mkdir(parents=True, exist_ok=True)
        args.mets_out.write_text(json.dumps(
            {"extracted_mets": [
                {"id": k, "description": v, "source": "NAVMC 3500.84B Ch 2"}
                for k, v in sorted(met_index.items())
            ]},
            indent=2,
        ) + "\n")
        print(f"Wrote {args.mets_out} ({len(met_index)} unique METs referenced)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
