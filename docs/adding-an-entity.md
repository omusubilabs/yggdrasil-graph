# Adding an entity

A checklist for putting a new figure into the graph. If you would rather see one
worked end to end with the citation-hunting included, read the
[Ullr example in CONTRIBUTING.md](../CONTRIBUTING.md#worked-example-adding-ullr-and-his-mother)
first — this page is the version you keep open while you work.

For what each field means, see [the data model](data-model.md).

---

## Before you start

**Does the figure earn a node?** An entity with no relations is invisible in the
graph — `npm run validate` will warn you about it. The useful unit of work is
therefore _a figure plus at least one cited relation_, not a figure alone.

**Do you have a locus?** If not, that is fine, but it changes what you write:
the relation goes in as `certainty: "unverified"` with empty `sources` and an
entry in `data/TODO.md`. What is **not** fine is guessing a chapter number. See
[the one rule](../CONTRIBUTING.md#the-one-rule).

---

## 1. Pick an id

Lowercase ASCII, `^[a-z0-9-]+$`, and **permanent** — it is the join key for
locale files, URLs and every relation, so it is never renamed once merged.

- Use the plainest anglicized form: `jormungandr`, not `jǫrmungandr`.
- Disambiguate homonyms in the id itself: `vali-odinsson`, `vali-lokason`.
- Do not encode type or class: `mjolnir`, not `artifact-mjolnir`.

## 2. Choose the file

One file per group, under `data/entities/`:

| File             | For                                                                                |
| ---------------- | ---------------------------------------------------------------------------------- |
| `aesir.json`     | Æsir and Ásynjur                                                                   |
| `vanir.json`     | Vanir                                                                              |
| `jotnar.json`    | Giants — including Loki, whose descent is giant even though his `classes` say both |
| `beings.json`    | Monsters, animals, and anything that fits nowhere else                             |
| `worlds.json`    | Worlds and named places, including Yggdrasill                                      |
| `artifacts.json` | Made things                                                                        |

The file records origin. `classes` records how the graph colours it. They can
disagree, and for Loki they do.

## 3. Write the entity

Keep the file sorted by id.

```jsonc
{
  "id": "hymir",
  "type": "being", // deity | being | world | artifact | place | event
  "classes": ["jotnar"], // may hold several
  "names": {
    "non": "Hymir", // Old Norse, correct diacritics — this is data
    "anglicized": "Hymir",
  },
  "attestations": ["poetic-edda", "prose-edda"], // collections, not works
  "tags": [], // closed vocabulary — see data/schema/entity.schema.json
}
```

Two things people get wrong here:

- **No prose.** No description field, no epithet, no note. Those go in
  `src/i18n/locales/en/entities.json` (step 5) so they can be translated.
- **`attestations` means the text, not a footnote.** Only list a collection if
  the name appears in the poems or the prose itself. Bellows' notes mention
  dozens of names that never occur in a stanza.

## 4. Add at least one relation

In the file named for the relation's family — see the
[family table](data-model.md#families-and-types).

```jsonc
{
  "id": "hymir--tyr--parent_of", // exactly <from>--<to>--<type>, derived
  "from": "hymir",
  "to": "tyr",
  "type": "parent_of",
  "directed": true, // false only for symmetric types
  "certainty": "variant",
  "sources": [{ "work": "hymiskvitha", "locus": "5" }],
}
```

This example is real, and it is `variant` for a reason. Hymiskviða 5 has Týr
call Hymir his father outright — _"A kettle my father fierce doth own"_ — while
Skáldskaparmál 9 periphrases Týr as _Son of Odin_. Both are in the corpus, they
cannot both be plainly true, and the honest record is to say so rather than pick.
If you add it, add the competing relation too and point them at each other with
`contradicts`.

Check as you write:

- [ ] The id is exactly `<from>--<to>--<type>`.
- [ ] The type belongs to this file's family.
- [ ] `directed` is `false` if and only if the type is symmetric, and the
      mirrored relation does not already exist.
- [ ] `work` is an individual work in `data/sources.json`, not a collection.
- [ ] The `certainty` matches what the text actually does — see
      [the table](../CONTRIBUTING.md#choosing-a-certainty).

If the work you are citing is not registered yet, add it to `data/sources.json`
first, with the public-domain edition and its `locusUnit`.

## 5. Write the prose

In `src/i18n/locales/en/entities.json`:

```jsonc
"hymir": {
  "epithet": "The giant with the cauldron",
  "summary": "Þórr rows out with him and hooks the Midgard Serpent.",
  "description": "Hymir is the giant Þórr visits for a cauldron big enough…"
}
```

Three fields, three depths — the line under the name, the hover text, and the
full account on `/entity/hymir`. Write your own sentences; do not paraphrase a
translation closely enough that it remains the translator's.

Other locales are optional. `en` is the source of truth, and anything missing
elsewhere falls back to it key by key.

## 6. Run the checks

```bash
npm run validate     # data integrity — the one that matters
npm run build        # graph compiles, site builds
```

`validate` prints exactly what is wrong and where. Expect it to catch, in
roughly this order of frequency:

- an id that does not match its `from`/`to`/`type`
- a `work` that is really a collection
- a relation type in the wrong family's file
- an `unverified` relation you forgot to list in `data/TODO.md`

It will also **warn** — not fail — if your new entity has no relations or no
tags. Both warnings are worth acting on.

## 7. Look at it

```bash
npm run dev
```

Open the graph and find the figure. Things worth a glance:

- Is the label legible, or is it sitting on top of a neighbour? Very dense
  additions may need the force constants revisited — say so in the pull request
  rather than tuning them silently.
- Does clicking it open a panel with the relations you expect, grouped correctly?
- Does `/entity/<id>` render the prose and every citation?

## 8. Commit

```bash
git add data/ src/i18n/locales/en/entities.json
git commit -m "feat(data): add Hymir and his descent to Týr"
```

The pull request template asks you to list the loci you added or changed. Fill
it in — a reviewer's first action is to open the edition and read them.
