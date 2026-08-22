# The data model

Reference for everything under `data/`. For a task-oriented walkthrough, see
[Adding an entity](adding-an-entity.md); for the citation rules and review
expectations, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Shape of the repository

```
data/
├── entities/          one file per group, each a flat array
│   ├── aesir.json
│   ├── vanir.json
│   ├── jotnar.json
│   ├── beings.json
│   ├── forms.json
│   ├── worlds.json
│   └── artifacts.json
├── relations/         one file per family, each a flat array
│   ├── kinship.json
│   ├── counsel.json
│   ├── conflict.json
│   ├── possession.json
│   ├── location.json
│   └── transformation.json
├── schema/            JSON Schema (2020-12) for the three shapes above
├── sources.json       every work that may be cited
├── TODO.md            owed work: unverified relations and known gaps
└── LICENSE            CC BY-SA 4.0
```

`data/` is hand-edited and reviewed in pull requests.
`src/generated/graph.json` is compiled from it at build time by
`scripts/build-graph.ts`, is gitignored, and must never be edited.

The split is the point: contributors touch a small readable JSON file, and the
application consumes one optimised artifact that also carries a solved layout, a
degree count and a tag index.

---

## Entities

```jsonc
{
  "id": "jormungandr",
  "type": "being",
  "classes": ["beings"],
  "names": { "non": "Jǫrmungandr", "anglicized": "Jormungandr" },
  "attestations": ["poetic-edda", "prose-edda"],
  "tags": ["ragnarok-participant", "loki-kin", "serpent", "sea"],
}
```

### `id`

Stable, lowercase ASCII, `^[a-z0-9-]+$`, 2–48 characters. **Permanent.** It is
the join key for locale files, URLs and every relation, so renaming one breaks
inbound links and silently orphans translations. Use the plainest anglicized
form — `jormungandr`, never `jǫrmungandr`.

If two figures share a name, disambiguate in the id rather than hoping context
carries it: `vali-odinsson` and `vali-lokason` are two different people, and
Snorri uses both names for both.

### `type`

`deity` · `being` · `world` · `artifact` · `place` · `event` · `form`

Drives node **shape** in the renderer: circles for people, hexagons for worlds
and places, lozenges for made things, and a ring for assumed forms.

### `classes`

`aesir` · `vanir` · `jotnar` · `beings` · `worlds` · `artifacts`

Drives node **colour**. An entity may hold several, and the interesting ones do:
Loki is `["aesir", "jotnar"]`, because Gylfaginning 33 numbers him among the
Æsir in the same breath as it names his father a giant. That tension is the
premise of the whole application, so the schema carries it rather than forcing a
choice.

Shape and colour are separate channels on purpose, and every node also has a
visible text label, so identity never depends on colour alone.

Note that `classes` is independent of which **file** an entity lives in. Loki is
in `jotnar.json` because that is his descent; his classes say he is both.

### `names`

| Key          | Meaning                                                          |
| ------------ | ---------------------------------------------------------------- |
| `non`        | Normalized Old Norse name or form term, with correct diacritics. |
| `anglicized` | The conventional English-language spelling or form gloss.        |

`names.non` is **data, not a translation.** It is the historical name, or the
Old Norse term when `type` is `form`, and is identical in every locale. That is
why it lives here rather than in `src/i18n/`. It is the only string in
`data/entities/` and the only exception to "no prose in entity files".

Orthography matters: `þ ð æ ø ǫ ę ǿ á é í ó ú ý` must all be correct.
`npm run check:glyphs` verifies every shipped font face can actually draw them
by reading the binaries' character maps.

### `attestations`

Source **collections** — `poetic-edda`, `prose-edda` — in which the entity
appears at all. Relations cite individual works and loci; this is the coarser
fact, and it drives the "Appears in" block on entity pages.

Only list a collection if the name or form term appears in the poems or the
prose text itself. A term that appears only in a translator's footnote is not an
attestation.

### `tags`

A **closed vocabulary**, defined in `data/schema/entity.schema.json`. Tags drive
two things: the Ragnarǫk overlay's selection of combatants, and the
"related but not adjacent" suggestions at the end of a panel. Both stop meaning
anything if the vocabulary sprawls, which is why the schema enumerates it.

