# Mobile E2E Verified — 2026-06-30

What actually got verified on a booted iPhone 17 Pro simulator running the
production Release build wired to `https://hermes-desktop.pmxt.dev`:

- ✅ App launches; renderer mounts; native fetch bridge to gateway returns
  200 (empty sessions list for this user). See
  `docs/screenshots/mobile-e2e-1-empty.png`.
- ✅ Titlebar chrome collapsed to just the sidebar trigger on mobile (no
  haptics / keybinds / settings / flip / right-rail cluster). See
  `docs/screenshots/mobile-parity-collapsed-chrome.png`.

What is NOT independently verified yet:

- ⚠️ Settings drill-down / master-detail nav — CSS gating was inspected
  in the Vite dev server with the `hermes-mobile-standalone` class applied
  manually, but no tap-driven flow was screenshotted on the sim (CLI
  tap-automation via cliclick did not propagate touches to the simulator
  window in this session, and `hermes://settings` is not registered as a
  routable URL scheme).
- ⚠️ Composer submit → response — not scripted.
- ⚠️ Sidebar-trigger-hides-when-drawer-open behavior — CSS rule landed,
  visually inspected in dev server, not screenshotted on sim.

## Parity audit vs the 104k-LOC mobile fork (`fork/main`) — gaps closed

The user identified four specific UX gaps between the current alias-overlay
mobile shell (~2.5k LOC) and the original mobile fork. All four are now
ported as overrides under `html.hermes-mobile-standalone` plus a small set
of `data-*` attribute hooks on desktop components:

| Gap | Resolution | Commit |
|-----|-----------|--------|
| Sidebar trigger visible when drawer is open | CSS `:has([data-slot='sheet-overlay'][data-state='open'])` morphs the trigger out (opacity + scale + pointer-events) — plus `data-tool-id` hook on `TitlebarToolButton` for the selector | `7d1a1d5b5` |
| Titlebar chrome cluttered with desktop-only tools | CSS hides flip-panes / right-rail / haptics / keybinds / settings / preview-* via `[data-tool-id]` selectors — only the sidebar trigger renders on mobile | `7d1a1d5b5` |
| Drawer + composer-surface + overlay polish | Ported fork's bundle: unified drawer scroll, 3rem menu-button rows, safe-area-top on first group, mobile-drawer theme; composer-surface 4.95rem min-height + 2rem radius + lifted shadow + 1rem rich-input; full-bleed overlay (no card chrome on mobile); 16pt+ font + 44pt min-height on overlay inputs | `2e0be19e4` |
| Scroll behavior "all connected" | Thread viewport owns the only scroller; `overscroll-behavior: contain`, `scroll-padding-bottom = composer-clearance` so last message lands above the docked composer; `overscroll-behavior: none` on `composer-bounds` to prevent a second scroll axis | `8c3656920` |
| Settings menus "more coherent" | Phone-style grouped list — 3rem rows with hairline border-bottom, full-bleed background, sienna `:active` tint; drilled detail pane carries notch clearance + 1.25rem inset; h1/h2 bumped to 1.25rem so sections breathe | `daa9d269f` |
| "Small effects" — micro-interactions | press-down `scale(0.97)` on sidebar trigger / Done pill / nav rows; 180ms opacity crossfade on the master-detail swap; sienna focus ring on every input/textarea + composer rich-input; Sheet enter eases out (220ms) and exits snappy (180ms) | `d58e061b9` |

Total LOC added across the audit: ~250 lines of CSS + ~6 lines of TSX
(`data-*` attributes only). The desktop layout is unchanged at viewports
≥47.5rem.

## Post-mortem on the "Hermes couldn't start" red herring

Earlier in the session a screenshot appeared to show the native app in a
recovery state with `GET /api/profiles/sessions failed: Load failed`. Root
cause: an `xcrun simctl openurl booted "http://localhost:5174/#/settings"`
opened that URL in **Safari**, not the Hermes WebView. The index.html
bridge's `dashboardFetch` falls back to a direct `fetch()` in Safari, and
the production gateway doesn't ship CORS headers for arbitrary origins,
so Safari's browser-side fetch is rejected.

The native React Native bridge isn't subject to CORS — it just works.
`App.native.tsx` now surfaces any future native-side fetch failure
(TLS / ATS / DNS / NSURLErrorDomain) into the in-app diagnostic overlay
with full context. See commit `b552db495`.
