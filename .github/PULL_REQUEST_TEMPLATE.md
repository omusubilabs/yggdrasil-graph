## What this changes

<!-- One or two sentences. If this is a data change, say which entities or relations. -->

## Type of change

- [ ] Data: new entity or entities
- [ ] Data: new or corrected relation
- [ ] Data: new source registration
- [ ] Translation
- [ ] Application code
- [ ] Documentation
- [ ] Build, CI, or tooling

## Data checklist

<!-- Delete this section if the PR touches no files under data/. -->

- [ ] Every new relation carries a real citation, **or** is explicitly `certainty: "unverified"` with an empty `sources` array and an entry in `data/TODO.md`.
- [ ] No citation was guessed. A fabricated locus is worse than a missing one.
- [ ] Citations point at a public-domain edition (Bellows 1923, Brodeur 1916) registered in `data/sources.json`.
- [ ] No text is pasted from a modern copyrighted translation.
- [ ] Entity ids match `^[a-z0-9-]+$` and are not renames of existing ids.
- [ ] Relation ids are exactly `<from>--<to>--<type>`.
- [ ] No prose lives in `data/entities/` — descriptions belong in `src/i18n/locales/en/entities.json`.
- [ ] `npm run validate` passes.

## Code checklist

<!-- Delete this section if the PR touches no files under src/ or scripts/. -->

- [ ] No user-facing string is hardcoded in a component; everything routes through `t()`.
- [ ] `--minium` is not used outside the Ragnarök overlay and death relations.
- [ ] Keyboard navigation and focus visibility still work.
- [ ] `npm run typecheck && npm run lint && npm run build` passes.

## Citations

<!-- List the loci this PR adds or changes, one per line, so a reviewer can check them. -->
