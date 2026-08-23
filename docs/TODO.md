# Product-quality follow-up

This file tracks product, UX and accessibility work that remains after the
22 August 2026 pre-launch audit. Dataset and citation gaps belong in
[`data/TODO.md`](../data/TODO.md), not here.

The audited discovery journey was: understand the graph, search for Loki,
inspect Loki's neighbourhood, open the full entity account and reveal the
Ragnarǫk pattern. Desktop and mobile are both launch-critical. No
launch-blocking dead end was confirmed, but the P1 items below make the launch
a conditional go.

The measurements below come from browser inspection and captured screenshots.
They are evidence for prioritisation, not a claim of WCAG conformance. Native
screen-reader behaviour, physical touch use and browser zoom still require
explicit verification.

## Priority definitions

- **P1 — before public launch:** high-impact barriers in the core discovery
  journey.
- **P2 — next product-quality pass:** meaningful improvements to structure,
  mobile comprehension and action discoverability.
- **P3 — polish and regression protection:** copy and visual-token refinements
  that should travel with the next related change.

## P1 — before public launch

### UXA-001 — Make the cold graph legible and reliably targetable

- [x] Increase the graph's interactive hit areas without making the manuscript
      marks visually heavy.
- [x] Rebalance the mobile cold-open scale and label density so a first-time
      reader can identify useful starting points before searching.
- [x] Check crowded nodes for overlapping or ambiguous hit areas.

**Evidence:** At 390 × 844, all 45 inspected graph anchors measured below
24 × 24 CSS pixels; the smallest was approximately 5.3 × 6.9 pixels. Twenty-four
anchor pairs were less than 24 pixels apart centre-to-centre. Search and the
table view provide alternative access, but the graph itself is the product's
primary discovery surface.

**Fixed:** `.node__halo` was already sized to widen the hit area but never
received pointer events; it now does, and `haloRadius()` in
`src/graph/geometry.ts` sizes it to clear 24×24 CSS px at every audited width
without overlapping a neighbour. A `[data-graph-scale]` wrapper applies a
mobile-only CSS scale, gated by a `data-view-scope` attribute so it never
stacks with a search/selection/"show all" view. Verified by browser
inspection at all three widths; native screen reader, physical touch and real
browser zoom/reflow are still open, as flagged above.

**Done when:** The cold graph remains comprehensible at 1440 × 900, 390 × 844
and 320 × 720; intended graph targets have at least a 24 × 24 CSS-pixel hit area
where the layout permits; and any exception has an obvious equivalent path
that preserves the discovery journey. The deterministic prerendered layout,
lazy graph loading and JavaScript budget must remain intact.

### UXA-002 — Prevent the mobile detail sheet from hiding active controls

- [x] Choose and implement one coherent panel model: either make the bottom
      sheet modal while open, or reflow the page so covered controls are no
      longer interactive behind it.
- [x] Define initial focus, keyboard containment and focus restoration for that
      model.
- [x] Ensure pointer, keyboard and assistive-technology users cannot operate
      controls that are visually covered by the sheet.

**Evidence:** The open sheet covered about 99% of the graph controls at
390 × 844 and 74% at 320 × 720, while eight covered inputs or buttons remained
enabled and keyboard-focusable.

**Fixed:** Below the panel's existing `52rem` mobile breakpoint, the sheet now
behaves as a modal dialog: `src/graph/runtime.ts` marks the graph canvas and
`GraphControls` `inert` for as long as it is open, so the covered controls
leave the tab order, stop responding to pointer input and drop out of the
accessibility tree without any manual per-control bookkeeping. The panel
gains `role="dialog"` and `aria-modal="true"` only in that state, takes
initial focus itself (`EntityPanel.astro` now carries `tabindex="-1"`), traps
Tab/Shift+Tab among its own focusable elements, and closes on Escape from
anywhere inside it. Closing restores focus to whatever invoked the
selection — the graph node or the search result — not always the node as
before. Desktop keeps today's non-modal sidebar untouched. Verified by
browser inspection at 390 × 844, 320 × 720 and 1440 × 900: native screen
reader, physical touch and real browser zoom/reflow are still open, as
flagged above.

**Done when:** Tab and reverse-Tab expose only controls that are visually and
semantically available; Escape closes the sheet; focus returns to the invoking
graph or search target; and the behaviour holds at both audited mobile sizes.

### UXA-003 — Announce Ragnarǫk filter changes

- [x] Announce whether the overlay is on or off and the resulting figure and
      relation counts through the existing live-status mechanism.
- [x] Make query-string rehydration produce the same accurate accessible state
      without duplicate announcements.
- [x] Localise every new announcement in all complete locales.

**Evidence:** Toggling the overlay updated the SVG description to “45 of 381
figures and 62 relations”, but the live region stayed empty both after the
interaction and after URL-state rehydration.

