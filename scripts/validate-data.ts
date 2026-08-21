/**
 * Validates everything under data/ and fails loudly.
 *
 * Two layers run here. JSON Schema (data/schema/) checks the shape of each
 * file in isolation. Everything after that checks the things a schema cannot
 * see: that ids resolve across files, that a citation points at a work that
 * actually exists, and that nobody has quietly invented a locus.
 *
 * The last rule is the important one. This dataset's only real asset is that
 * every claim in it can be checked against a public-domain edition. A
 * fabricated chapter number is worse than a missing one, because it poisons a
 * dataset other people will trust and build on. So: a relation with no
 * citation must say so, by being `certainty: "unverified"` with an empty
 * `sources` array AND an entry in data/TODO.md. The validator enforces all
 * three halves of that, and there is no way to opt out.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  RELATION_FAMILIES,
  SYMMETRIC_TYPES,
  type Entity,
  type Relation,
  type RelationFamily,
  type RelationType,
  type Source,
} from '../src/graph/types.ts';

const DATA = 'data';
const ENTITY_DIR = join(DATA, 'entities');
const RELATION_DIR = join(DATA, 'relations');
const SCHEMA_DIR = join(DATA, 'schema');
const SOURCES_FILE = join(DATA, 'sources.json');
const TODO_FILE = join(DATA, 'TODO.md');

const errors: string[] = [];
const warnings: string[] = [];

const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);
const warn = (where: string, message: string) => warnings.push(`${where}: ${message}`);

const readJson = <T>(path: string): T => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (cause) {
    console.error(`\n  ${path} is not valid JSON.\n  ${(cause as Error).message}\n`);
    process.exit(1);
  }
};

// ---------------------------------------------------------------- schema layer

// strict: true catches typos in schema keywords, which is exactly what we want
// while the schemas are still growing. strictRequired is the one sub-check we
// turn off: it objects to `required` inside an if/then branch that does not
// also redeclare the property, and our conditional rules ("works must have a
// partOf") are all written that way.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats.default(ajv);

const compile = (name: string): ValidateFunction =>
  ajv.compile(readJson(join(SCHEMA_DIR, `${name}.schema.json`)));

const validateEntityFile = compile('entity');
const validateRelationFile = compile('relation');
const validateSourcesFile = compile('sources');

const runSchema = (validate: ValidateFunction, data: unknown, path: string) => {
  if (validate(data)) return;
  for (const e of validate.errors ?? []) {
    fail(`${path}${e.instancePath}`, `${e.message ?? 'schema violation'}`);
  }
};

// ------------------------------------------------------------------- load data

const jsonFilesIn = (dir: string) =>
  readdirSync(dir)
    .filter((f) => extname(f) === '.json')
    .sort();

const sources = readJson<Source[]>(SOURCES_FILE);
runSchema(validateSourcesFile, sources, SOURCES_FILE);

const entities: Entity[] = [];
const entityOrigin = new Map<string, string>();
for (const file of jsonFilesIn(ENTITY_DIR)) {
  const path = join(ENTITY_DIR, file);
  const parsed = readJson<Entity[]>(path);
  runSchema(validateEntityFile, parsed, path);
  for (const entity of parsed) {
    if (entityOrigin.has(entity.id)) {
      fail(path, `duplicate entity id "${entity.id}" (already defined in ${entityOrigin.get(entity.id)})`);
      continue;
    }
    entityOrigin.set(entity.id, path);
    entities.push(entity);
  }
}

const relations: Relation[] = [];
const relationOrigin = new Map<string, string>();
const relationFamily = new Map<string, RelationFamily>();
for (const file of jsonFilesIn(RELATION_DIR)) {
  const path = join(RELATION_DIR, file);
  const family = basename(file, '.json') as RelationFamily;
  if (!(family in RELATION_FAMILIES)) {
    fail(path, `unknown relation family "${family}" — expected one of ${Object.keys(RELATION_FAMILIES).join(', ')}`);
    continue;
  }
  const parsed = readJson<Relation[]>(path);
  runSchema(validateRelationFile, parsed, path);
  for (const relation of parsed) {
    if (relationOrigin.has(relation.id)) {
      fail(path, `duplicate relation id "${relation.id}" (already defined in ${relationOrigin.get(relation.id)})`);
      continue;
    }
    relationOrigin.set(relation.id, path);
    relationFamily.set(relation.id, family);
    relations.push(relation);
  }
}

// -------------------------------------------------------- cross-file integrity

const entityIds = new Set(entities.map((e) => e.id));
const sourceById = new Map(sources.map((s) => [s.id, s]));

// §4.4 — every sources[].work resolves, and resolves to a WORK, not a collection.
// Citing "prose-edda" instead of "gylfaginning" loses the locus's meaning.
for (const source of sources) {
  if (source.kind === 'work' && source.partOf && !sourceById.has(source.partOf)) {
    fail(SOURCES_FILE, `"${source.id}" is partOf "${source.partOf}", which is not registered`);
  }
  if (source.kind === 'work' && source.partOf && sourceById.get(source.partOf)?.kind !== 'collection') {
    fail(SOURCES_FILE, `"${source.id}" is partOf "${source.partOf}", which is not a collection`);
  }
}

// §4.4 — entity attestations resolve, and point at collections.
for (const entity of entities) {
  const where = `${entityOrigin.get(entity.id)} → ${entity.id}`;
  for (const attestation of entity.attestations) {
    const source = sourceById.get(attestation);
    if (!source) {
      fail(where, `attestation "${attestation}" is not registered in ${SOURCES_FILE}`);
    } else if (source.kind !== 'collection') {
      fail(where, `attestation "${attestation}" is a work; entities attest to collections`);
    }
  }
}

const seenTriples = new Map<string, string>();

for (const relation of relations) {
  const where = `${relationOrigin.get(relation.id)} → ${relation.id}`;
  const family = relationFamily.get(relation.id);

  // §4.4 — every from/to resolves to an existing entity id.
  if (!entityIds.has(relation.from)) fail(where, `"from" references unknown entity "${relation.from}"`);
  if (!entityIds.has(relation.to)) fail(where, `"to" references unknown entity "${relation.to}"`);

  // §4.4 — relation ids are derivable from their from/to/type triple.
  const expectedId = `${relation.from}--${relation.to}--${relation.type}`;
  if (relation.id !== expectedId) {
    fail(where, `id must be "${expectedId}" — it is derived from from/to/type, never chosen`);
  }

  if (relation.from === relation.to) {
    fail(where, 'a relation may not point an entity at itself');
  }

  // One triple, one relation — including the mirrored form of a symmetric type.
  const canonical = SYMMETRIC_TYPES.includes(relation.type)
    ? [relation.from, relation.to].sort().join('--') + `--${relation.type}`
    : expectedId;
  const previous = seenTriples.get(canonical);
  if (previous) {
    fail(where, `duplicates "${previous}" — ${SYMMETRIC_TYPES.includes(relation.type) ? 'this type is symmetric, so only one direction may be recorded' : 'the same triple is already defined'}`);
  } else {
    seenTriples.set(canonical, relation.id);
  }

  // A type belongs to exactly one family, and lives only in that family's file.
  if (family) {
    const allowed = RELATION_FAMILIES[family] as readonly RelationType[];
    if (!allowed.includes(relation.type)) {
      const home = (Object.keys(RELATION_FAMILIES) as RelationFamily[]).find((f) =>
        (RELATION_FAMILIES[f] as readonly RelationType[]).includes(relation.type),
      );
      fail(where, `type "${relation.type}" does not belong in ${family}.json${home ? ` — move it to ${home}.json` : ''}`);
    }
  }

  if (SYMMETRIC_TYPES.includes(relation.type) && relation.directed) {
    fail(where, `"${relation.type}" is symmetric and must not be marked directed`);
  }

  // §4.4 — no empty sources unless unverified; and no sources if unverified.
  if (relation.certainty === 'unverified') {
    if (relation.sources.length > 0) {
      fail(where, 'certainty is "unverified" but sources are present — if you have a locus, it is not unverified');
    }
  } else if (relation.sources.length === 0) {
    fail(
      where,
      `certainty is "${relation.certainty}" but sources is empty. Either cite a locus, or set certainty to "unverified" and add this relation to ${TODO_FILE}. Do not guess a locus.`,
    );
  }

  for (const ref of relation.sources) {
    const source = sourceById.get(ref.work);
    if (!source) {
      fail(where, `cites work "${ref.work}", which is not registered in ${SOURCES_FILE}`);
    } else if (source.kind !== 'work') {
      fail(where, `cites "${ref.work}", which is a collection — cite the individual work so the locus means something`);
    }
  }

  for (const target of relation.contradicts ?? []) {
    if (!relationOrigin.has(target)) {
      fail(where, `contradicts "${target}", which is not a defined relation`);
    }
    if (target === relation.id) {
      fail(where, 'a relation cannot contradict itself');
    }
  }

  if ((relation.contradicts?.length ?? 0) > 0 && !['variant', 'disputed'].includes(relation.certainty)) {
    fail(where, `has "contradicts" but certainty is "${relation.certainty}" — only variant and disputed relations record a competing reading`);
  }
}

// Contradiction must be mutual, or the interface can only show one side of it.
for (const relation of relations) {
  for (const target of relation.contradicts ?? []) {
    const other = relations.find((r) => r.id === target);
    if (other && !(other.contradicts ?? []).includes(relation.id)) {
      fail(`${relationOrigin.get(relation.id)} → ${relation.id}`, `contradicts "${target}", but "${target}" does not contradict it back — record it on both sides`);
    }
  }
}

// §4.4 — every unverified relation must be written down as owed work.
let todo = '';
try {
  todo = readFileSync(TODO_FILE, 'utf8');
} catch {
  fail(TODO_FILE, 'is missing — unverified relations must be tracked somewhere');
}
for (const relation of relations.filter((r) => r.certainty === 'unverified')) {
  if (!todo.includes(relation.id)) {
    fail(
      `${relationOrigin.get(relation.id)} → ${relation.id}`,
      `is unverified but is not listed in ${TODO_FILE}. An uncited claim must be visible as owed work, not quietly parked in the data.`,
    );
  }
}

// ------------------------------------------------------------------- warnings

const degree = new Map<string, number>();
for (const relation of relations) {
  degree.set(relation.from, (degree.get(relation.from) ?? 0) + 1);
  degree.set(relation.to, (degree.get(relation.to) ?? 0) + 1);
}
for (const entity of entities) {
  if (!degree.has(entity.id)) {
    warn(entity.id, 'has no relations, so it will not appear in the graph');
  }
  if (entity.tags.length === 0) {
    warn(entity.id, 'has no tags, so it will never surface as a related-entity suggestion');
  }
}

// ---------------------------------------------------------------------- report

const PLURALS: Record<string, string> = { entity: 'entities' };
const plural = (n: number, word: string) =>
  `${n} ${n === 1 ? word : (PLURALS[word] ?? `${word}s`)}`;

if (warnings.length > 0) {
  console.log(`\n  ${plural(warnings.length, 'warning')}:`);
  for (const w of warnings) console.log(`    · ${w}`);
}

if (errors.length > 0) {
  console.error(`\n  ${plural(errors.length, 'error')}:`);
  for (const e of errors) console.error(`    ✗ ${e}`);
  console.error('');
  process.exit(1);
}

const certaintyCounts = relations.reduce<Record<string, number>>((acc, r) => {
  acc[r.certainty] = (acc[r.certainty] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `\n  data/ is valid — ${plural(entities.length, 'entity')}, ${plural(relations.length, 'relation')}, ${plural(sources.length, 'source')}.`,
);
console.log(
  `  certainty: ${Object.entries(certaintyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')}\n`,
);
