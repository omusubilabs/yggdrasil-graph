/**
 * The lazily fetched payload: the graph plus everything the browser runtime
 * needs to render text, in one request per locale.
 *
 * This is a prerendered static file, not an endpoint in any live sense — it is
 * written to dist/graph/en.json at build time and served by Workers Static
 * Assets like any other asset. There is no Worker request handler here.
 *
 * Strings are bundled in rather than left to the runtime, which is what keeps
 * runtime.ts free of hardcoded text: it never composes a sentence, it looks one
 * up. Only the short forms of entity prose travel here — the full account lives
 * on the prerendered /entity/<id> page, where a crawler and a screen reader can
 * find it without executing anything.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import graph from '../../generated/graph.json';
import type { GraphData } from '../../graph/types.ts';
import { ACTIVE_LOCALES, type Locale } from '../../i18n/config.ts';
import { t } from '../../i18n/index.ts';

export const getStaticPaths: GetStaticPaths = () =>
  ACTIVE_LOCALES.map((locale) => ({ params: { locale } }));

/**
 * Exactly the keys src/graph/runtime.ts asks for, listed explicitly so the
 * payload cannot quietly grow into a copy of the whole locale file.
 */
const RUNTIME_KEYS = [
  'panel.close',
  'panel.oldNorse',
  'panel.type',
  'panel.classes',
  'panel.tags',
  'panel.attestedIn',
  'panel.relations',
  'panel.relatedByTag',
  'panel.citations',
  'panel.viewFull',
  'panel.readMore',
  'panel.empty',
  'panel.noRelations',
  'panel.relationCount',
  'panel.traceStart',
  'panel.traceCancel',
  'graph.selectedAnnounce',
  'graph.regionDescriptionSubset',
  'graph.searchNoResults',
  'graph.scopeAnnounce',
  'graph.neighbourhoodOf',
  'graph.everything',
  'graph.clearSelection',
  'graph.motionReduced',
  'a11y.selectionCleared',
  'a11y.nodeRole',
  'a11y.traceArmed',
  'a11y.traceCancelled',
  'a11y.traceFound',
  'a11y.traceNotFound',
  'certainty.contradictedBy',
  'relatedByTag.sharedLabel',
  'sources.chapter',
  'sources.stanza',
  'sources.page',
  'sources.uncited',
  'filters.noResults',
  'filters.noneOnAnnounce',
  'filters.disputedOnAnnounce',
  'filters.ragnarokOnAnnounce',
  'filters.bothOnAnnounce',
] as const;

const PREFIXED = ['certainty.', 'class.', 'type.', 'tag.', 'family.', 'relation.'];

function enumKeys(data: GraphData): string[] {
  const keys = new Set<string>();
  for (const node of data.nodes) {
    keys.add(`type.${node.type}`);
    for (const c of node.classes) keys.add(`class.${c}`);
    for (const tag of node.tags) keys.add(`tag.${tag}`);
  }
  for (const link of data.links) {
    keys.add(`certainty.${link.certainty}`);
    keys.add(`certainty.${link.certainty}Hint`);
    keys.add(`family.${link.family}`);
    keys.add(`relation.${link.type}.label`);
    keys.add(`relation.${link.type}.inverse`);
  }
  return [...keys];
}

export const GET: APIRoute = ({ params }) => {
  const locale = params.locale as Locale;
  const data = graph as unknown as GraphData;

  const strings: Record<string, string> = {};
  for (const key of RUNTIME_KEYS) strings[key] = t(locale, key);
  for (const key of enumKeys(data)) {
    if (PREFIXED.some((p) => key.startsWith(p))) strings[key] = t(locale, key);
  }

  const entities: Record<string, { epithet: string; summary: string }> = {};
  for (const node of data.nodes) {
    entities[node.id] = {
      epithet: t(locale, `entity.${node.id}.epithet`),
      summary: t(locale, `entity.${node.id}.summary`),
    };
  }

  return new Response(
    JSON.stringify({ locale, version: data.version, graph: data, entities, strings }),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
