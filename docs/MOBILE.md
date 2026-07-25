# R2RA as a mobile app

R2RA ships as an **installable Progressive Web App (PWA)**. This is the
mobile-app strategy chosen in STRATEGY §13 (cloud + offline PWA): one
codebase, no app store, works on government and personal devices alike,
and updates land instantly on every deploy — no MDM repackaging cycle.

## What users do

**Android / Chrome (or Edge):**
1. Open the app URL (e.g. `https://role2assessment.com`).
2. Tap **Install app** on the home-page prompt, or use the browser menu →
   *Install app* / *Add to Home screen*.

**iPhone / iPad (Safari):**
1. Open the app URL in Safari.
2. Tap **Share** → **Add to Home Screen**.

Either way the app then launches full-screen from its own home-screen
icon, with the CUI banners padded into the device safe areas (notch /
home indicator) so the marking is never clipped.

## What makes it installable

| Piece | File | Notes |
|---|---|---|
| Web app manifest | `frontend/public/manifest.webmanifest` | `display: standalone`, theme `#3A3025` (dark coyote), background `#E8DCC4` (warm paper) |
| App icons | `frontend/public/icons/app/` | 192/512 standard + maskable, `apple-touch-icon.png` (180) |
| Mobile meta | `frontend/index.html` | manifest link, `theme-color`, iOS standalone meta, `viewport-fit=cover` |
| Safe areas | `index.css` + `CuiBanner.tsx` | `env(safe-area-inset-*)` on banners and body padding |
| Service worker | `frontend/public/sw.js` | precaches shell + install assets; navigations refresh the cached `index.html` so the offline fallback tracks the latest deploy; never touches `/api/` |
| Install prompt | `frontend/src/components/InstallPrompt.tsx` | one-tap install on Chromium; Add-to-Home-Screen hint on iOS; dismissible; hidden when already installed |

## Regenerating icons

Icons are rendered from the dual-hexagon logo mark (cream `#F1E8D4` on
dark coyote `#3A3025`). To regenerate, run a Node script with `sharp`
that inlines the mark's two polygons at 62% of canvas (52% for maskable
variants, which must fit the 80% safe zone) and rasterizes to the sizes
in `manifest.webmanifest`. No CDN or external assets involved (CUI
posture).

## Offline behavior (current scope)

- App shell (HTML/JS/CSS/fonts/icons) works offline once visited.
- API data is **not** cached by the service worker — the SW deliberately
  never intercepts `/api/` so JWT auth and data freshness are unaffected.
- For deliberate disconnected work, use the encrypted `.r2ra` bundle
  export/import in the assessment sidebar (AES-GCM, Phase 2).
- Full offline write-back (IndexedDB queue + sync) remains a Phase 3
  candidate; the `.r2ra` format is forward-compatible with it.

## If app-store distribution is ever required

The same codebase can be wrapped with **Capacitor** (adds native iOS and
Android shells around the built `dist/`). That path only makes sense if a
stakeholder mandates store/MDM distribution or native-only capabilities
(e.g. CAC middleware integration). It adds Apple/Google signing accounts,
review cycles, and a second deploy pipeline — don't take it on without a
concrete requirement. The PWA is fully functional without it.
