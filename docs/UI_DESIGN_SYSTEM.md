# TRPG Archive UI Design System

## Status and scope

- Status: Stage 10 implementation specification
- Decision date: 2026-08-05
- Source Issue: #83
- Product boundary: Japanese, all-ages, read-only TRPG scenario search
- Data boundary: synthetic fixture preview until a later explicitly approved production-data stage

This design system gives the search product a recognizable pixel-art and early Japanese Internet identity without reducing readability, keyboard access, mobile usability, or publication safety. It does not imitate a specific copyrighted asset pack or historical site.

## Design principles

1. **The search task stays primary.** Pixel art frames the task; it never replaces labels, result data, or safety information.
2. **Archive, not inventory.** Results look like readable records and documents, not game-item slots.
3. **Text before icon.** Every functional action remains understandable when its SVG icon is absent.
4. **Hard edges, generous spacing.** One/two-pixel borders and hard shadows are paired with modern whitespace and line height.
5. **Fail-closed states are visible.** Explicit unknown values may be shown. Held and sales-ended records are stated as excluded.
6. **No runtime visual dependency.** The page ships only project-owned code-native SVG and CSS patterns.

## Color tokens

All committed colors are hexadecimal custom properties in `app/style.css`. The Vitest contract reads these exact values and calculates WCAG contrast ratios.

| Token | Value | Primary use |
| --- | --- | --- |
| `--canvas` | `#c9c7b6` | outer desktop-like background |
| `--canvas-dot` | `#9fa28f` | restrained dither point |
| `--paper` | `#f6f4e7` | main content surface |
| `--paper-strong` | `#fffdf2` | controls and result records |
| `--paper-muted` | `#e8e5d6` | title bars and status bars |
| `--ink` | `#17212b` | primary text and borders |
| `--muted` | `#4a5661` | secondary text |
| `--line` | `#24313c` | strong border |
| `--line-soft` | `#777e70` | secondary border |
| `--accent` | `#27665b` | primary action |
| `--accent-dark` | `#17483f` | title bar and link text |
| `--accent-pale` | `#d9eee7` | information surface |
| `--warning` | `#74362b` | invalid/safety warning text |
| `--warning-pale` | `#f2d6cd` | warning surface |
| `--unknown` | `#514a77` | explicit-unknown status |
| `--unknown-pale` | `#e5e0f2` | explicit-unknown surface |
| `--held` | `#704719` | held/excluded status |
| `--held-pale` | `#f0e0c3` | held status surface |
| `--ended` | `#702d38` | sales-ended/excluded status |
| `--ended-pale` | `#f0d6dc` | ended status surface |
| `--success` | `#235a37` | confirmed status |
| `--success-pale` | `#d8eadb` | confirmed status surface |
| `--focus` | `#005fcc` | keyboard focus outline |

Required contrast checks:

- normal text pairs: at least 4.5:1;
- component boundaries and focus indication: at least 3:1;
- status meaning is never encoded by color alone; every chip includes visible text and an icon.

## Typography

### Body

`system-ui`, Segoe/Yu Gothic/Hiragino fallbacks. Body copy uses normal Japanese UI typography for long-form readability.

### Display chrome

`ui-monospace`, SFMono, Consolas, Liberation Mono, BIZ UDPGothic fallback. The monospaced face is limited to:

- window title bars;
- primary headings;
- section codes;
- compact status bars;
- buttons and project badge.

Body paragraphs, form values, and result facts are not forced into bitmap-style text.

## Pixel grid

- All project icons use a `24 × 24` view box and integer path coordinates.
- Supported rendered sizes are 16, 20, 24, and 32 CSS pixels.
- SVG uses `shape-rendering: crispEdges` and `currentColor`.
- Raster `image-rendering: pixelated` is intentionally absent because no runtime raster pixel asset is shipped.
- Decorative paths use three semantic fills: dark line, paper light, and warm accent.
- Fractional transforms are avoided. Button movement uses integer CSS pixels.

## Layout

### Desktop

- Outer `site-frame`: maximum width `78rem`, centered with responsive padding.
- `archive-window`: two-pixel strong border with an eight-pixel hard shadow.
- Compact title bar precedes all application content.
- Header uses a text column and one project-owned decorative archive sprite.
- Search controls use a three-column grid at wide widths.
- Results use record-like list rows with four fact columns and a full-width system row.
- One compact status bar and one 88 × 31-style project badge appear at the bottom.

