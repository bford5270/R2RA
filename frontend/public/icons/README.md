# Iconography

- **Primary:** Lucide via CDN — `https://unpkg.com/lucide@latest`
- **Custom medical & tactical extensions:** in `medical/` and `tactical/`
- Stroke 1.5 px, square caps, miter joins. 24 × 24 viewBox.
- Color via `stroke="currentColor"` — icons inherit `color` from their parent so theming works automatically.

## Usage

```html
<svg style="width:20px;height:20px;color:var(--ink-2)"><use href="assets/icons/medical/tourniquet.svg"/></svg>
```

Or render inline (preferred — allows recoloring per state).

## Files

```
assets/icons/
├── medical/
│   ├── tourniquet.svg
│   ├── airway.svg
│   ├── blood-drop.svg
│   ├── vitals.svg
│   └── triage-diamond.svg
└── tactical/
    ├── affiliation-friendly.svg
    ├── affiliation-hostile.svg
    ├── evac-window.svg
    └── hlz.svg
```

Add more as needed — match the stroke weight and 24 × 24 grid.
