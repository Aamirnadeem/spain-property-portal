import { BedDouble, Ruler, TrainFront, Waves, Trees, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Property } from '@/lib/types';
import { CATEGORY_INFO } from '@/lib/types';
import { formatPriceFull, formatPricePerSqm } from '@/lib/format';

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  'City Center': 'bg-chart-1/15 text-chart-1 border-chart-1/25',
  Coastal: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  Hillside: 'bg-chart-3/15 text-chart-3 border-chart-3/25',
};

export function PropertyCard({ property }: { property: Property }) {
  const isBeach = property.beach_proximity && property.beach_proximity !== 'N/A' && !property.beach_proximity.toLowerCase().startsWith('n/a');

  return (
    <Card
      className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md"
      data-testid={`card-property-${property.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge
          variant="outline"
          className={CATEGORY_BADGE_CLASS[property.category]}
          data-testid={`badge-category-${property.id}`}
        >
          {property.area}
        </Badge>
        <span className="whitespace-nowrap text-xs text-muted-foreground" data-testid={`text-portal-${property.id}`}>
          {property.portal}
        </span>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground" data-testid={`text-title-${property.id}`}>
        {property.title}
      </h3>
      <p className="line-clamp-1 text-xs text-muted-foreground">{property.address}</p>

      <div className="flex items-baseline gap-2 pt-1">
        <span className="font-mono text-xl font-semibold tabular-nums text-card-foreground" data-testid={`text-price-${property.id}`}>
          {formatPriceFull(property.price)}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatPricePerSqm(property.price_per_sqm)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-card-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{property.bedrooms} bed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{property.size_sqm} m²</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5">
          <TrainFront className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title={property.nearest_transit}>
            {property.nearest_transit} · {property.commute_min} min to center
          </span>
        </div>
        {isBeach ? (
          <div className="col-span-2 flex items-center gap-1.5">
            <Waves className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate" title={property.beach_proximity}>
              Beach: {property.beach_proximity}
            </span>
          </div>
        ) : (
          <div className="col-span-2 flex items-center gap-1.5">
            <Trees className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate" title={property.park_proximity}>
              {property.park_proximity}
            </span>
          </div>
        )}
      </div>

      <a
        href={property.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-card-border py-2 text-xs font-medium text-card-foreground hover-elevate active-elevate-2"
        data-testid={`link-view-listing-${property.id}`}
      >
        View listing
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </Card>
  );
}
