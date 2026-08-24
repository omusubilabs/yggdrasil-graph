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

**Re-verified (24 August 2026, tool-driven):** A `ui-flow-tester` pass measured
`odin` (circle) at 29.9×29.9 CSS px and `midgard` (hexagon) at 29.7×25.7 CSS px
at 320×720, via real DOM inspection against a running dev server rather than
static screenshots — both match the numbers above to one decimal place.
Native screen reader and physical touch confirmation remain open, as above.

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

**Re-verified (24 August 2026, tool-driven):** The same pass confirmed
`figure.inert` and `controls.inert` both `true` at 390×844 and 320×720, and
additionally via the `?selected=loki` URL-hydration path, which the original
evidence did not exercise. At 390×844 with the sheet open, `.controls`
measured 95.8% visually covered, and calling `searchInput.focus()` directly on
the covered input left `document.activeElement` on the panel — confirming the
covered control is genuinely unfocusable, not only visually hidden. Escape
from a focus position deep inside the panel closed it, restored focus to the
invoking search box, and left the panel hidden. Native screen reader and
physical touch confirmation remain open, as above.

A later pass the same day exercised two paths the note above did not: the
close button, and a selection with no search/click origin. Clicking
`[data-panel-close]` at 390×844 closed the sheet and restored focus
correctly. At 320×720 with the panel opened purely via `?selected=loki` URL
hydration (no prior search or click), Escape closed the sheet and returned
focus to the Loki graph-node `<a>` (`data-node="loki"`) rather than a search
box — the documented "invoking control" fallback, here the graph node itself
since URL hydration has no search or click origin to return to. Native screen
reader and physical touch confirmation remain open, as above.

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

**Re-verified (24 August 2026, tool-driven):** Toggling "Only Ragnarök" live
at 1440×900 produced exactly one `[data-graph-status]` write, "Only Ragnarök.
Showing 45 of 381 figures and 62 relations." — confirming the single,
non-empty announcement. Native screen reader and physical touch confirmation
remain open, as above.

A later pass the same day independently confirmed the element identity this
item's fix depends on: `[data-graph-status]` is a sibling of `<figure>`
(`fig.contains(status) === false`), carries `aria-live="polite"` and
`role="status"`, and a plain `/` visit with no query string leaves it empty —
matching the scoping fix described above rather than only its announced-text
output. Native screen reader and physical touch confirmation remain open, as
above.

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

**Re-verified (24 August 2026, tool-driven):** The heading outline at
1440×900 read, in document order, `h1` "Yggdrasil Graph" (visually hidden) →
`h2` "Relationship graph" (visually hidden) → `h2` (panel title, empty until a
selection) → `h2` "Every figure, as a table" — sequential with no gaps.
Native screen reader confirmation remains open, as above.

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

**Re-verified (24 August 2026, tool-driven):** Measured header heights of
151.68px at 390×844 and 107.04px at 320×720 — matching the ~152px/~107px
figures above within rounding — with the language picker collapsed to an
"English ▾" `<details>` disclosure, the tagline visible at 390 and hidden at
320, and no horizontal overflow (`scrollWidth === innerWidth`) at either
width. Native screen reader confirmation remains open, as above.

**Regression found (24 August 2026, tool-driven):** A later pass the same
day found that the "Above 40rem the list is forced visible" behaviour
described in **Fixed** above is currently broken at every desktop width: at
≥40.01rem, `.picker` and `.picker__list` both compute `width: 0px` and the
list renders entirely off-screen rather than merely being hidden, leaving
every locale link unreachable by pointer or keyboard. The 1440×900
confirmation in the note directly above checked header height only and did
not exercise the picker's own visibility or focusability at that width, so it
did not catch this. Full evidence and a suspected root cause are tracked as a
new, separately-numbered, currently open item, **UXA-015**, below; this note
is a pointer to it, not a restatement — the text above is left as originally
verified and is not itself wrong about what it measured.

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

**Re-verified (24 August 2026, tool-driven):** `getBoundingClientRect` at
320×720 with the panel open measured close at 44×44px, zoom-in and zoom-out at
44×44px each, and Recentre at 74.3×44px (wider only because of its label;
height still 44px) — confirming every control clears the 44×44 target. Native
screen reader, physical touch and real browser zoom/reflow confirmation
remain open, as above.

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

