# Owed work on the dataset

Two kinds of entry live here.

**Unverified relations.** A relation with `certainty: "unverified"` has an empty
`sources` array, and the validator refuses to let it exist unless it is also
listed below. That is deliberate: an uncited claim must be visible as owed work,
not quietly parked in the data. If you can supply a locus from a public-domain
edition, that is one of the most valuable contributions this project accepts.

**Gaps.** Entities and relations we know are missing, and why they matter.

> **Never invent a citation to clear an item from this list.** A fabricated
> chapter number is worse than a missing one — it poisons a dataset other people
> will trust and build on. If you cannot find the locus, leave the item here.

---

## Unverified relations

### `farbauti--laufey--consort_of`

Gylfaginning 33 and Skáldskaparmál 16 both name Fárbauti as Loki's father and
Laufey (or Nál) as his mother, but neither text says anything about the two of
them as a couple — no marriage, no union, not even a scene. The relation is
recorded because the parentage implies it, and marked `unverified` because
implication is not attestation.

*Wanted:* any locus in a registered work that puts Fárbauti and Laufey in a
relationship with each other rather than only with their son. It may not exist.
If a survey of the corpus concludes it does not, the right fix is to delete this
relation, not to soften it.

### `surtr--yggdrasil--destroys`

Gylfaginning 51 and Vǫluspá 52 have Surtr fling fire over the earth and burn all
the world; Vǫluspá 47 has Yggdrasill shake and groan. Neither says Surtr's fire
takes the Ash specifically, and Vǫluspá 57's world-fire is not attributed to him
by name. The relation is recorded because it is the reading nearly every retelling
assumes, and marked `unverified` because the texts stop short of it.

*Wanted:* a locus that connects Surtr's fire to Yggdrasill directly.

---

## Gaps

### Entities with no tags

- **`sif`** — nothing in the corpus we currently cite distinguishes her in a way
  the controlled tag vocabulary covers. She is Þórr's wife (Skáldskaparmál 4) and
  Ullr's mother (Gylfaginning 31), and the story of her golden hair is
  Skáldskaparmál 35. Adding `ullr` would give her a second relation; the hair
  story would justify a `dwarf-forged` connection through a new entity for the
  hair itself, which is probably over-modelling.

### Entities that would complete existing relations

- **`sol` and `mani`** (Sól, Máni) — without them, Skǫll and Hati have parentage
  and nothing to chase. Gylfaginning 11–12 and Grímnismál 37, 39 cover both.
- **`jarnvid`** (Járnviðr, Ironwood) — where the wolf-brood is raised;
  Gylfaginning 12, Vǫluspá 40.
- **`sigyn`, `narfi`, `vali-lokason`** — Loki's other household, and the binding;
  Gylfaginning 33 and 50. Note that Gylfaginning 33 calls the son "Nari or Narfi"
  while 50 has both Váli and Narfi, with Váli transformed into a wolf. That is a
  genuine variant inside one work and would make a good `variant` relation.
- **`sleipnir`, `svadilfari`** — Loki's fourth child, and the only one who ends up
  on the gods' side; Gylfaginning 42, Hyndluljóð 42.
- **`ullr`** — Sif's son, Þórr's stepson; Gylfaginning 31, Skáldskaparmál 14.
- **`hrym`, `naglfar`** — Ragnarök's fleet; Gylfaginning 43 and 51, Vǫluspá 50.
- **`bifrost`** — Heimdallr guards it and Surtr's riders break it;
  Gylfaginning 13, 27 and 51.
- **`vanaheim`, `alfheim`, `svartalfheim`, `helheim`** — four of the nine worlds
  are missing, so `nine-worlds` is currently a promise the data does not keep.

### Relation vocabulary

- There is no type for *consulting* or *taking counsel*, so Óðinn riding to
  Mímir's well at Gylfaginning 51 cannot be recorded. Adding one would also cover
  Óðinn and the Norns, and Gylfaginning 15's account of Mímir's wisdom.
- `data/relations/transformation.json` is empty. The family is real —
  Gylfaginning 42 (Loki as a mare), 49 (as a woman, and as Þǫkk), 50 (as a salmon)
  — but every one of those needs an entity for what Loki becomes, and shape-shifts
  may want their own modelling rather than a plain edge. Left deliberately empty
  rather than filled with something we would have to unpick.

### Verification passes

- Every locus in this repository was read in the edition it cites
  (Brodeur 1916 for the Prose Edda, Bellows 1923 for the Poetic Edda) before it
  was committed. Chapter and stanza numbering **differs between editions** — the
  Bölþorn/Bestla stanza is Hávamál 141 in Bellows and 140 in several other
  numberings. If you check a locus against a different edition and it does not
  match, that is expected; say which edition you used when you report it.
