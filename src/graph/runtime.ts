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
import {
  boundsForNodeIds,
  buildIndex,
  neighbourhood,
  ragnarokOverlay,
  relatedByTag,
  relationsByFamily,
  searchEntities,
  type GraphIndex,
} from './model.ts';
import {
  edgePath,
  haloRadius,
  isDeathRelation,
  labelOffset,
  labelSize,
  linkClassNames,
  nodeClassNames,
  nodeRadius,
  nodeShapePath,
  trimToRim,
  viewBoxOf,
} from './geometry.ts';
import { decodeUrlState, encodeUrlState } from './urlState.ts';
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
  const linkTo = (path: string) => (locale === 'en' ? path : `/${locale}${path}`);
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

  // The document contains only the thesis-led core. Once the static payload
  // arrives, create the rest of the SVG in place but keep it out of scope until
  // search, a filter, or the all-figures toggle asks for it.
  materializeGraph(svg, payload.graph, s, linkTo);

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

  const disputedToggle = controls?.querySelector<HTMLInputElement>('[data-filter="disputed"]');
  const ragnarokToggle = controls?.querySelector<HTMLInputElement>('[data-filter="ragnarok"]');
  const showAllToggle = controls?.querySelector<HTMLInputElement>('[data-show-all]');
  const ragnarok = ragnarokOverlay(index);
  let showAll = false;
  let visibleNodeIds = new Set(payload.graph.core.nodeIds);
  let applyVisibility = () => {};

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
    applyVisibility();
    announce(s('a11y.selectionCleared'));
    syncUrl();
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
    applyVisibility();
    renderPanel(id);
    announce(
      s('graph.selectedAnnounce', { name: node.names.anglicized, count: near.nodes.size - 1 }),
    );
    syncUrl();
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

    // The title is itself the route to the full account, as well as the link at
    // the foot of the panel — the reader should not have to scroll a panel to
    // find out that there is more.
    const titleLink = el('a');
    titleLink.href = linkTo(`/entity/${id}`);
    titleLink.textContent = node.names.non;
    panelTitle.replaceChildren(titleLink);
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
                  const unit = `sources.${ref.unit ?? work?.locusUnit ?? 'chapter'}`;
                  return `${work?.titles.non ?? ref.work} ${s(unit, { locus: ref.locus })}`;
                })
                .join(' · '),
        );
        item.append(citation);
        list.append(item);
      }
      panelBody.append(list);
    }

    const suggestions = relatedByTag(index, id);
    if (suggestions.length > 0) {
      panelBody.append(el('p', 'panel__section-title', s('panel.relatedByTag')));
      const list = el('ul', 'panel__relations');
      for (const { node: other, tags } of suggestions) {
        const item = el('li', 'panel__relation');
        const link_ = el('a');
        link_.href = linkTo(`/entity/${other.id}`);
        link_.textContent = other.names.non;
        item.append(link_);
        item.append(el('span', 'panel__relation-label', s('relatedByTag.sharedLabel')));
        for (const tag of tags) {
          item.append(document.createTextNode(' '), el('span', 'panel__badge', s(`tag.${tag}`)));
        }
        list.append(item);
      }
      panelBody.append(list);
    }

    const more = el('a', 'panel__more', s('panel.readMore', { name: node.names.anglicized }));
    more.href = linkTo(`/entity/${id}`);
    panelBody.append(more);

    panel.hidden = false;
  };

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
    const next = nearestNeighbour(index, id, direction, visibleNodeIds);
    if (!next) return;
    event.preventDefault();
    focusNode(next);
    // Moving focus should describe where you have landed without opening
    // anything — that is what Enter is for.
    const node = index.nodeById.get(next);
    if (node) announce(node.names.anglicized);
  });

  // ------------------------------------------------------------- search

  const searchInput = controls?.querySelector<HTMLInputElement>('[data-entity-search]');
  const searchList = controls?.querySelector<HTMLUListElement>('[role="listbox"]');
  let searchResultIds: string[] = [];
  let activeResult = -1;

  const closeSearch = () => {
    if (!searchInput || !searchList) return;
    searchList.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    activeResult = -1;
  };

  const setActiveResult = (next: number) => {
    if (!searchInput || !searchList || searchResultIds.length === 0) return;
    activeResult = (next + searchResultIds.length) % searchResultIds.length;
    searchList.querySelectorAll<HTMLElement>('[role="option"]').forEach((option, i) => {
      option.setAttribute('aria-selected', String(i === activeResult));
    });
    const active = searchList.querySelector<HTMLElement>(`#graph-search-result-${activeResult}`);
    if (active) {
      searchInput.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  };

  const renderSearch = () => {
    if (!searchInput || !searchList) return;
    const matches = searchEntities(payload.graph, searchInput.value, 8);
    searchResultIds = matches.map((node) => node.id);
    activeResult = -1;
    searchList.replaceChildren();

    if (searchInput.value.trim() === '') {
      closeSearch();
      return;
    }
    if (matches.length === 0) {
      const item = el('li', undefined, s('graph.searchNoResults'));
      item.setAttribute('role', 'option');
      item.setAttribute('aria-disabled', 'true');
      searchList.append(item);
    } else {
      matches.forEach((node, i) => {
        const item = el('li');
        item.id = `graph-search-result-${i}`;
        item.dataset.searchId = node.id;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.append(
          el('span', 'search-result__non', node.names.non),
          el('span', 'search-result__en', node.names.anglicized),
        );
        searchList.append(item);
      });
    }
    searchList.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  };

  const chooseSearchResult = (id: string) => {
    const node = index.nodeById.get(id);
    if (!node || !searchInput) return;
    searchInput.value = node.names.non;
    closeSearch();
    select_(id);
    focusNode(id);
  };

  searchInput?.addEventListener('input', renderSearch);
  searchInput?.addEventListener('focus', renderSearch);
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResult(activeResult + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResult(activeResult - 1);
    } else if (event.key === 'Enter' && activeResult >= 0) {
      event.preventDefault();
      chooseSearchResult(searchResultIds[activeResult]!);
    } else if (event.key === 'Escape') {
      closeSearch();
    }
  });
  searchList?.addEventListener('pointerdown', (event) => {
    const option = (event.target as Element | null)?.closest<HTMLElement>('[data-search-id]');
    if (!option) return;
    // Keep focus on the combobox until click commits the result. Hiding the
    // option during pointerdown removes the click target and lets the input's
    // focus handler reopen the list in some browsers.
    event.preventDefault();
  });
  searchList?.addEventListener('click', (event) => {
    const option = (event.target as Element | null)?.closest<HTMLElement>('[data-search-id]');
    if (!option?.dataset.searchId) return;
    chooseSearchResult(option.dataset.searchId);
  });
  controls?.querySelector('.controls__search')?.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!controls?.querySelector('.controls__search')?.contains(document.activeElement))
        closeSearch();
    }, 0);
  });

  // ------------------------------------------------------------ scope

  applyVisibility = () => {
    const nodes = new Set(
      showAll ? payload.graph.nodes.map((node) => node.id) : payload.graph.core.nodeIds,
    );
    const links = new Set(
      showAll ? payload.graph.links.map((link) => link.id) : payload.graph.core.linkIds,
    );
    const focusIds = new Set<string>();

    if (selected) {
      const near = neighbourhood(index, selected);
      near.nodes.forEach((id) => {
        nodes.add(id);
        focusIds.add(id);
      });
      near.links.forEach((id) => links.add(id));
    }

    const disputed = disputedToggle?.checked ?? false;
    if (disputed) {
      for (const link of payload.graph.links) {
        if (link.certainty !== 'disputed' && link.certainty !== 'variant') continue;
        links.add(link.id);
        nodes.add(link.from);
        nodes.add(link.to);
        focusIds.add(link.from);
        focusIds.add(link.to);
      }
    }

    const ragnarokOn = ragnarokToggle?.checked ?? false;
    if (ragnarokOn) {
      for (const id of [...ragnarok.combatantIds, ...ragnarok.lineageNodeIds]) {
        nodes.add(id);
        focusIds.add(id);
      }
      for (const id of [...ragnarok.pairingLinkIds, ...ragnarok.lineageLinkIds]) links.add(id);
    }

    visibleNodeIds = nodes;
    for (const [id, element] of nodeEls) {
      const visible = nodes.has(id);
      element.classList.toggle('is-out-of-scope', !visible);
      element.setAttribute('aria-hidden', String(!visible));
      const anchor = element.querySelector<SVGAElement>('a');
      if (anchor) {
        if (visible) anchor.removeAttribute('tabindex');
        else anchor.setAttribute('tabindex', '-1');
      }
      element.classList.toggle(
        'is-ragnarok-combatant',
        ragnarokOn && ragnarok.combatantIds.has(id),
      );
      element.classList.toggle(
        'is-ragnarok-lineage',
        ragnarokOn && ragnarok.lineageNodeIds.has(id),
      );
    }

    let visibleLinks = 0;
    for (const [id, element] of edgeEls) {
      const link = index.linkById.get(id);
      const contested = link?.certainty === 'disputed' || link?.certainty === 'variant';
      const visible = Boolean(link && links.has(id) && nodes.has(link.from) && nodes.has(link.to));
      element.classList.toggle('is-out-of-scope', !visible);
      element.classList.toggle('is-hidden', disputed && !contested);
      element.classList.toggle(
        'is-ragnarok-pairing',
        ragnarokOn && ragnarok.pairingLinkIds.has(id),
      );
      element.classList.toggle(
        'is-ragnarok-lineage',
        ragnarokOn && ragnarok.lineageLinkIds.has(id),
      );
      if (visible && (!disputed || contested)) visibleLinks += 1;
    }

    svg.toggleAttribute('data-filtered', disputed);
    svg.toggleAttribute('data-ragnarok', ragnarokOn);
    // Tells the mobile CSS scale in GraphCanvas.astro the viewBox is no
    // longer the baked cold-open core, so it doesn't double-apply.
    svg.toggleAttribute('data-view-scope', focusIds.size > 0 || showAll);
    const bounds =
      focusIds.size > 0
        ? boundsForNodeIds(index, focusIds)
        : showAll
          ? payload.graph.bounds
          : payload.graph.core.bounds;
    svg.setAttribute('viewBox', viewBoxOf(bounds));
    behaviour.transform(svgSelection, zoomIdentity);

    const description = svg.querySelector('#graph-description');
    if (description) {
      description.textContent = s('graph.regionDescriptionSubset', {
        visible: nodes.size,
        total: payload.graph.nodes.length,
        links: visibleLinks,
      });
    }
  };

  showAllToggle?.addEventListener('change', () => {
    showAll = showAllToggle.checked;
    applyVisibility();
    announce(
      s('graph.scopeAnnounce', { visible: visibleNodeIds.size, total: payload.graph.nodes.length }),
    );
    syncUrl();
  });
  disputedToggle?.addEventListener('change', () => {
    applyVisibility();
    syncUrl();
  });
  ragnarokToggle?.addEventListener('change', () => {
    applyVisibility();
    syncUrl();
  });

  // Mirrors selection, scope and filters to the query string so a copied link
  // reopens the same view. Deliberately replaceState, not pushState — toggling
  // a filter shouldn't spam browser history — and deliberately no `popstate`
  // listener: the brief is "a shared link reopens the view", not "back undoes
  // an action", and generic re-hydration on back/forward is a bigger feature.
  function syncUrl() {
    const query = encodeUrlState({
      selected,
      disputed: disputedToggle?.checked ?? false,
      ragnarok: ragnarokToggle?.checked ?? false,
      all: showAll,
    });
    history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
  }

  // ------------------------------------------------------- url hydration

  const initial = decodeUrlState(window.location.search);
  if (initial.all && showAllToggle) {
    showAll = true;
    showAllToggle.checked = true;
  }
  if (initial.disputed && disputedToggle) {
    disputedToggle.checked = true;
  }
  if (initial.ragnarok && ragnarokToggle) {
    ragnarokToggle.checked = true;
  }
  applyVisibility();
  if (initial.selected && index.nodeById.has(initial.selected)) {
    select_(initial.selected);
    focusNode(initial.selected);
  }
  // Unconditional: normalises away a stale/invalid ?selected= that select_()
  // silently ignored, rather than leaving it dangling in the address bar.
  syncUrl();

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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Add payload-only nodes and edges without putting them in the initial HTML. */
function materializeGraph(
  svg: SVGSVGElement,
  graph: GraphData,
  s: (key: string, params?: Record<string, string | number>) => string,
  linkTo: (path: string) => string,
) {
  const edgeLayer = svg.querySelector<SVGGElement>('[data-graph-edges]');
  const nodeLayer = svg.querySelector<SVGGElement>('[data-graph-nodes]');
  if (!edgeLayer || !nodeLayer) return;
  const scopeAttributes = [...svg.attributes]
    .map((attribute) => attribute.name)
    .filter((name) => name.startsWith('data-astro-cid-'));
  const applyScope = (...elements: Element[]) => {
    for (const element of elements) {
      for (const attribute of scopeAttributes) element.setAttribute(attribute, '');
    }
  };

  const positions = new Map(graph.nodes.map((node) => [node.id, node]));
  const existingLinks = new Set(
    [...svg.querySelectorAll<SVGPathElement>('[data-link]')].map((path) => path.dataset.link),
  );
  for (const link of graph.links) {
    if (existingLinks.has(link.id)) continue;
    const from = positions.get(link.from);
    const to = positions.get(link.to);
    if (!from || !to) continue;
    const [endX, endY] = link.directed
      ? trimToRim(from.x, from.y, to.x, to.y, nodeRadius(to.degree))
      : [to.x, to.y];
    const path = document.createElementNS(SVG_NS, 'path');
    applyScope(path);
    const className = linkClassNames(link);
    path.setAttribute('class', `${className} is-out-of-scope`);
    path.setAttribute('d', edgePath(from.x, from.y, endX, endY, link.curve));
    path.dataset.link = link.id;
    path.dataset.from = link.from;
    path.dataset.to = link.to;
    path.dataset.certainty = link.certainty;
    if (link.directed) {
      path.setAttribute(
        'marker-end',
        className.includes('is-death') ? 'url(#arrow-minium)' : 'url(#arrow-ink)',
      );
    }
    edgeLayer.append(path);
  }

  const existingNodes = new Set(
    [...svg.querySelectorAll<SVGGraphicsElement>('[data-node]')].map((group) => group.dataset.node),
  );
  for (const node of graph.nodes) {
    if (existingNodes.has(node.id)) continue;
    const group = document.createElementNS(SVG_NS, 'g');
    applyScope(group);
    group.setAttribute('class', `${nodeClassNames(node)} is-out-of-scope`);
    group.dataset.node = node.id;
    group.dataset.rank = String(node.coreRank);
    group.dataset.degree = String(node.degree);
    group.setAttribute('transform', `translate(${node.x},${node.y})`);
    group.setAttribute('aria-hidden', 'true');

    const anchor = document.createElementNS(SVG_NS, 'a');
    applyScope(anchor);
    anchor.setAttribute('href', linkTo(`/entity/${node.id}`));
    anchor.setAttribute('tabindex', '-1');
    anchor.setAttribute(
      'aria-label',
      s('a11y.nodeRole', {
        name: node.names.anglicized,
        type: s(`type.${node.type}`),
        count: node.degree,
      }),
    );

    const halo = document.createElementNS(SVG_NS, 'path');
    halo.setAttribute('class', 'node__halo');
    halo.setAttribute('d', nodeShapePath(node.type, haloRadius(node, graph.nodes)));
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('class', 'node__shape');
    shape.setAttribute('d', nodeShapePath(node.type, nodeRadius(node.degree)));
    const label = document.createElementNS(SVG_NS, 'text');
    applyScope(halo, shape, label);
    label.setAttribute('class', 'node__label');
    label.setAttribute('y', String(labelOffset(node.degree)));
    label.setAttribute('font-size', String(labelSize(node.coreRank)));
    label.textContent = node.names.non;
    anchor.append(halo, shape, label);
    group.append(anchor);
    nodeLayer.append(group);
  }
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
  visible: ReadonlySet<string>,
): string | null {
  const origin = index.nodeById.get(from);
  if (!origin) return null;
  let best: { id: string; score: number } | null = null;

  for (const id of index.neighbours.get(from) ?? []) {
    if (!visible.has(id)) continue;
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