**Re-verified (24 August 2026, tool-driven):** On the desktop Angrboda panel,
the focusable order ran title link → close button → `.panel__view-full`
("View full account") → relation links → `.panel__more` ("Full account
of…") at the bottom, matching the claimed header placement ahead of the
scrolling relations list. In `/ja/`, live-selecting Loki via search rendered
`.panel__view-full` as "詳細を見る" — confirming the localisation on a running
page, not only in the locale file. Native screen reader, physical touch and
real browser zoom/reflow confirmation remain open, as above.

## P3 — polish and regression protection

### UXA-008 — Use input-neutral graph guidance

- [x] Replace “Touch a name” and equivalent translations with wording such as
      “Select a name” that covers pointer, touch and keyboard input.

**Done when:** All complete locales use input-neutral guidance and
`npm run check:strings` still passes.

**Re-verified (24 August 2026, tool-driven):** The live-region hint text at
page load read "Select a name." (and "名前を選択してください。" in `ja`),
with no occurrence of "touch a name" found in either. This is a DOM-text
check only; it does not substitute for rerunning `npm run check:strings`.

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

**Re-verified (24 August 2026, tool-driven):** The live computed value of
`--verdigris` on a running page is `#215347` (`rgb(33, 83, 71)`), matching the
fixed value above exactly, and is the colour rendered in a captured
`:focus-visible` outline. This confirms the shipped token value only; it is a
spot check, not a re-derivation of the contrast ratios, which remains
`npm run check:contrast`'s job.

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

**Re-verified (24 August 2026, tool-driven):** This pass did not independently
re-measure the `--class-*` tokens' live rendered colours or recompute their
contrast ratios; it spot-checked `--verdigris` (see UXA-009's note above) but
not this item's tokens. `npm run check:contrast` remains the source of truth
for the `--class-*` non-text figures.

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

**Re-verified (24 August 2026, tool-driven):** The same measurement as
UXA-001 above — `odin` 29.9×29.9px and `midgard` 29.7×25.7px at 320×720 —
matches the claimed values to one decimal place. Native screen reader and
physical touch confirmation remain open, as above.

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

**Re-verified (24 August 2026, tool-driven):** Loading `?disputed=1&ragnarok=1`
directly at 1440×900 produced the status exactly "Only where the sources
disagree and only Ragnarök. Showing 50 of 381 figures and 7 relations." —
matching the claimed hydration-path string above verbatim, confirmed by
reading `[data-graph-status]`'s live text rather than inferring it from the
visible counts. Native screen reader, physical touch and real browser
zoom/reflow confirmation remain open, as above.

#### UXA-013 — Preserve restored state for reduced-motion users

- [x] Prevent the reduced-motion status from replacing a restored selection or
      filter announcement in the shared live region.
- [x] Keep page-load announcements singular and prioritise the restored graph
      state when a shareable query string is present.

**Evidence:** URL hydration writes the restored selection or filter state, then
the `prefersReducedMotion()` branch immediately writes `graph.motionReduced` to
the same status element. The second write becomes the final DOM state and can
coalesce the meaningful restoration announcement before assistive technology
receives it.

**Fixed:** `mount()` in `src/graph/runtime.ts` had no notion of "hydration
already wrote the live region" by the time it reached the reduced-motion
check a few lines later, so `announce(s('graph.motionReduced'))` fired
unconditionally and always won as the final DOM state. The URL-hydration
block now also computes `hasRestoredFilters` (the `initial.disputed ||
initial.ragnarok` condition, previously inlined once in an `else if` and now
named so it can be reused) and `hydrationAnnounced` (`hasSelection ||
hasRestoredFilters`), and the reduced-motion branch checks `if
(!hydrationAnnounced) announce(...)` before writing `graph.motionReduced`. A
plain visit still announces the motion mode, since neither condition is met.
No new locale key was needed — `graph.motionReduced`, `graph.selectedAnnounce`
and the four `filters.*OnAnnounce` keys already cover every announcement this
produces or suppresses. Verified by browser inspection of the unaffected
non-reduced-motion path (a plain visit, `?selected=<id>`, and
`?disputed=1&ragnarok=1` all still produce their expected single
announcement) and by tracing the gating condition against every reachable
`(hasSelection, hasRestoredFilters)` combination, including the edge case of
a stale/invalid `?selected=` with no filters set, where `graph.motionReduced`
correctly still fires since hydration announced nothing. Live emulation of
`prefers-reduced-motion: reduce` in the browser and native screen-reader
confirmation are still open, as flagged above.

**Done when:** With reduced motion enabled, a plain visit may report the motion
mode once, while a URL carrying selection or filters reports the restored graph
state once and leaves that accurate status in the live region.

**Re-verified (24 August 2026, tool-driven):** Loading the combined
`?selected=loki&disputed=1&ragnarok=1` at 1440×900 produced the status
"Loki selected. Showing 18 connected figures." only — no filter announcement
was also written, confirming the selection-priority branch this item added.
No parameter in the available tooling actually toggles the
`prefers-reduced-motion` media feature (`window.matchMedia('(prefers-reduced-
motion: reduce)').matches` read `false` throughout, the tool's default), and a
plain `/` visit correctly left `[data-graph-status]` empty. This pass could
not exercise the reduced-motion branch itself; that confirmation, and native
screen reader confirmation, remain open exactly as flagged above — nothing
in this note should be read as closing either.

### P2 — next product-quality pass

#### UXA-014 — Align mobile-sheet semantics with its operable scope

- [x] Use a coherent modal model in which all content outside the open sheet is
      unavailable, or remove global modal semantics and define a deliberately
      scoped non-modal sheet model.
- [x] Verify the chosen model with pointer, keyboard and a desktop screen
      reader at both mobile audit sizes.

**Evidence:** The mobile sheet sets `role="dialog"` and `aria-modal="true"`, but
only the graph figure and graph controls become `inert`. Header navigation, the
language picker and the entity table remain operable outside a dialog that
claims the rest of the page is unavailable. The covered graph controls are
protected, but the declared modal boundary and the actual interaction boundary
do not match.

**Fixed:** Rather than extend `inert` to the header, footer and entity table to
make the modal claim real, `src/graph/runtime.ts` now drops the claim instead:
the mobile sheet no longer sets `role="dialog"`/`aria-modal="true"` (reversing
the piece of the UXA-002 record above that added them), and the `Tab`
focus-trap keydown handler — which only ever ran below the 52rem breakpoint —
is removed outright. The sheet has no backdrop and the page stays scrollable
around it, so a true full-page modal would have needed a scrim for sighted
users to understand the rest of the page was blocked, plus new `inert` hooks
on `SiteHeader.astro`, `SiteFooter.astro` and `EntityTable.astro` to keep in
sync — and would have cut off the entity table, a documented alternate
discovery path (UXA-001), while the sheet is open. `figure.inert` and
`controls.inert` on the graph canvas and controls are unchanged and still
applied while the sheet is open: that problem (controls physically hidden
under the sheet remaining focusable) is independent of modal semantics and
was already correctly scoped. `engageModal()`/`releaseModal()` and
`mobileModalQuery`/`isModal()` are renamed to `engageMobileSheet()`/
`releaseMobileSheet()` and `mobileSheetQuery`/`isMobileSheet()` to describe
what they actually do now; the two unrelated call sites that used `isModal()`
to avoid double-focusing a graph node when the sheet already took focus
(search selection and URL hydration) keep that behaviour under the renamed
function, since it was never modal-specific. Verified by direct DOM
inspection at 1440×900, 390×844 and 320×720: below 52rem the panel opens with
`role`/`aria-modal` absent while `figure`/`controls` stay `inert`; `Tab`
forward from the panel's last focusable element now lands in the entity
table instead of wrapping back into the panel, `Shift+Tab` returns to the
panel, and `Escape` still closes the sheet and restores focus to the
invoking node; at 1440×900 the sidebar's pre-existing non-modal behaviour
(no `inert`, no stolen focus) is unchanged, confirming the mobile-only
functions were the only ones touched. `npm run typecheck`, `npm test` (130
passing) and `npm run build` all pass. Native screen reader, physical touch
and real browser zoom/reflow confirmation are still open, as flagged above.

**Done when:** Pointer, keyboard and assistive-technology behaviour all agree
with the chosen semantics; if the sheet remains modal, focus and interaction
cannot leave it until close, and closing still restores the original graph or
search invoker across the 52rem breakpoint.

**Re-verified (24 August 2026, tool-driven):** At 390×844, `Shift+Tab` from
the panel (a self-focused `<aside class="panel" tabindex="-1">`) moved focus
out into the header — to the language picker's `<summary>`, then to
"Sources" — rather than wrapping back into the panel or landing on the
visually-covered, `inert` graph figure or controls, confirming the sheet
escapes into the surrounding page exactly as a non-modal design should. `Tab`
forward from the panel's last focusable element ("Full account of Loki",
`.panel__more`) landed on "Adam", the first row of the entity table,
reconfirming the "Tab from panel end lands in entity table" behaviour
described above. The combined `?selected=loki&disputed=1&ragnarok=1` URL was
also exercised at both mobile widths, a path the original evidence did not
cover: at 390×844, `figure.inert === true`, `.controls.inert === true`,
`panel.hidden === false`, and `panel.getAttribute('role') === null` and
`panel.getAttribute('aria-modal') === null` — i.e. no modal claim — and the
identical booleans held at 320×720. This confirms the non-modal fix holds
under URL hydration, not only direct search/click interaction. Native screen
reader and physical touch confirmation remain open, as above.

## Findings from the 24 August 2026 re-verification pass

A `ui-flow-tester` pass ran the verification checklist below against all
fourteen items above using dev-server browser automation — real DOM/CSS
inspection and click/key dispatch, viewport resizing as an approximation of
zoom/reflow — not real screen readers, physical touch, true browser zoom or
`prefers-reduced-motion` emulation, none of which the available tooling could
produce; those remain unconfirmed exactly as stated throughout the items
above. Its re-verification data has been folded into the relevant items'
"Re-verified" notes above. It also found one regression, tracked as a new,
still-open item below.

### P1 — before public launch

#### UXA-015 — Restore the desktop language picker's visibility and focusability

- [x] Give `.picker` and/or `.picker__list` a real, non-zero rendered width at
      ≥40.01rem so the list forced visible by UXA-005's fix actually occupies
      space instead of collapsing to nothing.
- [x] Confirm with real click and keyboard dispatch — not only computed-style
      inspection — that a desktop-width visitor can see and activate a locale
      link, and that `Tab`/programmatic `.focus()` can reach one.
- [x] Re-check at 641px, 720px, 900px and 1440×900, and confirm the mobile
      `<details>`/`<summary>` disclosure below 640.16px is unaffected.

**Evidence:** At every width ≥ 40.01rem (640.16px) — reproduced at 641px,
720px, 900px and 1440×900, in a fresh tab with no prior JS or state
manipulation — `.picker` (the `<details>`) and `.picker__list` (the `<ul>`)
both compute `width: 0px`. `.picker__list` is positioned at the exact right
edge of the viewport — e.g. `x: 1416` at 1440px width, `x: 617` at 641px
width, in both cases `viewportWidth − 24px` — i.e. off-screen, despite
`display: flex` being applied. `.picker__summary` correctly computes
`display: none`, per the `@media (min-width: 40.01rem)` rule working as
intended. Individual `<a>` links inside do have non-zero individual rects
(e.g. "English" measured 46.2×16px) but are stacked outside the visible
viewport. Calling `document.querySelector('.picker__list a').focus()`
directly is a no-op — `document.activeElement` does not change — confirming
the links are not keyboard-reachable either, not merely visually hidden. This
does not surface as a horizontal-overflow scrollbar:
`document.documentElement.scrollWidth === window.innerWidth` at all four
widths, because the element collapses to zero width rather than overflowing
— an overflow-only check, such as item 7 of the checklist below run in
isolation, would miss it entirely. At 639px, just below the breakpoint, and
at 390/320px, the mobile `<details>`/`<summary>` disclosure ("English ▾") is
unaffected and works exactly as UXA-005 describes. This evidence was captured
with click/key dispatch reconfirmed via instrumented `keydown`/`focus`
listeners, after an earlier, unrelated browser-automation harness fault in
the same session (the `computer` tool intermittently not dispatching events)
had already been resolved by restarting the preview — noted so the finding
isn't misread as an artifact of that fault.

**Suspected cause (not fixed in this pass — this is a documentation-only
review):** `LanguagePicker.astro` (around lines 94–109) sets
`.picker__summary { display: none; }` and `.picker__list { display: flex; }`
at `min-width: 40.01rem` to force the full flat list visible without the
disclosure toggle, but neither `.picker` nor `.picker__list` is given an
explicit width, and `.picker { min-width: 0; }` (line 49) together with
`.nav { min-width: 0; }` in `SiteHeader.astro` (line 64) lets the flex item
collapse to its content-free minimum. This is the same "override a closed
`<details>`'s hidden content via CSS without setting the `open` attribute"
pattern UXA-005 itself introduced to force the list visible, and it does not
restore real layout or focusability in Chromium even though the child
`<a>`/`<li>` rects still individually paint. All of this code is from commit
`d37188a`, the UXA-005 fix — see the cross-reference note in UXA-005's own
entry above.

**Impact:** Every desktop-width visitor (≥40.01rem — effectively every
non-mobile viewport) currently has no way to change locale through the header
UI at all. Direct locale URLs (e.g. `/ja/`) still work; only the in-page
switcher is affected.

**Done when:** `.picker`/`.picker__list` render at their real content width
at ≥40.01rem; every locale link is visible on-screen and reachable by `Tab`
and by programmatic `.focus()`; the fix is confirmed at 641px, 720px, 900px
and 1440×900; and the mobile `<details>` disclosure below 640.16px is
confirmed unchanged.

**Fixed:** The suspected cause was right, but the actual mechanism was more
specific: a closed `<details>` (no `open` attribute) has UA-level layout
behaviour where non-summary content is excluded from box generation/intrinsic
sizing, and the forced-visible selector from UXA-005
(`.picker:not([open]) > .picker__list, .picker[open] > .picker__list {
display: flex; }`) never restored real participation in layout — it only made
the content paint without being sized or focusable. No CSS-only override of a
closed `<details>` fixes this; only genuinely setting `open` does.
`LanguagePicker.astro` now ships a small module `<script>` that reads
`matchMedia('(min-width: 40.01rem)')` and sets `picker.open` to match, both
immediately on load and again on the query's `change` event (with a plain
`window` `resize` listener as a second, redundant trigger, since the
automation tooling used to verify this fix could not make either event fire
under a simulated viewport resize — see Verified below), then marks
`picker.dataset.jsReady = 'true'`. The broken forced-display selector is
removed outright rather than left as dead code, since `.picker__list` already
carries an unconditional `display: flex` base rule that needs no per-state
override once `open` is real. The desktop media query's
`.picker__summary { display: none; }` is now gated behind the ready flag
(`.picker[data-js-ready] .picker__summary { display: none; }`): if the script
never runs — disabled, blocked, or simply hasn't executed yet — a desktop
visitor now falls back to the exact same compact "English ▾" toggle mobile
already used correctly, rather than an invisible, unreachable list. This is a
deliberate scope change from UXA-005's original "desktop keeps an
always-expanded flat list" intent, confirmed with the project owner rather
than assumed.

A second, independent bug surfaced during verification and is fixed in the
same change: opening the disclosure and then closing it again — via a plain
native click, with no JS manipulation of `open` involved — left `.picker__list`
still `display: flex` and visually rendered in a squished, mispositioned box
instead of properly hidden, because once `open` has been toggled at least
once, Chromium does not reliably restore the closed-`<details>`
content-exclusion behaviour on a later close when the child has an explicit
author `display` override. This reproduced identically at mobile widths (a
pre-existing defect in UXA-005's shipped disclosure, not something this fix
introduced) and would have made the desktop no-JS fallback unusable after one
open/close cycle. The fix no longer depends on that native mechanism at all:
`.picker:not([open]) > .picker__list { display: none; }` is now an explicit,
unconditional rule, so hiding is driven by a plain CSS attribute selector
that Chromium always recalculates correctly, regardless of prior toggle
history.

**Verified:** `npm run typecheck`, `npm test` (130 passing), `npm run build`
and `npm run check:bundle-size` (initial route 0.9 KB gzipped of a 150 KB
budget; the new script is delivered as Astro's own inlined
`<script type="module">` with no `src`, so `check:bundle-size`'s
`<script src>`/`modulepreload`-only accounting does not include it — measured
separately at ~170 bytes gzipped standalone, negligible against the budget
either way) all pass. Direct browser verification (`getBoundingClientRect`,
`getComputedStyle`, real `.click()`/`.focus()`, and `Tab` key dispatch against
a `preview` build, not `dev`) confirmed: at 641px, 720px, 900px and 1440×900,
`.picker`/`.picker__list` render at their full ~404px content width
(not `width: 0` flush against the viewport edge), `.picker__summary` computes
`display: none`, all seven locale links are on-screen, real `Tab` from the
"Sources" link lands on each locale link in source order, and
`document.querySelector('.picker__list a').focus()` genuinely moves
`document.activeElement` — the specific no-op this item reported. At 639px,
390×844 and 320×720, the mobile disclosure is unaffected: collapsed by
default on a fresh load, opens on click showing all seven links, and —
newly confirmed — correctly re-collapses (`display: none`, zero rect) on a
second click, closing the toggle-close gap described above. The desktop
no-JS fallback (`data-js-ready` removed, `open` left at its default `false`)
was confirmed to show the compact toggle and to open/close correctly through
the same explicit-hide rule. `document.documentElement.scrollWidth ===
window.innerWidth` held at every tested width, with no horizontal overflow.
**Not verified:** live resize crossing the 40.01rem breakpoint without a
reload — the available browser-automation tooling changes `window.innerWidth`
and re-evaluates CSS media queries on a simulated resize, but does not
dispatch either a `matchMedia` `change` event or a plain `resize` event, so
neither of the script's two listeners could be exercised this way; this is a
known limitation of viewport-override-based automation rather than a gap in
real browsers, where both events are standard and well-supported, but it
should still be confirmed by a real window resize or device rotation before
this is treated as fully closed. Native screen reader, physical touch and
real browser zoom/reflow confirmation remain open, as flagged throughout this
file.

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
