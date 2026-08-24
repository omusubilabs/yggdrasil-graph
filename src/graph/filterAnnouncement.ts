/**
 * The disputed/Ragnarök filter pair's announcement key.
 *
 * Both toggles' change handlers and query-string rehydration need to describe
 * the same thing: the resulting combination of both filters, not just
 * whichever one was touched. Keeping that mapping here, instead of duplicated
 * inline in runtime.ts, is what keeps a direct toggle and a reloaded URL
 * landing on the same graph state honest with each other.
 */

export type FilterAnnouncementKey =
  | 'filters.noneOnAnnounce'
  | 'filters.disputedOnAnnounce'
  | 'filters.ragnarokOnAnnounce'
  | 'filters.bothOnAnnounce';

export const filterAnnouncementKey = (
  disputed: boolean,
  ragnarok: boolean,
): FilterAnnouncementKey => {
  if (disputed && ragnarok) return 'filters.bothOnAnnounce';
  if (disputed) return 'filters.disputedOnAnnounce';
  if (ragnarok) return 'filters.ragnarokOnAnnounce';
  return 'filters.noneOnAnnounce';
};
