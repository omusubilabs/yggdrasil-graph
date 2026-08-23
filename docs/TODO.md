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

- [x] Replace or compact the always-expanded language list at narrow widths.
- [x] Preserve a discoverable language control and restore useful introductory
      context where space permits.

**Evidence:** At 390 pixels wide, the header consumed about 189 pixels of
vertical space and the tagline disappeared, delaying the graph while removing
its clearest statement of purpose.

**Fixed:** `LanguagePicker.astro`'s always-expanded seven-locale list — the
dominant contributor to the header height, not the tagline — is now a native
`<details>/<summary>` disclosure, collapsed by default at narrow widths with
zero JavaScript. The summary shows the current locale's endonym (e.g.
"English") with an author-drawn `▾`/`▴` indicator, and its accessible name
comes from the previously unused, already-fully-translated `nav.languageCurrent`
key ("Current language: {name}") rather than the list's old static "Language"
label. Above `SiteHeader.astro`'s existing 40rem breakpoint the list is forced
visible regardless of the `<details>` element's `open` state, via CSS
overriding the UA stylesheet's collapse rule, so desktop keeps today's
always-expanded flat list unchanged. With the language list no longer wrapping
across several rows, `SiteHeader.astro` narrowed the tagline's hide breakpoint
from 40rem to 22.5rem: the tagline now reappears at 390 pixels, where the
freed vertical space accommodates it, while staying hidden at 320 pixels,
where its `44ch` max-width would otherwise wrap and re-add height. Verified by
browser inspection at 1440×900, 390×844 and 320×720 (including the `nb` locale
at 320×720, since "Norsk bokmål" is the longest endonym): header height drops
from ~189px to ~152px at 390 wide and ~107px at 320 wide, with no horizontal
overflow at either width; native screen reader is still open, as flagged
above.

**Done when:** The primary graph and its purpose are visible materially earlier
at 390 × 844 and 320 × 720, every locale remains keyboard-accessible and the
control does not introduce horizontal overflow.

### UXA-006 — Enlarge compact touch controls

- [x] Increase the close and zoom controls toward a comfortable 44 × 44
      CSS-pixel touch area without visually overpowering the graph.

**Evidence:** The close control measured roughly 31 × 29 pixels and zoom
controls roughly 32 × 31 pixels. They clear a 24-pixel minimum but remain small
for frequent touch use.

**Fixed:** A new `--touch-target: 2.75rem` (44px) token in
`src/styles/tokens.css` sets `min-width`/`min-height` on `.panel__close` in
`EntityPanel.astro` and on the zoom-group buttons (`+`, `−`, `Recentre`) in
`GraphControls.astro`, with `display: inline-flex` centring so the glyph
stays centred once the box grows past its content size. Neither button's
visible chrome (border, background, font size) changed, so the hit area grew
without the controls reading as heavier — `.panel__close` has no background
or border until hover, and `.controls` buttons keep their existing subtle
vellum fill. The zoom-group sizing rule is scoped to `.controls__group
button` rather than the broader `.controls button`, so the separate "clear
selection" button (not part of this item) was left untouched, confirmed
unchanged at ~162×31px by inspection. `.controls__group`'s `gap: -1px` — 
invalid CSS that browsers silently ignore, collapsing to `gap: 0` — was
replaced with a real `gap: var(--space-2xs)` (4px), giving the three
now-larger zoom buttons an actual buffer instead of flush borders. Verified
by browser inspection at 1440×900, 390×844 and 320×720: close and all three
zoom-group buttons measure exactly 44×44 CSS px with no horizontal overflow,
the keyboard focus-visible outline (2px verdigris, 2px offset) renders in
full without being clipped by a neighbouring button, and the "clear
selection" button's size is unaffected. Native screen reader, physical touch
and real browser zoom/reflow are still open, as flagged above.

**Done when:** The controls have comfortable, non-overlapping hit areas at both
mobile audit sizes and retain visible keyboard focus.

### UXA-007 — Surface the full entity account as an explicit action

- [x] Add a clearly labelled action near the detail-panel heading that opens
      the complete entity page.
- [x] Keep the current linked title only if it remains useful as a secondary
      path.

**Evidence:** The complete-account link appears after a long internal scroll.
The title is also a link, but that behaviour is not apparent to a first-time
reader.

**Fixed:** `EntityPanel.astro`'s `.panel__bar` now holds a `.panel__bar-row`
(title + close, unchanged) followed by a new `.panel__view-full` link, so the
action sits in the panel's fixed, non-scrolling header — above `.panel__body`,
which is the only part of the panel that scrolls — and is therefore visible
the instant a panel opens, on both the desktop sidebar and the mobile sheet.
It is styled after `.controls__clear`'s existing verdigris-wash "highlighted
action" treatment, distinct from the plain in-body links, with a
`--touch-target` (44px) minimum height. `src/graph/runtime.ts`'s `renderPanel`
sets its `href` and text (`panel.viewFull`, new key in all seven locale
`ui.json` files and in `RUNTIME_KEYS`) alongside the existing title-link build,
using a plain `<a href>` rather than JS-driven navigation. The linked title is
kept unchanged as a secondary path; the existing `panel.readMore` link at the
foot of the panel body is also kept, since it still works and needed no
scoped-in changes. Because `selected` is already written into the query
string via `replaceState` before any click can occur, browser Back from the
full entity page reopens the graph with the same node selected with no new
state-handling code. Verified by browser inspection at 1440×900, 390×844 and
320×720: the action renders without scrolling, measures 44px tall with no
horizontal overflow at 320px wide, sits in logical tab order between the title
and the relations list inside the mobile modal dialog, and correctly carries
selection through a full navigate-away-and-Back round trip; confirmed the
`ja` translation ("詳細を見る") also fits without wrapping. Native screen
reader, physical touch and real browser zoom/reflow are still open, as
flagged above.