Adding a tag is fine — add it to the schema enum, add a label under `tag.*` in
`src/i18n/locales/en/ui.json`, and say in the pull request what it is for.

### No prose

`epithet`, `summary` and `description` live in
`src/i18n/locales/<locale>/entities.json` under `entity.<id>.*`, so they can be
translated. Three fields, three depths: `epithet` is the line under the name,
`summary` is the hover text and the panel's opening line, `description` is the
full account on `/entity/<id>`.

---

## Relations

```jsonc
{
  "id": "heimdall--gjallarhorn--owns",
  "from": "heimdall",
  "to": "gjallarhorn",
  "type": "owns",
  "directed": true,
  "certainty": "disputed",
  "sources": [
    { "work": "gylfaginning", "locus": "27" },
    { "work": "voluspa", "locus": "46" },
  ],
  "contradicts": ["mimir--gjallarhorn--owns"],
}
```

### `id`

Exactly `<from>--<to>--<type>`. **Derived, never chosen** — the validator
recomputes it and rejects any mismatch. Two hyphens separate the parts because
entity ids may contain single hyphens.

### Families and types

The file an entity's relation lives in _is_ its family, and a type may only
appear in its own family's file. A `slays` inside `kinship.json` is a build
error, deliberately: without that rule the file split stops meaning anything and
reviewing a data pull request gets much harder.

| Family           | Types                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| `kinship`        | `parent_of` `sibling_of` `married_to` `consort_of` `blood_brother_of` `fosters` |
| `counsel`        | `consults`                                                                      |
| `conflict`       | `slays` `causes_death_of` `maims` `binds` `devours` `destroys`                  |
| `possession`     | `owns`                                                                          |
| `location`       | `guards` `dwells_in` `rules` `encircles` `root_reaches` `raised_in`             |
| `transformation` | `becomes`                                                                       |

Transformation targets are `form` nodes from `forms.json`. A form represents a
kind of shape, not one occurrence: if the same figure takes the same form at
several loci, one `becomes` relation gathers those citations. A named persona
such as Þǫkk remains distinct from the generic `woman` form because the name is
itself part of what the source asks the reader to notice.

Adding a type means updating the schema enum, `RELATION_FAMILIES` in
`src/graph/types.ts`, and its `label`, `inverse` and `phrase` in every locale
currently declared `complete`. Adding a new family also requires its relation
file and localized family label, a position in `FAMILY_ORDER` in
`src/graph/model.ts`, and identical `LINK_DISTANCE` entries in
`scripts/build-graph.ts` and `src/graph/simulation.ts`.

### `directed`

`false` only for the symmetric types — `married_to`, `sibling_of`, `consort_of`,
`blood_brother_of` — and those may be recorded in **one direction only**. The
validator rejects both `a--b--married_to` and `b--a--married_to`.

Directed relations get an arrowhead, and their edge stops short of the target
node's rim so the head lands on the boundary rather than under the shape.

### `certainty`

| Value        | Means                                       | Rendered as          |
| ------------ | ------------------------------------------- | -------------------- |
| `attested`   | The source states it outright.              | Solid                |
| `implied`    | The source entails it without saying it.    | Long dash            |
| `variant`    | Another source gives a different account.   | Fine dot             |
| `disputed`   | The sources actively contradict each other. | Dash-dot             |
| `unverified` | Believed true, no locus confirmed.          | Sparse dot, faintest |

Distinguished by dash pattern **and** opacity, not by colour, so the five values
survive being read by someone who cannot separate the hues.

### `sources`

```jsonc
{ "work": "gylfaginning", "locus": "34" }
```

`work` must resolve to an entry in `sources.json` with `kind: "work"` — an
individual poem or book, never a collection. `"prose-edda"` with a locus of
`"34"` is meaningless, because the Prose Edda has two books and both have a
chapter 34.

`locus` is a bare number or a range (`"34-35"`), counted in the unit the work
declares (`chapter` or `stanza`).

**A relation may only have an empty `sources` array if `certainty` is
`unverified`, and an `unverified` relation may only have an empty one.** If you
have a locus it is not unverified; if you do not, saying so is the whole point.
Unverified relations must additionally be listed in `data/TODO.md`, and the
validator checks all three halves.

