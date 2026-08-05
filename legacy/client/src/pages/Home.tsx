import { useState } from 'react';
import { LayoutGrid, Table2, Sun, Moon } from 'lucide-react';
import { FilterPanel } from '@/components/FilterPanel';
import { PropertyCard } from '@/components/PropertyCard';
import { ComparisonTable } from '@/components/ComparisonTable';
import { SummaryStats } from '@/components/SummaryStats';
import { Button } from '@/components/ui/button';
import { useProperties } from '@/hooks/use-properties';
import { Logo } from '@/components/Logo';
import { useTheme } from '@/lib/theme-provider';

type ViewMode = 'cards' | 'table';

export default function Home() {
  const { properties, filters, setFilters } = useProperties();
  const [view, setView] = useState<ViewMode>('cards');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-base font-semibold leading-tight text-foreground">Barcelona Property Explorer</h1>
            <p className="text-xs leading-tight text-muted-foreground">City center · Coast · Hillside</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            data-testid="button-toggle-theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
          <Button
            variant={view === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            onClick={() => setView('cards')}
            data-testid="button-view-cards"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Cards</span>
          </Button>
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            onClick={() => setView('table')}
            data-testid="button-view-table"
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Compare</span>
          </Button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside
          className="hidden overflow-y-auto border-r border-sidebar-border bg-sidebar px-5 py-6 lg:block"
          style={{ overscrollBehavior: 'contain' }}
        >
          <FilterPanel filters={filters} setFilters={setFilters} resultCount={properties.length} />
        </aside>

        <main className="overflow-y-auto px-4 py-5 sm:px-6 lg:py-6" style={{ overscrollBehavior: 'contain' }}>
          <div className="mb-4 lg:hidden">
            <details className="rounded-lg border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold text-card-foreground">
                Filters ({properties.length} matching)
              </summary>
              <div className="mt-4">
                <FilterPanel filters={filters} setFilters={setFilters} resultCount={properties.length} />
              </div>
            </details>
          </div>

          <div className="mb-6">
            <SummaryStats properties={properties} />
          </div>

          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-24 text-center">
              <p className="text-sm font-medium text-foreground">No listings match these filters</p>
              <p className="text-xs text-muted-foreground">Try widening the price range or commute time.</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="grid-property-cards">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          ) : (
            <ComparisonTable properties={properties} />
          )}
        </main>
      </div>
    </div>
  );
}
