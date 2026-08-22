/**
 * JSON-LD for an entity page. Pure — no Astro, no i18n — same boundary
 * model.ts keeps; the caller resolves localized name/description strings and
 * hands them in.
 */
import type { GraphIndex } from './model.ts';
import type { Certainty, EntityType } from './types.ts';

const SCHEMA_TYPE: Record<EntityType, 'Thing' | 'Place' | 'Event'> = {
  deity: 'Thing',
  human: 'Thing',
  being: 'Thing',
  artifact: 'Thing',
  world: 'Place',
  place: 'Place',
  event: 'Event',
  form: 'Thing',
};

/**
 * `variant`/`disputed` relations stay off the machine-readable claim surface.
 * JSON-LD asserts facts to crawlers; the graph's certainty apparatus exists
 * precisely so a contested claim is never presented as a settled one.
 */
const CLAIMABLE_CERTAINTY: ReadonlySet<Certainty> = new Set(['attested', 'implied']);

export interface EntityJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Thing' | 'Place' | 'Event';
  '@id': string;
  url: string;
  name: string;
  alternateName?: string | string[];
  description?: string;
  inLanguage: string;
  citation?: string[];
}

export interface BuildEntityJsonLdOptions {
  index: GraphIndex;
  id: string;
  url: string;
  name: string;
  alternateName?: string | string[];
  description?: string;
  inLanguage: string;
}

export const buildEntityJsonLd = (opts: BuildEntityJsonLdOptions): EntityJsonLd => {
  const { index, id, url, name, alternateName, description, inLanguage } = opts;
  const node = index.nodeById.get(id);

  const jsonLd: EntityJsonLd = {
    '@context': 'https://schema.org',
    '@type': node ? SCHEMA_TYPE[node.type] : 'Thing',
    '@id': url,
    url,
    name,
    inLanguage,
  };
  if (alternateName) {
    const alternatives = (Array.isArray(alternateName) ? alternateName : [alternateName]).filter(
      (candidate) => candidate !== name,
    );
    if (alternatives.length === 1) jsonLd.alternateName = alternatives[0]!;
    else if (alternatives.length > 1) jsonLd.alternateName = alternatives;
  }
  if (description) jsonLd.description = description;

  const citations = new Map<string, string>();
  for (const link of index.incident.get(id) ?? []) {
    if (!CLAIMABLE_CERTAINTY.has(link.certainty)) continue;
    for (const ref of link.sources) {
      const work = index.sourceById.get(ref.work);
      const unit = ref.unit ?? work?.locusUnit;
      const marker = unit === 'page' ? 'p. ' : unit === 'stanza' ? 'st. ' : 'ch. ';
      const label = work
        ? `${work.titles.en} ${marker}${ref.locus}`
        : `${ref.work} ${marker}${ref.locus}`;
      citations.set(`${ref.work}--${ref.locus}`, label);
    }
  }
  if (citations.size > 0) jsonLd.citation = [...citations.values()];

  return jsonLd;
};
