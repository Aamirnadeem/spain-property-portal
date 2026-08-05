import { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Waves, Trees } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Property } from '@/lib/types';
import { formatPriceFull, formatPricePerSqm } from '@/lib/format';

type SortKey = 'price' | 'price_per_sqm' | 'size_sqm' | 'commute_min' | 'bedrooms';

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  'City Center': 'bg-chart-1/15 text-chart-1 border-chart-1/25',
  Coastal: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  Hillside: 'bg-chart-3/15 text-chart-3 border-chart-3/25',
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'price_per_sqm', label: '€/m²' },
  { key: 'size_sqm', label: 'Size' },
  { key: 'bedrooms', label: 'Beds' },
  { key: 'commute_min', label: 'Commute' },
];

export function ComparisonTable({ properties }: { properties: Property[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('price_per_sqm');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const copy = [...properties];
    copy.sort((a, b) => (a[sortKey] - b[sortKey]) * (sortDir === 'asc' ? 1 : -1));
    return copy;
  }, [properties, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-card-border bg-card" data-testid="table-comparison">
      <p className="border-b border-card-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground sm:hidden">
        Swipe left to see price, size, commute and more →
      </p>
      <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="border-card-border hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 min-w-[220px] bg-card text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Property
              </TableHead>
              <TableHead className="min-w-[110px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Area
              </TableHead>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="min-w-[100px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  onClick={() => handleSort(col.key)}
                  data-testid={`button-sort-${col.key}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </TableHead>
              ))}
              <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nearest transit
              </TableHead>
              <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beach / park
              </TableHead>
              <TableHead className="min-w-[60px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Link
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => {
              const isBeach =
                p.beach_proximity && p.beach_proximity !== 'N/A' && !p.beach_proximity.toLowerCase().startsWith('n/a');
              return (
                <TableRow key={p.id} className="border-card-border" data-testid={`row-property-${p.id}`}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1 text-sm font-medium text-card-foreground" title={p.title}>
                        {p.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.portal}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CATEGORY_BADGE_CLASS[p.category]}>
                      {p.area}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-card-foreground">
                    {formatPriceFull(p.price)}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-card-foreground">
                    {formatPricePerSqm(p.price_per_sqm)}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-card-foreground">{p.size_sqm} m²</TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-card-foreground">{p.bedrooms}</TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-card-foreground">
                    {p.commute_min} min
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="line-clamp-2" title={p.nearest_transit}>
                      {p.nearest_transit}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="flex items-start gap-1.5">
                      {isBeach ? (
                        <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-2" aria-hidden="true" />
                      ) : (
                        <Trees className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-3" aria-hidden="true" />
                      )}
                      <span className="line-clamp-2" title={isBeach ? p.beach_proximity : p.park_proximity}>
                        {isBeach ? p.beach_proximity : p.park_proximity}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View listing: ${p.title}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover-elevate active-elevate-2"
                      data-testid={`link-table-view-${p.id}`}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
      </Table>
    </div>
  );
}
