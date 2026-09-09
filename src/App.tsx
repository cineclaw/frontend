import { useState, useEffect } from "react"
import { useAppSelector, useAppDispatch } from "@/store/store"
import { useSearchMoviesQuery } from "@/api/moviesApi"
import { Header } from "@/components/layout/Header"
import { SearchBar } from "@/components/search/SearchBar"
import { QuickChips } from "@/components/search/QuickChips"
import { FilterBar } from "@/components/search/FilterBar"
import { MovieList } from "@/components/movie/MovieList"
import { MovieModal } from "@/components/movie/MovieModal"
import { PersonModal } from "@/components/person/PersonModal"
import { ShelfModal } from "@/components/home/ShelfModal"
import { DiagnosticModal } from "@/components/diagnostic/DiagnosticModal"
import { LoginModal } from "@/components/auth/LoginModal"
import { toggleFiltersOpen } from "@/store/searchSlice"

export default function App() {
  const dispatch = useAppDispatch()
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false)
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { debouncedQuery, filters, isFiltersOpen } = useAppSelector(
    (state) => state.search
  )

  const {
    data,
    isLoading,
    isFetching,
    isError,
  } = useSearchMoviesQuery(
    {
      q: debouncedQuery,
      type: filters.type,
      year_from: filters.year_from,
      year_to: filters.year_to,
      min_votes: filters.min_votes,
      limit: filters.limit,
    },
    {
      skip: !debouncedQuery.trim() || !isAuthenticated,
    }
  )

  // Count active non-default filters
  const activeFiltersCount = [
    filters.type !== undefined,
    filters.year_from !== undefined || filters.year_to !== undefined,
    filters.min_votes !== undefined,
    filters.limit !== 24,
  ].filter(Boolean).length

  // When new search results arrive, immediately anchor scroll down so Rank 1 is instantly in view without sweeping through off-screen cards
  useEffect(() => {
    if (debouncedQuery.trim() && data?.hits && data.hits.length > 0) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      })
    }
  }, [debouncedQuery, data?.hits])

  // Hash listener for #diagnostic
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === "#diagnostic") {
        setIsDiagnosticOpen(true)
      } else {
        setIsDiagnosticOpen(false)
      }
    }
    handleHash()
    window.addEventListener("hashchange", handleHash)
    window.addEventListener("popstate", handleHash)
    return () => {
      window.removeEventListener("hashchange", handleHash)
      window.removeEventListener("popstate", handleHash)
    }
  }, [])

  const handleOpenDiagnostic = () => {
    window.history.pushState({ modal: "diagnostic" }, "", "#diagnostic")
    setIsDiagnosticOpen(true)
  }

  const handleCloseDiagnostic = () => {
    if (window.location.hash === "#diagnostic") {
      window.history.back()
    }
    setIsDiagnosticOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary">
      {/* Top Navigation Header */}
      <Header onOpenDiagnostic={handleOpenDiagnostic} />

      {/* Main Content Area (padding bottom accounts for fixed bottom dock + safe areas) */}
      <main className="flex-1 flex flex-col pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        {/* If searching: Results Header with hits count, timing, and grid/list view switcher */}
        {debouncedQuery.trim() && (
          <div className="container mx-auto max-w-3xl px-3 sm:px-6 pt-3 pb-1">
            <FilterBar
              totalHits={data?.total_hits}
              tookMs={data?.took_ms}
            />
          </div>
        )}

        {/* Results / Empty Suggestions Section (Results stack bottom-up: Rank 1 nearest thumb) */}
        <section className="flex-1 container mx-auto max-w-3xl px-3 sm:px-6 py-2 flex flex-col justify-end">
          <MovieList
            hits={debouncedQuery.trim() ? data?.hits : undefined}
            isLoading={isLoading && !!debouncedQuery.trim()}
            isFetching={isFetching && !!debouncedQuery.trim()}
            isError={isError && !!debouncedQuery.trim()}
          />
        </section>

        {/* Mount Filter Drawer if search query is empty so filter button still opens drawer */}
        {!debouncedQuery.trim() && <FilterBar />}
      </main>

      {/* Fixed Bottom Search Dock (Ergonomic Thumb-Zone) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-cinema-950/95 backdrop-blur-2xl border-t border-border/80 px-3 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="container mx-auto max-w-3xl space-y-1.5">
          {/* Quick Category Chips */}
          <QuickChips />

          {/* Search Input Bar with integrated Filter Drawer Button */}
          <SearchBar
            isLoading={isFetching}
            onFilterClick={() => dispatch(toggleFiltersOpen())}
            activeFiltersCount={activeFiltersCount}
            isFiltersOpen={isFiltersOpen}
          />
        </div>
      </div>

      {/* Movie Details Screen (Full-Screen on Mobile, Dialog on Desktop) */}
      <MovieModal />

      {/* Person Details Screen (Full-Screen on Mobile, Dialog on Desktop) */}
      <PersonModal />

      {/* Shelf Full View Screen (Full-Screen on Mobile, Dialog on Desktop) */}
      <ShelfModal />

      {/* Diagnostic & System Versions Screen */}
      <DiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={handleCloseDiagnostic}
      />

      {/* Authentication Login Screen */}
      <LoginModal isOpen={!isAuthenticated} />
    </div>
  )
}

