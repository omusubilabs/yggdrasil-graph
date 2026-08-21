# CLAUDE.md

Working notes for future sessions. Read this before changing anything.

## What this is

**Yggdrasil Graph** — an interactive relationship graph of Norse mythology. The
thesis is that the ending of the myth cycle is already encoded in its genealogy:
isolate Loki's descendants and you have recovered most of the opposing side at
Ragnarǫk. This is not an encyclopaedia with a graph bolted on. It is a machine
for noticing structure, and every design decision serves that.

## Commands

```bash
npm run dev          # rebuild graph.json, then astro dev
npm run build        # validate + rebuild graph.json (prebuild), then astro build
npm run validate     # data/ integrity — run after EVERY data change
npm run i18n:check   # locale key parity against en
npm run check:strings # no hardcoded user-facing strings in components
npm run check:glyphs # every shipped font face can draw Old Norse
npm run check:bundle-size # initial-route JS budget, see report-bundle-size.mjs
npm test             # unit tests — node:test via tsx, see src/graph/*.test.ts, src/i18n/*.test.ts
npm run typecheck    # astro check
npm run lint         # eslint
npm run deploy       # build, then wrangler deploy
```

`npm run validate && npm run build` is the minimum before committing a data
change. CI runs everything above.

## Commit messages

Match the existing history (`git log`): a single-line, imperative subject in
`type(scope): summary` form (scope optional). If the body adds anything, make
it short `-` bullets, not prose paragraphs — state what changed, not why at
essay length. Skip the body entirely when the subject already says it all.

## Hard constraints

These are not preferences. Breaking one is a bug.

- **Cloudflare Workers, Static Assets only, free tier.** `wrangler.toml` has no
  `main` entry, deliberately. There is no Worker request handler in v1 and
  adding one is out of scope, not a shortcut.
- **No backend.** No database, no KV, D1 or R2, no runtime API calls of any
  kind. All data ships as build-time JSON.
- **No SSR, no server islands.** Everything prerenders to static HTML.
- **Self-host all fonts** via `@fontsource`. Never link a third-party font CDN
  at runtime — the operating entity is EU-incorporated and a font fetch hands
  the reader's IP to whoever serves it.
- **No analytics.** If added later, cookieless only (Cloudflare Web Analytics).
- **Initial route < 150 KB gzipped JS.** Currently 0.9 KB. Graph data and the
  force-simulation module load lazily. `scripts/report-bundle-size.mjs` enforces
  this in CI and reports the lazy chunks separately.

## The data model

Hand-edited JSON in `data/`, compiled to `src/generated/graph.json` at build
time. `data/` is what contributors edit and reviewers read; `src/generated/` is
a build artifact and is gitignored. Never edit it, never commit it.

### Entity

```jsonc
{
  "id": "odin", // stable, lowercase ASCII, ^[a-z0-9-]+$
  // never localized, NEVER renamed once merged
  "type": "deity", // deity | being | world | artifact | place | event
  "classes": ["aesir"], // colour/grouping; an entity may hold several
  "names": {
    "non": "Óðinn", // Old Norse — DATA, not a translation
    "anglicized": "Odin",
  },
  "attestations": ["poetic-edda", "prose-edda"], // COLLECTIONS
  "tags": ["ragnarok-participant", "wisdom"], // closed vocabulary, see schema
}
```

**No prose in entity files.** Epithets, summaries and descriptions live in
`src/i18n/locales/<locale>/entities.json` under `entity.<id>.*`. The Old Norse
name is the one exception: it is the historical name, identical in every locale.

### Relation

```jsonc
{
  "id": "odin--thor--parent_of", // exactly <from>--<to>--<type>, derived
  "from": "odin",
  "to": "thor",
  "type": "parent_of",
  "directed": true,
  "certainty": "attested", // attested | implied | variant | disputed | unverified
  "sources": [{ "work": "gylfaginning", "locus": "9" }], // WORKS, not collections
  "contradicts": [], // optional; variant/disputed only, must be mutual
}
```

`certainty` is a first-class feature, not metadata. The sources contradict each
other constantly and surfacing that is one of the most interesting things this
project does. The renderer distinguishes all five values by dash pattern and
opacity, not colour alone.

