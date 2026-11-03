export function rankNeighborhoods(records, { borough, tier, search, sort }) {
  const term = search.trim().toLowerCase();
  return records.filter((row) => (
    (!borough || row.borough === borough) &&
    (!tier || row.tier === tier) &&
    row.name.toLowerCase().includes(term)
  )).sort((a, b) => {
    const difference = sort === 'asking' ? a.asking - b.asking : b[sort] - a[sort];
    return difference || b.score - a.score || a.name.localeCompare(b.name) || a.borough.localeCompare(b.borough);
  });
}
