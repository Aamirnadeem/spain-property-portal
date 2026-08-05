import { Search, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Filters } from '@/lib/types';
import { CATEGORY_INFO } from '@/lib/types';
import {
  ALL_AREAS,
  ALL_CATEGORIES,
  PRICE_BOUNDS,
  SIZE_BOUNDS,
  COMMUTE_BOUNDS,
  defaultFilters,
} from '@/hooks/use-properties';
import { formatPrice } from '@/lib/format';

interface FilterPanelProps {
  filters: Filters;
  setFilters: (f: Filters) => void;
  resultCount: number;
}

export function FilterPanel({ filters, setFilters, resultCount }: FilterPanelProps) {
  function toggleCategory(cat: string) {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    setFilters({ ...filters, categories: next });
  }

  function toggleArea(area: string) {
    const next = filters.areas.includes(area)
      ? filters.areas.filter((a) => a !== area)
      : [...filters.areas, area];
    setFilters({ ...filters, areas: next });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="panel-filters">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Filters</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => setFilters(defaultFilters())}
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search title, area, portal..."
          className="border-sidebar-border bg-sidebar-accent/40 pl-9 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
          data-testid="input-search"
        />
      </div>

      <Separator className="bg-sidebar-border" />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
          Neighborhood type
        </legend>
        {ALL_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover-elevate"
            data-testid={`checkbox-category-${cat.toLowerCase().replace(/\s/g, '-')}`}
          >
            <Checkbox
              checked={filters.categories.includes(cat)}
              onCheckedChange={() => toggleCategory(cat)}
              className="border-sidebar-foreground/30 data-[state=checked]:border-sidebar-primary data-[state=checked]:bg-sidebar-primary"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm text-sidebar-foreground">{CATEGORY_INFO[cat].label}</span>
              <span className="truncate text-xs text-sidebar-foreground/50">{CATEGORY_INFO[cat].description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Separator className="bg-sidebar-border" />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
          Area
        </legend>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
          {ALL_AREAS.map((area) => (
            <label
              key={area}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover-elevate"
              data-testid={`checkbox-area-${area.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Checkbox
                checked={filters.areas.includes(area)}
                onCheckedChange={() => toggleArea(area)}
                className="border-sidebar-foreground/30 data-[state=checked]:border-sidebar-primary data-[state=checked]:bg-sidebar-primary"
              />
              <span className="text-sm text-sidebar-foreground">{area}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
            Price range
          </Label>
          <span className="font-mono text-xs text-sidebar-foreground/80" data-testid="text-price-range">
            {formatPrice(filters.priceMin)} – {formatPrice(filters.priceMax)}
          </span>
        </div>
        <Slider
          min={PRICE_BOUNDS[0]}
          max={PRICE_BOUNDS[1]}
          step={25000}
          value={[filters.priceMin, filters.priceMax]}
          onValueChange={([min, max]) => setFilters({ ...filters, priceMin: min, priceMax: max })}
          data-testid="slider-price"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
            Size (m²)
          </Label>
          <span className="font-mono text-xs text-sidebar-foreground/80" data-testid="text-size-range">
            {filters.sizeMin} – {filters.sizeMax} m²
          </span>
        </div>
        <Slider
          min={SIZE_BOUNDS[0]}
          max={SIZE_BOUNDS[1]}
          step={5}
          value={[filters.sizeMin, filters.sizeMax]}
          onValueChange={([min, max]) => setFilters({ ...filters, sizeMin: min, sizeMax: max })}
          data-testid="slider-size"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
            Max commute to center
          </Label>
          <span className="font-mono text-xs text-sidebar-foreground/80" data-testid="text-commute-range">
            {filters.commuteMax} min
          </span>
        </div>
        <Slider
          min={COMMUTE_BOUNDS[0]}
          max={COMMUTE_BOUNDS[1]}
          step={1}
          value={[filters.commuteMax]}
          onValueChange={([max]) => setFilters({ ...filters, commuteMax: max })}
          data-testid="slider-commute"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
            Minimum bedrooms
          </Label>
          <span className="font-mono text-xs text-sidebar-foreground/80" data-testid="text-bedrooms-min">
            {filters.bedroomsMin}+
          </span>
        </div>
        <Slider
          min={2}
          max={5}
          step={1}
          value={[filters.bedroomsMin]}
          onValueChange={([min]) => setFilters({ ...filters, bedroomsMin: min })}
          data-testid="slider-bedrooms"
        />
      </div>

      <Separator className="bg-sidebar-border" />

      <p className="text-sm text-sidebar-foreground/70" data-testid="text-result-count">
        <span className="font-semibold text-sidebar-foreground">{resultCount}</span> of 60 listings match
      </p>
    </div>
  );
}
