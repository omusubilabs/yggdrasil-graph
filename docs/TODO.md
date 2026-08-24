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

## Findings from the completion review

The 23 August 2026 completion review checked the closed items against the
production build and found four remaining gaps. These entries track the new
work without rewriting the original audit record above.

### P1 — before public launch

#### UXA-011 — Make graph target sizing shape-aware

- [x] Size every node halo from the rendered shape's actual width and height,
      not from a circle-equivalent radius alone.
- [x] Add a repeatable regression check for the minimum CSS-pixel target size
      at 1440 × 900, 390 × 844 and 320 × 720.

**Evidence:** `haloRadius()` floors a halo to 30 viewBox units, which produces a
60-unit circle but only a `sqrt(3) × 30`-unit vertical span for the hexagon used
by world and place nodes. In the production build, Midgard's halo measured
approximately 25.0 × 21.6 CSS px at 1440 × 900, 26.7 × 23.2 at 390 × 844 and
25.8 × 22.3 at 320 × 720. Its nearest neighbour is far enough away that the
collision cap is not the constraint, so the target can grow without creating
an exception to the layout-permits condition in UXA-001.

**Fixed:** `haloRadius()` in `src/graph/geometry.ts` computed one
circle-equivalent scalar and fed it into whichever shape `nodeShapePath()`
draws, without accounting for a shape's narrowest axis. Of the four shapes,
only the hexagon (world/place) is narrower than its own radius in any
direction — its vertical half-span is `r·sin(60°) ≈ 0.866r`, against `1.0r`
for the circle, the lozenge's horizontal axis, and the double-ring's outer
circle. A new `HALO_SHAPE_FACTOR` map divides the target radius by that ratio
for `world`/`place` before the existing neighbour-distance cap is applied, so
the hexagon's narrow axis reaches the same floor every other shape already
got directly; the cap itself needed no change; because its _widest_ axis
factor was already 1 for every shape, including the hexagon, clamping the
enlarged radius to the same `nearestNeighbourDistance / 2` bound still caps
the shape's largest extent exactly as before. `nodeShapePath()` and every
other shape are untouched, and since `GraphCanvas.astro` (build time) and
`src/graph/runtime.ts` (lazily-materialized nodes) both already call
`nodeShapePath(node.type, haloRadius(...))` through the same shared function,
the fix applies identically to both render paths with no duplicated logic.
`src/graph/geometry.test.ts` gained four cases: one asserting the hexagon's
vertical half-span analytically clears the 30-unit floor, one cross-checking
that floor against `nodeShapePath`'s actual emitted coordinates (so a
regression in the path math itself would also be caught, not only in the
compensation), one confirming the other five types are unchanged, and one
confirming the neighbour-distance cap still clamps a hexagon the same way it
clamps a circle.

The regression check is `scripts/check-target-size.ts`
(`npm run check:target-size`, wired into CI after `npm run build`, alongside
a new `npx playwright install --with-deps chromium` step), using a real
headless Chromium via a new `playwright` devDependency rather than
recomputing the CSS cascade by hand — a static recomputation would carry the
same drift risk CLAUDE.md already flags for the duplicated `LINK_DISTANCE`
constants in `scripts/build-graph.ts`/`src/graph/simulation.ts`, and this
check exists specifically to catch a future _layout_ regression, which only
a real renderer can. There are only four distinct node shapes, so it measures
one representative per shape (`odin` circle, `midgard` hexagon, `mjolnir`
lozenge, `mare` double-ring) rather than every entity — but not uniformly:
`odin` and `midgard` are cold-open core members and are measured on a plain
`/` visit, while `mjolnir` and `mare` have no core member of their shape at
all (confirmed against the live dataset — of 381 entities, only the
cold-open core's ~45 are cold-open-visible, and it contains zero `artifact`
or `form` nodes), so they're measured via `?selected=<id>`, the same
shareable URL-hydration path search already uses. That is not a workaround:
selecting a node re-fits the SVG `viewBox` to its neighbourhood
(`applyVisibility` in `runtime.ts`), so `?selected=` is the _only_ scenario in
which a reader ever sees those two shapes — an earlier version of this check
measured all four nodes that way uniformly, which measured `odin`'s
post-selection focus-zoom size instead of its cold-open size and produced a
false failure (20.0 × 20.0 px at 320 × 720) caught and corrected during
implementation, confirmed via direct browser inspection that `odin`'s and
`midgard`'s actual cold-open halos measure 29.9 × 29.9 and 29.7 × 25.7 px
respectively at that width. The check waits on
`document.documentElement.dataset.graphRuntime === 'ready'`, the exact signal
`runtime.ts` sets after materializing and resolving `?selected=`, rather than
a `networkidle` heuristic, and emulates `prefers-reduced-motion: reduce` so
the client-side force simulation never starts and positions stay pinned to
the deterministic layout.

A live-dataset query while closing this out found 15 of 42 `world`/`place`
nodes (all `place`, none in the cold-open core) still collision-capped below
the full uncapped hexagon target — e.g. `east-saxland`'s vertical half-span
is 25.29 of the ideal 30 viewBox units. None of them are cold-open targets,
so UXA-001's layout-permits exception does not need to be invoked for them,
but their real rendered size was checked directly rather than assumed: the
smallest, measured via `?selected=`, was 65.5 × 58.0 CSS px at 320 × 720 —
the neighbourhood-refit zoom that reveals them keeps every one comfortably
clear of the 24 × 24 floor. `npm run check:target-size` currently reports all
12 shape × viewport combinations passing; `npm run validate && npm run build`
run twice in a row still produces a byte-identical `src/generated/graph.json`,
confirming the shape-aware fix did not disturb build determinism.