## Rules that are enforced, and why

### Never invent a citation

If you do not know the exact stanza or chapter, set `certainty: "unverified"`,
leave `sources` empty, and add the relation to `data/TODO.md`. `validate-data.ts`
checks all three halves and there is no way to opt out.

A fabricated locus is worse than a missing one: it poisons a dataset other
people will trust and build on. **This rule outranks any instinct to make the
seed data look complete.**

Loci in this repository were read in the edition they cite before they were
written down, not recalled. Both texts are fetchable and greppable:

- Prose Edda, Brodeur 1916 — https://archive.org/details/proseedda00snor
  (`https://ia800507.us.archive.org/1/items/proseedda00snor/proseedda00snor_djvu.txt`)
- Poetic Edda, Bellows 1923 — Project Gutenberg #73533
  (`https://www.gutenberg.org/cache/epub/73533/pg73533.txt`)

Do the same before writing down a locus.

**Editions number differently.** The Bǫlþorn/Bestla stanza is Hávamál 141 in
Bellows and 140 elsewhere. A locus is only meaningful with its edition attached,
which is why `data/sources.json` records the translation for each collection.

### No hardcoded user-facing strings

Every string a person can read or hear goes through `t()` from `src/i18n`.
`npm run check:strings` walks `src/components`, `src/pages`, `src/layouts` and
`src/graph` for text nodes, perceivable attributes and DOM property assignments,
and fails the build. The escape hatch is an `i18n-ignore` comment, and it is for
genuine non-text only: a close glyph, a language code, an Old Norse name that is
data from `data/`.

### `--minium` is reserved

`--minium: #a93a24` marks the Ragnarǫk overlay and death relations. Nothing
else. If it appears as decoration anywhere, that is a bug. The four relation
types that qualify are listed in `DEATH_RELATION_TYPES` in
`src/graph/geometry.ts`. `--verdigris` is the interactive accent; use that.

## Decisions already made — do not revisit

- **Astro + TypeScript strict, static output, no adapter.** Not Next, not Vite
  alone, not a framework island.
- **`d3-force`, `d3-selection`, `d3-zoom`, `d3-drag`, SVG output.** Import the
  submodules, never the `d3` meta-package.
- **Plain CSS with custom properties in `src/styles/tokens.css`.** No Tailwind,
  no CSS-in-JS.
- **`ajv` + JSON Schema as a prebuild step.** Not zod, not runtime validation.
- **npm, lockfile committed, Node pinned in `.nvmrc` and `engines`.**
- **Testing is Node's built-in `node:test` + `node:assert/strict`, run through
  `tsx` (`npm test`).** Not vitest. `tsx` is already a devDependency used to run
  every `scripts/*.ts` file directly; running tests the same way needs no new
  dependency. Tests are co-located as `*.test.ts` next to the module they cover
  (`src/graph/model.test.ts`, `src/graph/geometry.test.ts`, `src/i18n/*.test.ts`)
  and use a small synthetic fixture (`src/graph/fixtures/sample-graph.ts`)
  rather than the real dataset, so adding an entity never breaks a unit test.
- **The visual direction is Icelandic manuscript vellum.** Greyish-tan ground,
  iron-gall ink, verdigris accent. Explicitly not the dark-background,
  glowing-cyan-node look every graph demo has. The page commits to a single
  light appearance and declares `color-scheme: light`; there is no dark variant,
  because the nearest honest dark palette is exactly what this is avoiding.
- **Alegreya for display, Inter for chrome, Source Code Pro for apparatus.**
- **Split licensing.** MIT for code, CC BY-SA 4.0 for `data/`.
- **`en` is the source of truth for locale key structure.** Other locales add
  values, never keys.

## Where this diverges from the original brief, and why

Recorded here rather than silently, as the brief asked.

1. **Relation ids use the full type.** The brief's example id was
   `odin--thor--parent` while its rule said ids match the `from`/`to`/`type`
   triple, and the type is `parent_of`. The rule wins; the validator derives the
   id and rejects any mismatch.

