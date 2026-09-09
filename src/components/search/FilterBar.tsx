import { SlidersHorizontal, LayoutGrid, List, RotateCcw, X } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import {
  setYearRange,
  setMinVotes,
  setLimit,
  resetFilters,
  setViewMode,
  toggleFiltersOpen,
} from "@/store/searchSlice"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface FilterBarProps {
  totalHits?: number
  tookMs?: number
}

export function FilterBar({ totalHits, tookMs }: FilterBarProps) {
  const dispatch = useAppDispatch()
  const { filters, viewMode, isFiltersOpen } = useAppSelector((state) => state.search)

  // Count active non-default filters
  const activeFiltersCount = [
    filters.type !== undefined,
    filters.year_from !== undefined || filters.year_to !== undefined,
    filters.min_votes !== undefined,
    filters.limit !== 24,
  ].filter(Boolean).length

  return (
    <div className="w-full">
      {/* Top Controls Row */}
      {totalHits !== undefined && (
        <div className="flex items-center justify-between gap-3 text-sm py-1.5 px-1">
          {/* Left: Metrics */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-foreground font-bold">{totalHits}</span>
              <span>{getMovieCountWord(totalHits)}</span>
              {tookMs !== undefined && (
                <span className="text-zinc-500 font-mono text-[11px]">
                  ({tookMs.toFixed(1)} мс)
                </span>
              )}
            </div>
          </div>

          {/* Right: Filter Toggle & View Switcher */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(toggleFiltersOpen())}
              className={`gap-1.5 h-8 px-2.5 sm:px-3 rounded-xl text-xs font-medium border-border/80 ${
                isFiltersOpen || activeFiltersCount > 0 ? "bg-accent text-accent-foreground border-primary/50" : ""
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Фильтры</span>
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="h-4 px-1.5 py-0 text-[10px] ml-0.5">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border/70 bg-cinema-900/80 p-0.5">
              <button
                onClick={() => dispatch(setViewMode("grid"))}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-cinema-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Сетка"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => dispatch(setViewMode("list"))}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-cinema-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Список"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Drawer for Filters */}
      {isFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            className="fixed inset-0"
            onClick={() => dispatch(toggleFiltersOpen())}
          />
          <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border/80 bg-cinema-900 p-5 sm:p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-10 h-1 bg-zinc-600 rounded-full mx-auto -mt-1 mb-2 opacity-60" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="text-base font-bold text-foreground">Параметры поиска</h3>
                {activeFiltersCount > 0 && (
                  <Badge variant="default" className="text-[10px] h-4.5 px-1.5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => dispatch(resetFilters())}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-cinema-850"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Сбросить</span>
                  </button>
                )}
                <button
                  onClick={() => dispatch(toggleFiltersOpen())}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-cinema-850 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Year Range */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Год выпуска
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="от 1900"
                    value={filters.year_from || ""}
                    onChange={(e) =>
                      dispatch(
                        setYearRange({
                          from: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          to: filters.year_to,
                        })
                      )
                    }
                    className="w-full h-10 px-3 rounded-xl border border-border/80 bg-cinema-950 text-sm text-foreground focus:outline-none focus:border-primary/70"
                  />
                  <span className="text-muted-foreground text-xs">—</span>
                  <input
                    type="number"
                    placeholder="до 2026"
                    value={filters.year_to || ""}
                    onChange={(e) =>
                      dispatch(
                        setYearRange({
                          from: filters.year_from,
                          to: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      )
                    }
                    className="w-full h-10 px-3 rounded-xl border border-border/80 bg-cinema-950 text-sm text-foreground focus:outline-none focus:border-primary/70"
                  />
                </div>
              </div>

              {/* Min Votes */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Количество голосов IMDb
                </label>
                <select
                  value={filters.min_votes?.toString() || ""}
                  onChange={(e) =>
                    dispatch(
                      setMinVotes(
                        e.target.value ? parseInt(e.target.value, 10) : undefined
                      )
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl border border-border/80 bg-cinema-950 text-sm text-foreground focus:outline-none focus:border-primary/70"
                >
                  <option value="">Любое количество</option>
                  <option value="1000">от 1 000</option>
                  <option value="10000">от 10 000</option>
                  <option value="50000">от 50 000</option>
                  <option value="100000">от 100 000 (Хиты)</option>
                  <option value="500000">от 500 000 (Культовые)</option>
                </select>
              </div>

              {/* Limit */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Показывать результатов
                </label>
                <select
                  value={filters.limit || 24}
                  onChange={(e) => dispatch(setLimit(parseInt(e.target.value, 10)))}
                  className="w-full h-10 px-3 rounded-xl border border-border/80 bg-cinema-950 text-sm text-foreground focus:outline-none focus:border-primary/70"
                >
                  <option value="12">12 тайтлов</option>
                  <option value="24">24 тайтла</option>
                  <option value="48">48 тайтлов</option>
                  <option value="96">96 тайтлов</option>
                </select>
              </div>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <Button
                onClick={() => dispatch(toggleFiltersOpen())}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Применить фильтры
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getMovieCountWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19) return "найденных тайтлов"
  if (mod10 === 1) return "найденный тайтл"
  if (mod10 >= 2 && mod10 <= 4) return "найденных тайтла"
  return "найденных тайтлов"
}