**Fixed:** The root cause was one line, not a missing call: `src/graph/runtime.ts`
looked up `[data-graph-status]` scoped to `figure.querySelector(...)`, but the
prior UXA-002 fix had deliberately moved that element to a sibling of
`<figure>` so the figure's `inert` state couldn't silence it — leaving
`announce()` a permanent no-op for every existing announcement, not only the
Ragnarǫk overlay. The lookup now scopes to `document`. On top of that,
`disputedToggle` and `ragnarokToggle` gained `change` handlers that announce
one of five new localised keys (`filters.{disputed,ragnarok}{On,Off}Announce`,
`filters.bothOnAnnounce`) carrying the resulting figure and relation counts,
mirroring the existing `showAllToggle` pattern. URL rehydration announces the
restored filter state only when no selection is also being restored — a
restored selection's own announcement takes priority so the live region never
receives two writes for one page load, and a plain visit with no query
string still announces nothing. Verified by browser inspection at 1440×900
and 390×844: native screen reader, physical touch and real browser zoom/reflow
are still open, as flagged above.

**Done when:** A screen reader receives one concise, localised status update
after each filter change, the visible and announced counts agree, and URL state
restores the same accessible description as direct interaction.

## P2 — next product-quality pass

### UXA-004 — Give the graph page a real first-level heading

- [x] Add a visible or appropriately visually-hidden `h1` that names the page
      and preserves the existing visual hierarchy.

**Evidence:** The home page had no `h1`; its heading outline began with hidden
`h2` elements. Entity pages already use a proper `h1`.

**Fixed:** `src/components/HomeView.astro` now renders a
`<h1 class="visually-hidden">{t('site.title')}</h1>` as the first element on
the page, ahead of the graph. It reuses the existing `site.title` string (the
same text already visible in the header wordmark and already used to build
`<title>`), so no new i18n key or translation work was needed. Kept hidden
rather than visible because the wordmark already shows the site name visibly
in the header on every page — a second visible copy directly below it would
have altered the existing visual hierarchy the item asks to preserve. The
outline is now sequential: `h1` → `h2` (graph region label) → `h2` (panel
title) → `h2` (table heading). Verified by browser inspection at 1440×900 and
390×844; native screen reader is still open, as flagged above.

**Done when:** The document outline starts with one descriptive `h1`, heading
levels remain sequential and the first-level name is useful outside visual
context.

### UXA-005 — Reduce mobile header pressure

- [ ] Replace or compact the always-expanded language list at narrow widths.
- [ ] Preserve a discoverable language control and restore useful introductory
      context where space permits.

**Evidence:** At 390 pixels wide, the header consumed about 189 pixels of
vertical space and the tagline disappeared, delaying the graph while removing
its clearest statement of purpose.

**Done when:** The primary graph and its purpose are visible materially earlier
at 390 × 844 and 320 × 720, every locale remains keyboard-accessible and the
control does not introduce horizontal overflow.

### UXA-006 — Enlarge compact touch controls

- [ ] Increase the close and zoom controls toward a comfortable 44 × 44
      CSS-pixel touch area without visually overpowering the graph.

**Evidence:** The close control measured roughly 31 × 29 pixels and zoom
controls roughly 32 × 31 pixels. They clear a 24-pixel minimum but remain small
for frequent touch use.

**Done when:** The controls have comfortable, non-overlapping hit areas at both
mobile audit sizes and retain visible keyboard focus.

### UXA-007 — Surface the full entity account as an explicit action

- [ ] Add a clearly labelled action near the detail-panel heading that opens
      the complete entity page.
- [ ] Keep the current linked title only if it remains useful as a secondary
      path.

**Evidence:** The complete-account link appears after a long internal scroll.
The title is also a link, but that behaviour is not apparent to a first-time
reader.

**Done when:** The action is visible without scrolling when a panel opens, has
a descriptive accessible name and preserves selection and URL-state behaviour
when the reader returns.

## P3 — polish and regression protection

### UXA-008 — Use input-neutral graph guidance

- [ ] Replace “Touch a name” and equivalent translations with wording such as
      “Select a name” that covers pointer, touch and keyboard input.

**Done when:** All complete locales use input-neutral guidance and
`npm run check:strings` still passes.

### UXA-009 — Protect text-contrast margin

- [ ] Increase the margin above the minimum for faded text and verdigris text,
      then protect the relevant token combinations with a repeatable check.

**Evidence:** Computed contrast was approximately 4.60:1 for faded text and
4.55:1 for verdigris text. Both passed the audited normal-text threshold, but
small token or rendering changes could erase that margin.

**Done when:** The affected normal-text combinations retain a deliberate safety
margin above 4.5:1 across the supported states without reusing `--minium` as a
decorative colour.

## Verification checklist

Run this checklist when closing any item above:

- [ ] Capture desktop at 1440 × 900 and mobile at 390 × 844 and 320 × 720.
- [ ] Exercise search with Arrow Down and Enter, graph traversal and selection,
      Escape, reverse-Tab and focus restoration.
- [ ] Reopen selection, filters and the Ragnarǫk overlay from their shareable
      query strings.
- [ ] Test one desktop screen reader, reduced motion, 200% zoom and 400% reflow;
      record confirmed behaviour separately from visual inference.
- [ ] Confirm there is no horizontal overflow or covered focus target.
- [ ] Run `npm run i18n:check`, `npm run check:strings`, `npm run typecheck`,
      `npm test` and `npm run build`.
