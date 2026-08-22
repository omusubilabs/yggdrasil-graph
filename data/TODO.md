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

### Entities that would complete existing relations

- **`vanaheim`, `svartalfheim`, `helheim`** — three of the nine worlds are still
  missing (Alfheim was added: Gylfaginning 17, Grímnismál 5). Searched for
  directly, not skipped: in both editions the literal toponym never appears,
  only periphrasis — "the land of the Vanir" (Gylfaginning 23), "the
  Dark-Elves" (Gylfaginning 17), "the home of the Wanes" (Vafþrúðnismál 39).
  "Svartalfaheim" appears only in Bellows' own introduction, never a
  translated stanza. (Vǫluspá 37's "Niðavellir" is a distinct dwarf-hall, not
  this.) Helheim may not even be a further gap — Brodeur never separates a
  place called "Helheim" from the person Hel (Gylfaginning 34), and the
  existing `hel` + `niflheim` entities already cover that ground.

### Relation vocabulary

- There is no type for _consulting_ or _taking counsel_, so Óðinn riding to
  Mímir's well at Gylfaginning 51 cannot be recorded. Adding one would also cover
  Óðinn and the Norns, and Gylfaginning 15's account of Mímir's wisdom, and the
  wisdom-contest with **Vafþrúðnir** (Vafþrúðnismál) — checked directly against
  Bellows during the Phase 1 entity expansion and left out for exactly this
  reason, not for lack of a citation.
- There is also no type for a **messenger or servant relationship**. Skírnir
  wooing Gerðr on Freyr's behalf, in exchange for Freyr's sword (Gylfaginning
  37), is well attested but has nowhere to attach: he is not Freyr's kin, does
  not own the sword, and does not fight him. Same gap blocks **Hœnir**, whom
  the Vanir take as hostage in exchange for Njörðr (Gylfaginning 23) — a
  mutual exchange, not kinship, conflict, possession, or location. Both were
  checked against the source text and dropped from Phase 1 rather than forced
  into `fosters` or `dwells_in`.
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
