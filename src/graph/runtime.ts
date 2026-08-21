/**
 * The browser runtime.
 *
 * Everything here is an enhancement over markup that already works. The graph
 * is prerendered SVG with real <a> elements; without this module you can still
 * see it, tab through it, and click a figure to reach its page. This module
 * adds zoom, hover, in-place selection, filtering and arrow-key traversal on
 * top of that, and if it fails to load, nothing that mattered is lost.
 *
 * It contains no user-facing text. Every string is looked up from the payload
 * fetched at mount, which is generated per locale by
 * src/pages/graph/[locale].json.ts.
 */
import { select, type Selection } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { buildIndex, neighbourhood, relationsByFamily, type GraphIndex } from './model.ts';
import { isDeathRelation } from './geometry.ts';
import type { GraphData } from './types.ts';

interface Payload {
  locale: string;
  version: number;
  graph: GraphData;
  entities: Record<string, { epithet: string; summary: string }>;
  strings: Record<string, string>;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function mount(): Promise<void> {
  const figure = document.querySelector<HTMLElement>('[data-graph-canvas]');
  const svg = document.querySelector<SVGSVGElement>('[data-graph]');
  const viewport = document.querySelector<SVGGElement>('[data-graph-viewport]');
  if (!figure || !svg || !viewport) return;

  const locale = document.body.dataset.locale ?? 'en';
  const response = await fetch(`/graph/${locale}.json`);
  if (!response.ok) throw new Error(`graph payload ${response.status}`);
  const payload = (await response.json()) as Payload;

  const index = buildIndex(payload.graph);
  const s = (key: string, params?: Record<string, string | number>) => {
    const raw = payload.strings[key] ?? key;
    return params
      ? raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
      : raw;
  };

  const status = figure.querySelector<HTMLElement>('[data-graph-status]');
  const announce = (message: string) => {
    if (status) status.textContent = message;
  };

  // --------------------------------------------------------------- zoom

  const svgSelection = select(svg) as Selection<SVGSVGElement, unknown, null, undefined>;
  const behaviour: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.35, 6])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewport.setAttribute('transform', event.transform.toString());
    });
  svgSelection.call(behaviour);

  // The pointer should pan the graph, not select label text.
  svg.style.userSelect = 'none';

  const controls = document.querySelector<HTMLElement>('[data-graph-controls]');
  controls?.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.zoom;
      // Applied instantly rather than through d3-transition. The brief spends
      // its motion budget on the load sequence and the Ragnarǫk overlay; a
      // tweened zoom button is exactly the kind of motion to resist, and
      // skipping it keeps a whole d3 module out of the lazy chunk.
      if (action === 'reset') behaviour.transform(svgSelection, zoomIdentity);
      else behaviour.scaleBy(svgSelection, action === 'in' ? 1.45 : 1 / 1.45);
    });
  });

  // ---------------------------------------------------------- selection

  // The <g> is what moves; the <a> inside it is what takes focus.
  const nodeEls = new Map<string, SVGGraphicsElement>();
  svg.querySelectorAll<SVGGraphicsElement>('[data-node]').forEach((el) => {
    nodeEls.set(el.dataset.node!, el);
  });
  const focusNode = (id: string) => nodeEls.get(id)?.querySelector('a')?.focus();
  const edgeEls = new Map<string, SVGPathElement>();
  svg.querySelectorAll<SVGPathElement>('[data-link]').forEach((el) => {
    edgeEls.set(el.dataset.link!, el);
  });

  const panel = document.querySelector<HTMLElement>('[data-entity-panel]');
  const panelTitle = panel?.querySelector<HTMLElement>('#panel-title') ?? null;
  const panelBody = panel?.querySelector<HTMLElement>('[data-panel-body]') ?? null;
  const clearButton = controls?.querySelector<HTMLButtonElement>('[data-clear-selection]') ?? null;

  let selected: string | null = null;

  const clearSelection = () => {
    selected = null;
    svg.removeAttribute('data-selected');
    for (const el of nodeEls.values()) el.classList.remove('is-near', 'is-selected');
    for (const el of edgeEls.values()) el.classList.remove('is-near');
    if (panel) panel.hidden = true;
    if (clearButton) clearButton.hidden = true;
    announce(s('a11y.selectionCleared'));
  };

  const select_ = (id: string) => {
    const node = index.nodeById.get(id);
    if (!node) return;
    selected = id;
    const near = neighbourhood(index, id);

    svg.setAttribute('data-selected', id);
    for (const [nodeId, el] of nodeEls) {
      el.classList.toggle('is-near', near.nodes.has(nodeId));
      el.classList.toggle('is-selected', nodeId === id);
    }
    for (const [linkId, el] of edgeEls) el.classList.toggle('is-near', near.links.has(linkId));

    if (clearButton) clearButton.hidden = false;
    renderPanel(id);
    announce(
      s('graph.selectedAnnounce', { name: node.names.anglicized, count: near.nodes.size - 1 }),
    );
  };

  // ----------------------------------------------------------- the panel

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const renderPanel = (id: string) => {
    if (!panel || !panelBody || !panelTitle) return;
    const node = index.nodeById.get(id);
    if (!node) return;
    const strings = payload.entities[id];

    panelTitle.textContent = node.names.non;
    panelBody.replaceChildren();

    if (strings?.epithet) panelBody.append(el('p', 'panel__epithet', strings.epithet));
    if (strings?.summary) panelBody.append(el('p', 'panel__summary', strings.summary));

    const meta = el('p', 'panel__section');
    meta.append(
      el('span', 'panel__badge', s(`type.${node.type}`)),
      document.createTextNode(' '),
      ...node.classes.flatMap((c) => [
        el('span', 'panel__badge', s(`class.${c}`)),
        document.createTextNode(' '),
      ]),
    );
    panelBody.append(meta);

    const relations = relationsByFamily(index, id);
    const heading = el('p', 'panel__section-title', s('panel.relations'));
    panelBody.append(heading);

    if (relations.length === 0) {
      panelBody.append(el('p', 'panel__epithet', s('panel.noRelations')));
    }

    for (const [family, views] of relations) {
      panelBody.append(el('h3', 'panel__family-name', s(`family.${family}`)));
      const list = el('ul', 'panel__relations');
      for (const { link, other, outgoing } of views) {
        const item = el('li', `panel__relation${isDeathRelation(link.type) ? ' is-death' : ''}`);
        item.append(
          el(
            'span',
            'panel__relation-label',
            s(`relation.${link.type}.${outgoing ? 'label' : 'inverse'}`),
          ),
        );

        const link_ = el('a');
        link_.href = linkTo(`/entity/${other?.id ?? ''}`);
        link_.textContent = other?.names.non ?? '';
        item.append(link_);

        const badge = el(
          'span',
          `panel__badge is-${link.certainty}`,
          s(`certainty.${link.certainty}`),
        );
        badge.title = s(`certainty.${link.certainty}Hint`);
        item.append(document.createTextNode(' '), badge);

        const citation = el(
          'span',
          'panel__relation-citation',
          link.sources.length === 0
            ? s('sources.uncited')
            : link.sources
                .map((ref) => {
                  const work = index.sourceById.get(ref.work);
                  const unit = work?.locusUnit === 'stanza' ? 'sources.stanza' : 'sources.chapter';
                  return `${work?.titles.non ?? ref.work} ${s(unit, { locus: ref.locus })}`;
                })
                .join(' · '),
        );
        item.append(citation);
        list.append(item);
      }
      panelBody.append(list);
    }

    const more = el('a', 'panel__more', s('panel.readMore', { name: node.names.anglicized }));
    more.href = linkTo(`/entity/${id}`);
    panelBody.append(more);

    panel.hidden = false;
  };

  const linkTo = (path: string) => (locale === 'en' ? path : `/${locale}${path}`);

  panel?.querySelector<HTMLButtonElement>('[data-panel-close]')?.addEventListener('click', () => {
    const wasSelected = selected;
    clearSelection();
    if (wasSelected) focusNode(wasSelected);
  });
  clearButton?.addEventListener('click', clearSelection);

  // ------------------------------------------------------------ pointer

  const tip = figure.querySelector<HTMLElement>('[data-graph-tip]');
  const tipName = tip?.querySelector<HTMLElement>('[data-tip-name]') ?? null;
  const tipSummary = tip?.querySelector<HTMLElement>('[data-tip-summary]') ?? null;

  const showTip = (id: string, clientX: number, clientY: number) => {
    if (!tip || !tipName || !tipSummary) return;
    const node = index.nodeById.get(id);
    if (!node) return;
    tipName.textContent = node.names.non;
    tipSummary.textContent = payload.entities[id]?.summary ?? '';
    const box = figure.getBoundingClientRect();
    tip.hidden = false;
    const width = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(clientX - box.left + 14, 8), box.width - width - 8)}px`;
    tip.style.top = `${clientY - box.top + 16}px`;
  };
  const hideTip = () => {
    if (tip) tip.hidden = true;
  };

  svg.addEventListener('pointermove', (event) => {
    const target = (event.target as Element | null)?.closest<SVGGraphicsElement>('[data-node]');
    if (target?.dataset.node) showTip(target.dataset.node, event.clientX, event.clientY);
    else hideTip();
  });
  svg.addEventListener('pointerleave', hideTip);

  svg.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<SVGGraphicsElement>('[data-node]');
    if (!target?.dataset.node) return;
    // The <a> is the no-JavaScript path. With the runtime up, a plain click
    // opens the panel instead — but a modified click still means "open this
    // properly", so leave those alone.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (selected === target.dataset.node) clearSelection();
    else select_(target.dataset.node);
  });

  // ----------------------------------------------------------- keyboard

  svg.addEventListener('keydown', (event) => {
    const focused = (event.target as Element | null)?.closest<SVGGraphicsElement>('[data-node]');

    if (event.key === 'Escape') {
      hideTip();
      if (selected) {
        clearSelection();
        event.preventDefault();
      }
      return;
    }

    if (!focused?.dataset.node) return;
    const id = focused.dataset.node;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select_(id);
      return;
    }

    const direction = ARROWS[event.key];
    if (!direction) return;
    const next = nearestNeighbour(index, id, direction);
    if (!next) return;
    event.preventDefault();
    focusNode(next);
    // Moving focus should describe where you have landed without opening
    // anything — that is what Enter is for.
    const node = index.nodeById.get(next);
    if (node) announce(node.names.anglicized);
  });

  // ------------------------------------------------------------ filters

  const disputedToggle = controls?.querySelector<HTMLInputElement>('[data-filter="disputed"]');
  disputedToggle?.addEventListener('change', () => {
    const only = disputedToggle.checked;
    svg.toggleAttribute('data-filtered', only);
    for (const [linkId, element] of edgeEls) {
      const link = index.linkById.get(linkId);
      const contested = link?.certainty === 'disputed' || link?.certainty === 'variant';
      element.classList.toggle('is-hidden', only && !contested);
    }
  });

  // --------------------------------------------------- optional motion

  document.documentElement.dataset.graphRuntime = 'ready';

  if (prefersReducedMotion()) {
    // Nothing to freeze: the layout in the markup is already the settled one.
    announce(s('graph.motionReduced'));
    return;
  }

  const { animate } = await import('./simulation.ts');
  animate({ svg, index, nodeEls, edgeEls });
}

const ARROWS: Record<string, [number, number] | undefined> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The connected figure that lies most nearly in `direction`.
 *
 * Traversal follows relations rather than screen position: arrowing away from
 * Loki should land on his children, not on whatever happens to have been laid
 * out to the right of him. Among his relations, direction decides which.
 */
function nearestNeighbour(
  index: GraphIndex,
  from: string,
  direction: [number, number],
): string | null {
  const origin = index.nodeById.get(from);
  if (!origin) return null;
  let best: { id: string; score: number } | null = null;

  for (const id of index.neighbours.get(from) ?? []) {
    const node = index.nodeById.get(id);
    if (!node) continue;
    const dx = node.x - origin.x;
    const dy = node.y - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    const alignment = (dx * direction[0] + dy * direction[1]) / distance;
    if (alignment <= 0.25) continue; // behind us, or too far off-axis to mean it
    const score = alignment - distance / 4000;
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id ?? null;
}