### `contradicts`

Optional. Relation ids giving a competing account of the same thing. Only
allowed on `variant` and `disputed`, and **must be mutual** — if A contradicts B,
B must contradict A, or the interface can only ever show one side.

Seed example: the Heimdallr/Mímir Gjallarhorn conflict — see
[README](../README.md#certainty-is-a-feature-not-metadata).

---

## Sources

`data/sources.json` registers every citable work at two levels.

**Collections** carry the public-domain edition:

```jsonc
{
  "id": "prose-edda",
  "kind": "collection",
  "titles": { "non": "Snorra Edda", "en": "The Prose Edda" },
  "date": "c. 1220",
  "translation": {
    "translator": "Arthur Gilchrist Brodeur",
    "year": 1916,
    "title": "The Prose Edda by Snorri Sturluson…",
    "publisher": "The American-Scandinavian Foundation",
    "rights": "public-domain",
  },
  "url": "https://archive.org/details/proseedda00snor",
}
```

**Works** belong to a collection and declare how their loci are counted:

```jsonc
{
  "id": "gylfaginning",
  "kind": "work",
  "partOf": "prose-edda",
  "titles": { "non": "Gylfaginning", "en": "The Beguiling of Gylfi" },
  "date": "c. 1220",
  "locusUnit": "chapter",
}
```

`locusUnit` is what lets the interface render "ch. 34" against Gylfaginning and
"st. 40" against Vǫluspá.

The `rights: "public-domain"` field is a constant, not a variable. Only
public-domain editions may be registered, and no text from them is reproduced
anywhere in this repository.

---

## Integrity rules

All enforced by `npm run validate` (`scripts/validate-data.ts`). Nothing here is
convention.

**Schema layer** — `data/schema/*.json` via ajv, strict mode.

**Cross-file layer:**

1. Every `from` and `to` resolves to an existing entity id.
2. Every `sources[].work` resolves to an entry in `sources.json`, and that entry
   is a `work`, not a `collection`.
3. Every entity `attestations[]` resolves, and resolves to a `collection`.
4. Entity ids are unique across all files and match `^[a-z0-9-]+$`.
5. Relation ids are unique and equal `<from>--<to>--<type>`.
6. No relation points an entity at itself.
7. One triple, one relation — including the mirrored form of a symmetric type.
8. A relation type appears only in its own family's file.
9. A symmetric type is never marked `directed`.
10. `sources` is empty **iff** `certainty` is `unverified`.
11. Every `unverified` relation is listed in `data/TODO.md`.
12. `contradicts` targets exist, are not self-references, are mutual, and only
    appear on `variant` or `disputed` relations.
13. `partOf` on a work resolves to something that is actually a collection.

**Warnings** (not failures): an entity with no relations will not appear in the
graph; a non-form entity with no tags will never surface as a suggestion. Form
nodes deliberately carry no tags so shapes do not pollute related-entity results.

---

## What compilation adds

`scripts/build-graph.ts` produces `src/generated/graph.json`:

| Field              | Added                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `nodes[].degree`   | Count of incident relations. Drives node radius.                                                                |
| `nodes[].coreRank` | Rank by degree, 0 = most connected. Reserved for slicing the default view when the dataset outgrows one screen. |
| `nodes[].x`, `.y`  | **The solved layout**, from a headless d3-force run.                                                            |
| `links[].family`   | Which file the relation came from.                                                                              |
| `links[].curve`    | Signed fan offset, so reciprocal relations do not overlap.                                                      |
| `tagIndex`         | `tag → entity ids`, so the client never scans all nodes.                                                        |
| `bounds`           | Layout extent, used as the SVG `viewBox`.                                                                       |

The layout is baked at build time so the graph can be prerendered as real SVG —
that is what makes the cold open instant, keeps d3-force off the initial route,
and gives `prefers-reduced-motion` a stable layout to freeze to.

It is therefore **deterministic**: seeded random source, our own initial spiral,
positions rounded to a tenth of a unit, and no clock in `generatedAt`. Two
consecutive runs must hash identically. If you change a force constant, change
it in `src/graph/simulation.ts` too, or the graph will visibly rearrange itself
the moment the simulation chunk loads.
