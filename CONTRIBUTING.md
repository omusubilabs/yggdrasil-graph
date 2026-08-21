# Contributing

The most valuable thing you can contribute to this project is **a relation with
a citation**. Not code. A single line of JSON that says _this figure is that
figure's son, and here is the chapter that says so_.

This guide is written for that. If you know the _Skáldskaparmál_ better than you
know npm, start at [The short version](#the-short-version) — you can contribute
without cloning anything.

---

## The short version

You do not need to run this project to improve it.

Open a [Correct a relation](../../issues/new?template=correct-relation.yml)
issue, fill in the citation field, and describe what should change. Someone will
turn it into a pull request and credit you. The citation field is mandatory, and
that single constraint is the reason this dataset can be trusted as it grows.

If you want to make the change yourself, read on.

---

## The one rule

> **Never invent a citation.**

If you do not know the exact chapter or stanza, say so — set
`certainty: "unverified"`, leave `sources` empty, and add an entry to
[`data/TODO.md`](data/TODO.md). The validator enforces all three, and a pull
request that skips any of them will not build.

A fabricated locus poisons every project that reuses this data. **This rule
outranks any instinct to make the dataset look complete.** (Full rationale:
[`CLAUDE.md`](CLAUDE.md#never-invent-a-citation).)

Two practical consequences:

- **Cite only public-domain editions.** Bellows (1923) for the _Poetic Edda_,
  Brodeur (1916) for the _Prose Edda_. They are registered in
  [`data/sources.json`](data/sources.json).
- **Never paste translated text into this repository.** Cite the locus and
  paraphrase in your own words. That applies doubly to modern copyrighted
  translations, which must not appear here in any form.

### Editions number differently

Example: the Bǫlþorn/Bestla stanza is **Hávamál 141** in Bellows and **140** in
several other numberings. A locus without an edition is not a citation. Check
the actual text, not memory or a summary:

- Prose Edda, Brodeur 1916 — <https://archive.org/details/proseedda00snor>
- Poetic Edda, Bellows 1923 — <https://www.gutenberg.org/ebooks/73533>

---

## Worked example: adding Ullr, and his mother

`data/TODO.md` notes that Sif has almost no relations, and that adding Ullr
would fix it. Here is that change end to end.

### 1. Set up

```bash
git clone https://github.com/OWNER/yggdrasil-graph.git
cd yggdrasil-graph
nvm use          # the Node version is pinned in .nvmrc
npm ci
git switch -c entity/ullr
```

### 2. Find the passage, before writing anything

```bash
curl -s https://ia800507.us.archive.org/1/items/proseedda00snor/proseedda00snor_djvu.txt \
  | tr -s ' \n' ' ' | grep -o '.\{200\}Ullr.\{300\}'
```

Several passages come back — Ullr turns up in kennings all over
_Skáldskaparmál_. Two of them are what you want. Brodeur's Gylfaginning **XXXI**:

> "One is called Ullr, son of Sif, step-son of Thor…"

and Skáldskaparmál **XIV**, the kenning chapter:

> "How should Ullr be periphrased? By calling him Son of Sif, Stepson of Thor…"

So: `sif --parent_of--> ullr`, attested, at Gylfaginning 31 and
Skáldskaparmál 14. Two independent loci in the same collection, which is a
stronger citation than one.

Note what the passages _do not_ say: they never name Ullr's father. Do not
invent one, and do not "obviously" make it Þórr — the sources call him
**step**son, which is the interesting part.

### 3. Add the entity

In `data/entities/aesir.json`, keeping the file alphabetical:

```jsonc
{
  "id": "ullr",
  "type": "deity",
  "classes": ["aesir"],
  "names": { "non": "Ullr", "anglicized": "Ull" },
  "attestations": ["poetic-edda", "prose-edda"],
  "tags": [],
}
```

- **`id`** is lowercase ASCII, matches `^[a-z0-9-]+$`, and is permanent. It is
  the join key for locale files, URLs and every relation, so it is never renamed
  once merged. Use the plainest anglicized form: `jormungandr`, not `jǫrmungandr`.
- **`names.non`** is the normalized Old Norse form with correct diacritics. It is
  **data, not a translation** — identical in every locale, so it stays here
  rather than in a locale file.
- **`attestations`** are source _collections_. Relations cite individual works.
- **`tags`** come from a closed vocabulary in
  [`data/schema/entity.schema.json`](data/schema/entity.schema.json). Adding a
  new tag is fine, but do it deliberately: tags drive the related-entity
  suggestions, and a vocabulary that sprawls makes that feature meaningless.

### 4. Add the relation

In `data/relations/kinship.json`:

```jsonc
{
  "id": "sif--ullr--parent_of",
  "from": "sif",
  "to": "ullr",
  "type": "parent_of",
  "directed": true,
  "certainty": "attested",
  "sources": [
    { "work": "gylfaginning", "locus": "31" },
    { "work": "skaldskaparmal", "locus": "14" },
  ],
}
```

- **`id` is derived, never chosen.** It is exactly `<from>--<to>--<type>`. The
  validator recomputes it and rejects a mismatch.
- **The file is the family.** `parent_of` belongs to kinship, so it goes in
  `kinship.json`. A `slays` in that file is a build error, on purpose.
- **`directed`** is `false` only for symmetric types — `married_to`,
  `sibling_of`, `consort_of`, `blood_brother_of` — and those may be recorded in
  one direction only.
- **`work`** is an individual work from `data/sources.json`, never a collection.
  `"prose-edda"` with a locus of `"31"` is meaningless: which of its two books?

While you are here, `thor --married_to--> sif` is already in the dataset. You
could reasonably add a `stepfather` relation type for Þórr and Ullr — but adding
a type means adding it to the schema, to `RELATION_FAMILIES` in
`src/graph/types.ts`, and to `src/i18n/locales/en/relations.json`. Do that in a
separate pull request, so the citation change can be reviewed on its own.

### 5. Add the prose

Entity files carry no prose. Descriptions go in
`src/i18n/locales/en/entities.json` under `entity.ullr.*`:

```jsonc
"ullr": {
  "epithet": "Son of Sif, stepson of Þórr",
  "summary": "So good a bowman and so swift on snowshoes that none may contend with him.",
  "description": "Ullr is Sif's son and Þórr's stepson…"
}
```

Three fields, three depths: `epithet` is the line under the name, `summary` is
the hover text and the panel's opening line, `description` is the full account
on `/entity/ullr`. Write your own prose. Do not paraphrase a translation closely
enough that it is still the translator's sentence.

### 6. Check it

```bash
npm run validate     # data integrity — the important one
npm run build        # the graph compiles and the site builds
```

`validate` will tell you exactly what is wrong and where. It checks that
`from`/`to` resolve, that ids are derived correctly, that cited works exist,
that a relation with no citation is properly marked `unverified` **and** listed
in `data/TODO.md`, and a dozen other things. It also warns about entities with
no relations or no tags, which is how it will nudge you about Sif.

### 7. Open the pull request

```bash
git add data/ src/i18n/locales/en/entities.json
git commit -m "feat(data): add Ullr and his descent from Sif"
git push -u origin entity/ullr
```

The pull request template asks you to list the loci you added. Do fill that in —
it is what a reviewer checks first.

---

## Choosing a `certainty`

This field is the heart of the dataset. Getting it right matters more than
adding volume.

| Value        | Use when                                                                                              | Example                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `attested`   | A source states it outright.                                                                          | Gylfaginning 34 names Loki and Angrboða as the parents of Fenrir.                                                                 |
| `implied`    | A source entails it without saying it.                                                                | Gylfaginning 34 says the Æsir raised the wolf "at home"; that it was Ásgarðr is an inference the text supports but does not make. |
| `variant`    | Another source gives a different account of the same thing.                                           | Skáldskaparmál 8 calls Heimdallr Óðinn's son; Gylfaginning 27 gives him nine mothers and no father.                               |
| `disputed`   | The sources actively contradict each other.                                                           | Gylfaginning 27 gives Gjallarhorn to Heimdallr; Gylfaginning 15 has Mímir drinking from it. Same book.                            |
| `unverified` | You believe it but have no locus. `sources` must be empty and the relation must be in `data/TODO.md`. | Two figures are each named as a parent of the same child, but no text ever puts the two of them in a scene together as a couple.  |

Two things worth internalising:

- **`variant` and `disputed` are not failures.** They are the most interesting
  rows in the dataset, they get their own rendering, and they have their own
  filter. When you find a contradiction, record both sides — set `contradicts`
  on each pointing at the other, and the interface will offer the reader a
  choice instead of quietly picking a winner.
- **Downgrade freely.** Moving a relation from `attested` to `implied` because
  the text is thinner than you remembered is a genuinely valuable pull request.

---

## Contributing code

Same repository, different checklist.

```bash
npm run typecheck && npm run lint && npm run build
```

Three project-specific rules the build enforces:

1. **No user-facing string is hardcoded in a component.** Everything goes
   through `t()` from `src/i18n`. `npm run check:strings` fails the build
   otherwise. The `i18n-ignore` escape hatch is for genuine non-text only — a
   close glyph, a language code, an Old Norse name that came from `data/`.
2. **`--minium` is reserved** for death relations and the Ragnarǫk overlay. Use
   `--verdigris` for anything interactive. If red appears as decoration, that is
   a bug report, not a style preference.
3. **`en` defines the locale key structure.** Other locales add values, never
   keys. `npm run i18n:check` enforces it.

There are constraints that are not negotiable in a pull request — no backend, no
SSR, no third-party font CDN, initial route under 150 KB of gzipped JS. They and
the reasoning are in [`CLAUDE.md`](CLAUDE.md). Read it before proposing anything
architectural.

---

## What review looks like

**Data changes.** A reviewer opens the edition you cited and reads the passage.
That is the whole review. If the locus is right and the `certainty` is honest, it
merges. If the locus does not say what the relation claims, expect a specific
quote back, not a rejection — usually the fix is a downgrade to `implied` or a
different chapter, and that conversation is the point of the project.

**Code changes.** CI must be green: validate, i18n parity, string check, glyph
check, typecheck, lint, format, build, and the initial-route JS budget. Beyond
that, reviewers care about whether the change keeps working with JavaScript
disabled, whether it stays keyboard-reachable, and whether it respects
`prefers-reduced-motion`.

**Turnaround.** This is a volunteer project. A data pull request with a good
citation is usually quick. An architectural one may take a conversation first —
open an issue before writing it.

---

## Ground rules

Everyone here is bound by the [Code of Conduct](CODE_OF_CONDUCT.md).

By contributing you agree that your changes to `data/` are licensed **CC BY-SA
4.0** and your changes to everything else are licensed **MIT**. See
[Licensing](README.md#licensing) for why the split exists.
