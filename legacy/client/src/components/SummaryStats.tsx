import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { formatPrice } from '@/lib/format';

export function SummaryStats({ properties }: { properties: Property[] }) {
  const stats = useMemo(() => {
    if (properties.length === 0) {
      return { count: 0, avgPrice: 0, avgPpsm: 0, avgCommute: 0, minCommute: 0 };
    }
    const count = properties.length;
    const avgPrice = properties.reduce((s, p) => s + p.price, 0) / count;
    const avgPpsm = properties.reduce((s, p) => s + p.price_per_sqm, 0) / count;
    const avgCommute = properties.reduce((s, p) => s + p.commute_min, 0) / count;
    const minCommute = Math.min(...properties.map((p) => p.commute_min));
    return { count, avgPrice, avgPpsm, avgCommute, minCommute };
  }, [properties]);

  const items = [
    { label: 'Matching listings', value: stats.count.toString(), testid: 'stat-count' },
    { label: 'Avg. price', value: stats.count ? formatPrice(stats.avgPrice) : '—', testid: 'stat-avg-price' },
    {
      label: 'Avg. €/m²',
      value: stats.count ? `€${Math.round(stats.avgPpsm).toLocaleString('en-US')}` : '—',
      testid: 'stat-avg-ppsm',
    },
    {
      label: 'Avg. commute',
      value: stats.count ? `${Math.round(stats.avgCommute)} min` : '—',
      testid: 'stat-avg-commute',
    },
    {
      label: 'Fastest commute',
      value: stats.count ? `${stats.minCommute} min` : '—',
      testid: 'stat-min-commute',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => (
        <Card
          key={item.label}
          className={`p-4 ${i === items.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
          data-testid={item.testid}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-card-foreground">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
