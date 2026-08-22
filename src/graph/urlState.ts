/**
 * The graph's query-string mirror.
 *
 * Selection and the two filter toggles live as transient DOM/closure state in
 * runtime.ts; this module only translates that state to and from a query
 * string, so a shared link reopens the same view. It knows nothing about the
 * graph itself — no GraphIndex, no validation that an id actually exists —
 * because runtime.ts already guards every id it reads back out of here.
 */

export interface UrlState {
  selected: string | null;
  disputed: boolean;
  ragnarok: boolean;
}

export const encodeUrlState = (state: UrlState): string => {
  const params = new URLSearchParams();
  if (state.selected) params.set('selected', state.selected);
  if (state.disputed) params.set('disputed', '1');
  if (state.ragnarok) params.set('ragnarok', '1');
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const decodeUrlState = (search: string): UrlState => {
  const params = new URLSearchParams(search);
  return {
    selected: params.get('selected'),
    disputed: params.get('disputed') === '1',
    ragnarok: params.get('ragnarok') === '1',
  };
};