### Tablet

Below `58rem`, control and result grids reduce to two columns.

### Narrow mobile

Below `44rem`:

- outer padding and window shadow are reduced;
- header becomes one column;
- decorative sprite becomes a compact horizontal strip;
- every form field becomes one column;
- submit/reset controls become full width;
- result facts become one column;
- status bar stacks;
- product links use the available width;
- document width must not exceed the viewport at `390px`.

Below `25rem`, decorative window controls and nonessential result icons are hidden while all visible labels remain.

## Components

### `WindowTitleBar`

A compact application title and three decorative window squares. The squares are `aria-hidden` and have no interaction.

### `Panel`

A section with a pixel title bar and body. `title`, `headingId`, and `icon` establish the section relationship. Panels are used for search controls and active filters, not around every result fact.

### `IconLabel`

Pairs a supplementary icon with visible text. The text carries the accessible name.

### `StatusChip`

A compact text-labelled state. Tones: confirmed, explicit unknown, held/excluded, sales-ended/excluded, and neutral.

### `PixelDivider`

A CSS-only repeating rectangular divider. It is decorative and `aria-hidden`.

### `EmptyState`

A reusable record-empty message with an archive icon, heading, and recovery guidance.

### `ArchiveDecoration`

One project-owned three-color SVG representing a screen, files, and archive drawer. It is decorative and never substitutes for product evidence.

### `ProjectBadge`

One project-owned 88 × 31-style badge in the footer. It identifies this fixture archive only and is not repeated in the task flow.

## Search and result behavior

- The form remains a native GET search form.
- Every input and select has a visible wrapping label.
- Search parameter names, allowlists, fail-closed validation, result filtering, sorting, seeded random behavior, and reset URL remain unchanged.
- Active conditions are summarized as text chips.
- Result rows retain scenario title, player range, play time, edition, modality, system, and parent-product link.
- The product link remains text-labelled, uses `rel="external"`, and does not force a new window.
- Runtime product images are not displayed or invented.

## Publication boundary

A visible legend accompanies every result state:

- confirmed records are displayed;
- explicit unknown may be displayed as unknown;
- held records are excluded;
- sales-ended records are excluded.

The legend describes behavior; it does not expose held or ended source content.

## Keyboard and accessibility

- A skip link is the first focusable element and moves to `#search-results`.
- All interactive elements use a three-pixel blue focus outline plus a white separation ring.
- Controls have a minimum height of `2.85rem`.
- Native labels, fieldsets, legends, headings, lists, description lists, alerts, notes, and live result-count text provide semantic structure.
- Decorative SVG is `aria-hidden` and `focusable="false"`.
- No control depends on icon-only meaning.
- The page does not open product links in a new window without user choice.

Automated checks cover semantic roles/labels, visible focus, contrast tokens, mobile overflow, local-only requests, and key result boundaries. Automated checks do not replace later manual assistive-technology testing.

## Motion

Only button hover/press feedback uses a short `80ms` transition. There is no auto-playing animation, blinking, marquee, audio, or animated decoration.

Under `prefers-reduced-motion: reduce`:

- smooth scrolling is disabled;
- animation and transition duration become `0.01ms`;
- button translations are removed.

## Dither and old-Internet motifs

The outer canvas uses a single restrained CSS radial point pattern at an eight-pixel grid. Results and body text do not receive noise, CRT, blur, scanline, or low-contrast overlays.

Permitted motifs in this implementation:

- strong rectangular window border;
- hard drop shadow;
- beveled control surfaces;
- tiny window squares;
- document/archive/computer icons;
- compact status bar;
- one footer badge.

## Visual regression matrix

Playwright runs against the built local Next.js application with pinned Chromium on Ubuntu and rejects non-local requests.

Committed snapshots:

1. default desktop, full page;
2. empty result, full page;
3. explicit unknown and publication-boundary legend, full page;
4. narrow mobile at `390 × 844`, full page;
5. keyboard-focused skip link, viewport;
6. reduced-motion, full page.

Interaction tests additionally prove search submission, query-string update, one-result state, and reset to the default five-result state.

Snapshots are updated only for reviewed intentional UI changes. A changed screenshot is not accepted merely because `--update-snapshots` succeeds.
