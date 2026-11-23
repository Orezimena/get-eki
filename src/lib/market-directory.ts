import { withinStallBudget, type Market, type MarketStats } from "./eki";

type DirectoryRow = { market: Market; stats: MarketStats };
export type DirectoryFilters = {
  search: string;
  types: string[];
  region: string | null;
  feeLimit: number | null;
  minScore: number | null;
  ratedOnly: boolean;
};

// Keep search results separate from filtered results so the directory can
// distinguish a missing market from markets hidden by the selected filters.
export function directoryResults(rows: DirectoryRow[], filters: DirectoryFilters) {
  const q = filters.search.trim().toLowerCase();
  const searched = rows.filter(
    ({ market }) =>
      !q || market.name.toLowerCase().includes(q) || market.city.toLowerCase().includes(q),
  );
  const filtered = searched.filter(({ market, stats }) => {
    if (filters.types.length && !filters.types.includes(market.type)) return false;
    if (filters.region !== null && market.region !== filters.region) return false;
    if (!withinStallBudget(market, filters.feeLimit)) return false;
    if (filters.ratedOnly && !stats.rated) return false;
    if (filters.minScore !== null && (!stats.rated || (stats.overall ?? 0) < filters.minScore))
      return false;
    return true;
  });
  return { searched, filtered };
}