**Done when:** Every intended cold-graph target measures at least 24 × 24 CSS
px at all three audited viewports unless a documented collision makes that
impossible; the check covers every node shape and fails if a later layout,
shape or scale change drops a dimension below the floor.

#### UXA-012 — Announce the complete active filter state

- [x] Choose the announcement from the full disputed/Ragnarǫk filter state
      after every change, including when one filter is cleared while the other
      remains active.
- [x] Use the same state-to-announcement path for direct interaction and
      query-string rehydration.

**Evidence:** Turning on disputed-only and then Ragnarǫk produced the live
status “Only Ragnarök. Showing 50 of 381 figures and 7 relations.” at
`?disputed=1&ragnarok=1`. Reloading that same URL instead produced “Only where
the sources disagree and only Ragnarök. Showing 50 of 381 figures and 7
relations.” The `bothOnAnnounce` key is used during hydration but never by the
change handlers, so the same graph state has two accessible descriptions.

**Fixed:** The two change handlers in `src/graph/runtime.ts` each read only
their own toggle's `.checked` state, so the announcement always described the
just-touched filter and stayed blind to the other one — that is what produced
“Only Ragnarök” while disputed was also on. Rehydration read both booleans
together, but through its own ad hoc `if`/`else if` chain, so the two paths
had no shared source of truth even though one of them was already correct. A
new pure module, `src/graph/filterAnnouncement.ts`, exports
`filterAnnouncementKey(disputed, ragnarok)` — a four-branch lookup with no DOM
dependency, following the existing `urlState.ts` precedent for logic that
needs to stay identical across a change handler and a hydration path. Both
change handlers now call it with both toggles' resulting state (e.g.
`disputedToggle.checked` alongside `ragnarokToggle?.checked ?? false`,
mirroring the idiom already used in `applyVisibility()`), and rehydration
calls the same function instead of its own chain, gated on `initial.disputed
|| initial.ragnarok` so a plain visit still announces nothing. A new locale
key, `filters.noneOnAnnounce`, covers the previously-unreachable “both filters
just turned off” state — a real user action that still needs an announcement,
unlike a plain page load. The old `disputedOffAnnounce` and
`ragnarokOffAnnounce` keys described “this toggle turned off” while staying
blind to the other filter — the mechanism of the bug itself — and were
confirmed dead by grep and removed from all seven locale files and from
`RUNTIME_KEYS` in `src/pages/graph/[locale].json.ts`.
`src/graph/filterAnnouncement.test.ts` covers all four reachable `(disputed,
ragnarok)` combinations. Verified by `npm run i18n:check`, `npm run
check:strings`, `npm run typecheck`, `npm test` (130 passing, including the
four new cases) and `npm run build`, plus direct browser reproduction of the
evidence scenario: toggling disputed then Ragnarök on now announces “Only
where the sources disagree and only Ragnarök…”, matching a reload of
`?disputed=1&ragnarok=1` exactly; toggling disputed back off with Ragnarök
still on correctly announces “Only Ragnarök…” rather than a disputed-only
message; toggling the last active filter off announces the new “No filters
active…” text; and both a plain visit and a reload of the bare URL stay
silent. Native screen reader, physical touch and real browser zoom/reflow are
still open, as flagged above.

**Done when:** Each direct filter change writes one concise, localised status
that describes every active filter and agrees with the visible counts; loading
the resulting URL produces the same state description without an extra write.

#### UXA-013 — Preserve restored state for reduced-motion users

- [ ] Prevent the reduced-motion status from replacing a restored selection or
      filter announcement in the shared live region.
- [ ] Keep page-load announcements singular and prioritise the restored graph
      state when a shareable query string is present.

**Evidence:** URL hydration writes the restored selection or filter state, then
the `prefersReducedMotion()` branch immediately writes `graph.motionReduced` to
the same status element. The second write becomes the final DOM state and can
coalesce the meaningful restoration announcement before assistive technology
receives it.

**Done when:** With reduced motion enabled, a plain visit may report the motion
mode once, while a URL carrying selection or filters reports the restored graph
state once and leaves that accurate status in the live region.

### P2 — next product-quality pass

#### UXA-014 — Align mobile-sheet semantics with its operable scope

- [ ] Use a coherent modal model in which all content outside the open sheet is
      unavailable, or remove global modal semantics and define a deliberately
      scoped non-modal sheet model.
- [ ] Verify the chosen model with pointer, keyboard and a desktop screen
      reader at both mobile audit sizes.

**Evidence:** The mobile sheet sets `role="dialog"` and `aria-modal="true"`, but
only the graph figure and graph controls become `inert`. Header navigation, the
language picker and the entity table remain operable outside a dialog that
claims the rest of the page is unavailable. The covered graph controls are
protected, but the declared modal boundary and the actual interaction boundary
do not match.

**Done when:** Pointer, keyboard and assistive-technology behaviour all agree
with the chosen semantics; if the sheet remains modal, focus and interaction
cannot leave it until close, and closing still restores the original graph or
search invoker across the 52rem breakpoint.

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
