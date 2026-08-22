# Owed work on the dataset

Two kinds of entry live here.

**Unverified relations.** A relation with `certainty: "unverified"` has an empty
`sources` array, and the validator refuses to let it exist unless it is also
listed below. That is deliberate: an uncited claim must be visible as owed work,
not quietly parked in the data. If you can supply a locus from a public-domain
edition, that is one of the most valuable contributions this project accepts.

**Gaps.** Deliberately excluded candidates and the evidence for excluding them.

> **Never invent a citation to clear an item from this list.** A fabricated
> chapter number is worse than a missing one — it poisons a dataset other people
> will trust and build on. If you cannot find the locus, leave the item here.

---

## Unverified relations

Nothing outstanding right now. The two entries formerly here — Fárbauti/Laufey
as a couple, and Surtr's fire reaching Yggdrasill — were checked against the
full text of both editions, found unsupported, and deleted rather than
softened, per this file's own rule.

---

## Gaps

### Entities with no tags

- **`sif`** — nothing in the corpus we currently cite distinguishes her in a way
  the controlled tag vocabulary covers. She is Þórr's wife (Skáldskaparmál 4) and
  Ullr's mother (Gylfaginning 31 — see `sif--ullr--parent_of`), and the story of
  her golden hair is Skáldskaparmál 35. That hair story would justify a
  `dwarf-forged` connection through a new entity for the hair itself, which is
  probably over-modelling.

### Excluded modern world names

- **`vanaheim`, `svartalfheim`, `helheim`** — these familiar names remain
  excluded (Alfheim was added: Gylfaginning 17, Grímnismál 5). Searched for
  directly, not skipped: in both editions the literal toponym never appears,
  only periphrasis — "the land of the Vanir" (Gylfaginning 23), "the
  Dark-Elves" (Gylfaginning 17), "the home of the Wanes" (Vafþrúðnismál 39).
  "Svartalfaheim" appears only in Bellows' own introduction, never a
  translated stanza. (Vǫluspá 37's "Niðavellir" is a distinct dwarf-hall, not
  this.) Helheim may not even be a further gap — Brodeur never separates a
  place called "Helheim" from the person Hel (Gylfaginning 34), and the
  existing `hel` + `niflheim` entities already cover that ground.

### Verification passes

- Every locus in this repository was read in the edition it cites
  (Brodeur 1916 for the Prose Edda, Bellows 1923 for the Poetic Edda) before it
  was committed. Chapter and stanza numbering **differs between editions** — the
  Bölþorn/Bestla stanza is Hávamál 141 in Bellows and 140 in several other
  numberings. If you check a locus against a different edition and it does not
  match, that is expected; say which edition you used when you report it.