**Done when:** The action is visible without scrolling when a panel opens, has
a descriptive accessible name and preserves selection and URL-state behaviour
when the reader returns.

## P3 — polish and regression protection

### UXA-008 — Use input-neutral graph guidance

- [x] Replace “Touch a name” and equivalent translations with wording such as
      “Select a name” that covers pointer, touch and keyboard input.

**Done when:** All complete locales use input-neutral guidance and
`npm run check:strings` still passes.

### UXA-009 — Protect text-contrast margin

- [x] Increase the margin above the minimum for faded text and verdigris text,
      then protect the relevant token combinations with a repeatable check.

**Evidence:** Computed contrast was approximately 4.60:1 for faded text and
4.55:1 for verdigris text. Both passed the audited normal-text threshold, but
small token or rendering changes could erase that margin.

**Fixed:** The margin was worse than the evidence above shows: against
`--vellum-deep` (the darker panel surface), both tokens already failed 4.5:1
outright (`--ink-faded` 3.86:1, `--verdigris` 3.82:1) — a real, live pairing
in `RelatedByTag.astro`'s tag pills and `CitationList.astro`'s citation
pills, not a hypothetical. `src/styles/tokens.css` darkens `--ink-faded` from
`#6c6153` to `#584d40` and `--verdigris` from `#2e6e5e` to `#215347`, clearing
5:1 against every vellum surface (`--vellum`, `--vellum-deep`,
`--vellum-pale`) while staying visibly lighter than their existing darker
partners (`--ink-faded`'s `prefers-contrast: more` override and
`--verdigris-deep`). The `prefers-contrast: more` block in `global.css` also
gained a `--verdigris: var(--verdigris-deep);` override — it previously had
none, leaving verdigris at the thin default margin even in the
enhanced-contrast state — accepting that link hover becomes visually
identical to the resting colour in that mode (the underline and focus ring
still change). The repeatable guard is `scripts/check-contrast.ts`
(`npm run check:contrast`, wired into CI): it reads the hex values straight
out of `tokens.css`/`global.css`, computes WCAG contrast for `--ink-faded`,
`--verdigris` and `--verdigris-deep` against all three vellum tokens in both
states, and fails if any combination drops below a 5:1 floor — a deliberate
margin above the 4.5:1 minimum, not the thinnest value that happens to pass.
Verified by the script (18/18 combinations pass), `npm run build`, and
browser inspection of the entity page and graph page.

**Done when:** The affected normal-text combinations retain a deliberate safety
margin above 4.5:1 across the supported states without reusing `--minium` as a
decorative colour.

### UXA-010 — Fix the class-hue tokens' incorrect contrast claim

- [x] Verify the actual contrast of each `--class-*` token (see
      `src/styles/tokens.css`) against the backgrounds it can render on, and
      either correct the values or correct the comment.

**Evidence:** While investigating UXA-009, `--class-artifacts` (`#8a6a1c`)
measured 3.84:1 against `--vellum` and `--class-vanir`/`--class-humans` both
measured below 4.5:1 against `--vellum-deep` — contradicting the tokens.css
comment claiming "all six are dark enough to clear 4.5:1 against `--vellum`
as text." These tokens are currently used only as SVG `fill`/`stroke` on
graph nodes (`GraphCanvas.astro`), never as text colour, so WCAG's non-text
3:1 rule (1.4.11) applies today, not the 4.5:1 text rule the comment
describes — but the comment is factually wrong as written and would mislead
anyone who reuses these tokens as text colour later.

**Fixed:** The comment was wrong on more than the contrast rule: its
six-line pigment story (Æsir, Vanir, Jǫtnar, Beings, Worlds, Artifacts) never
covered `--class-humans` (`#65506f`) at all, so "all six" undercounted the
seven `--class-*` tokens that actually exist before the contrast math even
came into it. `src/styles/tokens.css` gains a Humans line — orchil, a
lichen dye, prized but fugitive, fitting for the one class here that is
mortal rather than divine, monstrous, elemental or wrought — and the closing
claim now says "all seven," names the rule that actually governs current
usage (WCAG 1.4.11's 3:1 non-text floor, since these are SVG fill/stroke and
never text), and states plainly that not all seven clear 4.5:1 as text
today (`--class-artifacts` fails against every vellum surface;
`--class-vanir` fails against `--vellum-deep`), so a future reuse as text
colour has to re-check rather than trust the old claim. The palette itself
was left untouched — darkening `--class-artifacts` or `--class-vanir` to
satisfy a text rule that applies to no current usage would have dulled
deliberate pigment choices (artifacts is specifically "the closest a scribe
got to gold") for no live accessibility benefit. `scripts/check-contrast.ts`
gained a second, parallel check — all seven `--class-*` tokens against the
three vellum surfaces at the 3:1 non-text floor, reusing the script's
existing hex-parsing helpers — so the corrected claim is enforced by
`npm run check:contrast` (already wired into CI) the same way the UXA-009
claim is, rather than left as an assertion in a comment. Verified by the
script (39/39 combinations pass, 21 of them the new non-text rows) and
`npm run build`.

**Done when:** The tokens.css comment accurately describes the actual,
verified contrast of each `--class-*` token against the backgrounds it is
used on, or the values are corrected to make the original claim true.

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