2. **The cold open is prerendered, not simulated on load.** The brief asked for
   the graph to be "already alive on load" _and_ for the force module to "load
   lazily on interaction". Both are satisfied by solving the layout at build
   time (`scripts/build-graph.ts`), serialising it into the SVG, and letting the
   simulation warm up from those positions afterwards. This is also what makes
   `prefers-reduced-motion` meaningful — freezing to a stable precomputed layout
   requires one to exist.

3. **The layout must be deterministic.** d3-force reaches for `Math.random`, so
   it gets a seeded source, the initial spiral is ours, positions round to a
   tenth of a unit, and `generatedAt` is not a clock. Otherwise every build
   churns the prerendered HTML. Two consecutive runs hash identically; keep it
   that way. `LINK_DISTANCE` and the force strengths are duplicated in
   `scripts/build-graph.ts` and `src/graph/simulation.ts` and **must stay
   identical**, or the graph rearranges itself when the chunk lands.

4. **36 entities, one over the brief's 25–35.** Mímir is the extra. He buys the
   sharpest contradiction in the corpus: Gylfaginning 27 gives Gjallarhorn to
   Heimdallr and Gylfaginning 15 has Mímir drinking from it — one work, two
   owners. Both edges are recorded, each pointing at the other via `contradicts`.
   "Contradiction is content" needed something to be content about.

5. **Integrity rules the brief did not list.** A relation type may only appear in
   its own family's file; symmetric types may not be marked directed or recorded
   twice in mirror image; `contradicts` must be mutual; entities attest to
   collections while relations cite works. All in `scripts/validate-data.ts`.

6. **`unverified` must have empty sources**, not merely may. The brief only
   forbade empty sources on other values. If you have a locus it is not
   unverified, and allowing both would make the field mean nothing.

7. **The i18n checker has four locale states, not two.** `source`, `complete`,
   `partial`, `planned`, declared in `src/i18n/config.ts`. "Fail on drift" means
   something different for a locale that is deliberately incomplete: missing keys
   are measured debt, extra keys are always a bug. It also diffs `{placeholder}`
   sets, which a key-set comparison would miss.

8. **The mono face is Source Code Pro, not IBM Plex Mono.** The brief said to
   verify diacritic coverage rather than assume it; `npm run check:glyphs` reads
   the shipped binaries' character maps and Plex has no `ǫ` or `Ǫ`. That would
   have put tofu in the middle of Vǫluspá, Mjǫllnir, Jǫrmungandr and Skǫll.
   Note that `þ ð æ ø` live in the `latin` subset and `ǫ ę ǿ` in `latin-ext`, so
   coverage is only sound as the union of both.

9. **Inter's `@font-face` blocks are hand-written** in `src/styles/inter.css`.
   The variable package has no per-subset entry point and its own stylesheet
   drags Cyrillic, Greek and Vietnamese files into `dist/` that nothing fetches.

10. **Japanese uses the sliced variable build.** `@fontsource-variable/noto-sans-jp/wght.css`
    splits coverage across ~120 narrow unicode-ranges so a reader downloads tens
    of kilobytes instead of a 1 MB monolith. It is imported only by `/ja/` pages,
    which is what keeps it off every other route.

11. **`.claude/` is gitignored.** Local editor config does not belong in a public
    repository.

## Owed work, prioritized

Beyond the "Out of scope for v1" list below, three smaller items are tracked
and prioritized in [README.md](README.md)'s Roadmap: the data gaps and
unverified relations in [`data/TODO.md`](data/TODO.md), the `ja` locale's
translation coverage (currently `ui.json` only — no `entities.json` or
`relations.json`), and JSON-LD structured data on entity pages. Do not
duplicate that detail here — check the Roadmap first.

## Out of scope for v1 — leave the seams clean

Do not build these without being asked. The data and the seams for them exist.

- **The Ragnarǫk overlay.** The tags it needs are in the dataset already
  (`ragnarok-participant`, `ragnarok-slain`, `ragnarok-slayer`,
  `ragnarok-survivor`). `--minium-wash` is reserved for it.
- **Tag-driven related-entity suggestions.** `relatedByTag()` in
  `src/graph/model.ts` is written and unused; `tagIndex` is built and shipped.
- **URL state serialization** for selection, filters and overlay.
- **Locales beyond `en` and the `ja` stub.**
- **The full 300–400 entity dataset.** `data/TODO.md` lists what is missing and
  why each one matters.
