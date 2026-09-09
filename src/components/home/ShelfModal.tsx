import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  ArrowLeft,
  X,
  Star,
  Film,
  Flame,
  Tv,
  Sparkles,
  Zap,
  SlidersHorizontal,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedShelfId, setSelectedMovie, setSelectedMediaType } from "@/store/searchSlice"
import {
  useGetHomeFeedsQuery,
  useLazyGetShelfPageQuery,
  useLazyDiscoverCatalogQuery,
  useLazyResolveTmdbMovieQuery,
} from "@/api/moviesApi"
import { useLazyGetTrackerHotlistQuery } from "@/api/torrentsApi"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatRating } from "@/lib/utils"
import { CatalogFilterBar, type FilterState } from "@/components/catalog/CatalogFilterBar"
import type { FeedItem, MovieDoc } from "@/api/types"

const SHELF_ICONS: Record<string, React.ElementType> = {
  flame: Flame,
  film: Film,
  tv: Tv,
  star: Sparkles,
  zap: Zap,
  sliders: SlidersHorizontal,
}

const DEFAULT_TITLES: Record<string, { title: string; icon: string }> = {
  tracker_hotlist: { title: "Популярно на трекерах", icon: "zap" },
  apple_tv: { title: "Apple TV+ Originals", icon: "star" },
  hbo_max: { title: "HBO / Max Originals", icon: "tv" },
  netflix: { title: "Netflix Хиты", icon: "film" },
  amazon_prime: { title: "Amazon Prime Video", icon: "film" },
  trending: { title: "В тренде на этой неделе", icon: "flame" },
  digital: { title: "Свежие цифровые релизы", icon: "film" },
  popular_series: { title: "Популярные сериалы", icon: "tv" },
  top_rated: { title: "Шедевры всех времён", icon: "star" },
  catalog_filter: { title: "Умный каталог & Фильтр", icon: "sliders" },
}

export function ShelfModal() {
  const dispatch = useAppDispatch()
  const selectedShelfId = useAppSelector((state) => state.search.selectedShelfId)
  const selectedMediaType = useAppSelector((state) => state.search.selectedMediaType)
  const isMobile = useIsMobile()

  // API hooks
  const { data: homeShelves } = useGetHomeFeedsQuery()
  const [triggerGetPage, { isFetching: isFetchingShelf }] = useLazyGetShelfPageQuery()
  const [triggerGetHotlist, { isFetching: isFetchingHotlist }] = useLazyGetTrackerHotlistQuery()
  const [triggerDiscover, { isFetching: isFetchingDiscover }] = useLazyDiscoverCatalogQuery()
  const [triggerResolve] = useLazyResolveTmdbMovieQuery()

  const isFetching = isFetchingShelf || isFetchingHotlist || isFetchingDiscover

  const [page, setPage] = useState<number>(1)
  const [items, setItems] = useState<FeedItem[]>([])
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalResults, setTotalResults] = useState<number | null>(null)
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterState>({})

  // Current shelf metadata (title, icon)
  const shelfMeta = useMemo(() => {
    if (!selectedShelfId) return null
    if (DEFAULT_TITLES[selectedShelfId]) {
      return DEFAULT_TITLES[selectedShelfId]
    }
    const found = homeShelves?.find((s) => s.id === selectedShelfId)
    if (found) {
      return { title: found.title, icon: found.icon }
    }
    return { title: "Список фильмов", icon: "film" }
  }, [selectedShelfId, homeShelves])

  // Unified fetcher for any shelf type
  const fetchItems = useCallback(
    async (shelfId: string, mediaType: "movie" | "tv", targetPage: number, currentFilters: FilterState) => {
      if (shelfId === "tracker_hotlist") {
        const res = await triggerGetHotlist({ type: mediaType, page: targetPage }).unwrap()
        return res
      }
      if (shelfId === "catalog_filter") {
        const res = await triggerDiscover({
          type: mediaType,
          page: targetPage,
          countries: currentFilters.country,
          genres: currentFilters.genre,
          year_from: currentFilters.yearRange?.from,
          year_to: currentFilters.yearRange?.to,
          min_rating: currentFilters.minRating,
        }).unwrap()
        return res
      }
      // Standard shelf from TMDB
      const res = await triggerGetPage({
        shelfId,
        type: mediaType,
        page: targetPage,
      }).unwrap()
      return res
    },
    [triggerGetHotlist, triggerDiscover, triggerGetPage]
  )

  // Reset & load initial items when shelf opens or mediaType/filters change
  useEffect(() => {
    if (!selectedShelfId) {
      setPage(1)
      setItems([])
      setTotalPages(1)
      setTotalResults(null)
      return
    }

    setPage(1)

    fetchItems(selectedShelfId, selectedMediaType, 1, filters)
      .then((res) => {
        if (res?.items) {
          setItems(res.items)
          if (res.total_pages) setTotalPages(res.total_pages)
          if (res.total_results) setTotalResults(res.total_results)
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch shelf page 1:", err)
      })
  }, [selectedShelfId, selectedMediaType, filters, fetchItems])

  // Load next page
  const handleLoadMore = async () => {
    if (!selectedShelfId || isFetching) return
    const nextPage = page + 1
    try {
      const res = await fetchItems(selectedShelfId, selectedMediaType, nextPage, filters)
      if (res?.items && res.items.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => `${i.id}-${i.tconst || ""}`))
          const newItems = res.items.filter((i) => !existingIds.has(`${i.id}-${i.tconst || ""}`))
          return [...prev, ...newItems]
        })
        setPage(nextPage)
        if (res.total_pages) setTotalPages(res.total_pages)
        if (res.total_results) setTotalResults(res.total_results)
      }
    } catch (err) {
      console.error("Failed to load more shelf items:", err)
    }
  }

  // Browser back-gesture support via history pushState
  const isClosingRef = useRef(false)
  useEffect(() => {
    if (selectedShelfId) {
      isClosingRef.current = false
      window.history.pushState(
        { ...(window.history.state || {}), cineclawShelf: selectedShelfId },
        ""
      )

      const handlePopState = (e: PopStateEvent) => {
        if (!e.state?.cineclawShelf) {
          dispatch(setSelectedShelfId(null))
        }
      }

      window.addEventListener("popstate", handlePopState)

      return () => {
        window.removeEventListener("popstate", handlePopState)
      }
    }
  }, [selectedShelfId, dispatch])

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    dispatch(setSelectedShelfId(null))
    if (window.history.state?.cineclawShelf) {
      window.history.back()
    }
    setTimeout(() => {
      isClosingRef.current = false
    }, 300)
  }, [dispatch])

  // Drill down into Cine-Claw movie card with torrents and streaming
  const handleSelectMovie = async (item: FeedItem) => {
    // 1. If item already has a matched IMDb tconst from Tantivy matcher
    if (item.tconst) {
      const doc: MovieDoc = {
        tconst: item.tconst,
        title_ru: item.title,
        title_orig: item.original_title || item.title,
        title_primary: item.title,
        russian_titles: [item.title],
        year: item.year || null,
        title_type: item.media_type === "tv" ? "tvSeries" : "movie",
        rating: item.rating || null,
        num_votes: item.vote_count || 0,
        genres: [],
      }
      dispatch(setSelectedMovie(doc))
      return
    }

    // 2. Otherwise resolve via TMDB
    try {
      setResolvingId(item.id)
      const res = await triggerResolve({
        mediaType: item.media_type,
        tmdbId: item.id,
      }).unwrap()

      if (res) {
        dispatch(setSelectedMovie(res))
      }
    } catch (err) {
      console.warn("Failed to resolve TMDB movie, falling back to local doc:", err)
      const fallbackDoc: MovieDoc = {
        tconst: `tmdb-${item.id}`,
        title_ru: item.title,
        title_orig: item.original_title || item.title,
        title_primary: item.title,
        russian_titles: [item.title],
        year: item.year || null,
        title_type: item.media_type === "tv" ? "tvSeries" : "movie",
        rating: item.rating || null,
        num_votes: item.vote_count || 0,
        genres: [],
      }
      dispatch(setSelectedMovie(fallbackDoc))
    } finally {
      setResolvingId(null)
    }
  }

  const IconComponent = (shelfMeta?.icon && SHELF_ICONS[shelfMeta.icon]) || Film

  // Render Inner Content
  const renderContent = () => (
    <div className="space-y-4">
      {/* Shelf Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cinema-850 border border-border/70 text-primary shadow-sm">
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>{shelfMeta?.title || "Список фильмов"}</span>
            </h1>
            {totalResults !== null && (
              <span className="text-xs text-muted-foreground">
                {totalResults.toLocaleString("ru-RU")} наименований
              </span>
            )}
          </div>
        </div>

        {/* Media type toggle [Фильмы | Сериалы] */}
        <div className="flex items-center gap-1 p-0.5 bg-cinema-850/80 border border-white/5 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => dispatch(setSelectedMediaType("movie"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedMediaType === "movie"
                ? "bg-red-600/90 text-white font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎬 Фильмы
          </button>
          <button
            type="button"
            onClick={() => dispatch(setSelectedMediaType("tv"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedMediaType === "tv"
                ? "bg-purple-600/90 text-white font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📺 Сериалы
          </button>
        </div>
      </div>

      {/* Filter Bar (if catalog_filter shelf is active) */}
      {selectedShelfId === "catalog_filter" && (
        <CatalogFilterBar
          mediaType={selectedMediaType}
          filters={filters}
          onChange={setFilters}
        />
      )}

      {/* Grid of Movies / Series */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {items.map((item, index) => {
          const isResolving = resolvingId === item.id
          const posterUrl = item.poster_path
            ? item.poster_path.startsWith("/poster/")
              ? item.poster_path
              : `https://image.tmdb.org/t/p/w342${item.poster_path}`
            : null

          return (
            <button
              key={`${item.id}-${item.tconst || index}`}
              type="button"
              onClick={() => handleSelectMovie(item)}
              disabled={isResolving}
              className="group flex flex-col text-left cursor-pointer active:scale-97 transition-all duration-200 select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* Poster Thumbnail */}
              <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-cinema-850 border border-border/80 group-hover:border-primary/60 group-hover:shadow-lg transition-all">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover object-center group-hover:scale-104 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-muted-foreground/60 bg-cinema-900">
                    <Film className="h-8 w-8 mb-1 stroke-1" />
                    <span className="text-[11px] line-clamp-2 leading-tight">
                      {item.title}
                    </span>
                  </div>
                )}

                {/* Rating Badge */}
                {item.rating !== undefined && item.rating !== null && item.rating > 0 && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/20 shadow">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span>{formatRating(item.rating)}</span>
                  </div>
                )}

                {/* Seeds Badge for Tracker Hotlist */}
                {item.seeds !== undefined && item.seeds > 0 && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-950/90 backdrop-blur-sm text-[9px] font-bold text-emerald-400 border border-emerald-500/40 shadow">
                    <Zap className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
                    <span>{item.seeds} сидов</span>
                  </div>
                )}

                {/* Media type badge if not seeds */}
                {(!item.seeds || item.seeds <= 0) && item.media_type === "tv" && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-sky-950/85 backdrop-blur-sm text-[9px] font-semibold text-sky-400 border border-sky-500/30">
                    Сериал
                  </div>
                )}

                {/* Resolving Spinner */}
                {isResolving && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-1 text-primary z-10">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-[9px] font-medium text-white">
                      Открытие...
                    </span>
                  </div>
                )}
              </div>

              {/* Movie Info */}
              <div className="pt-2 px-0.5 space-y-0.5">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                  {item.title || item.original_title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>{item.year || "—"}</span>
                  {item.quality ? (
                    <span className="text-[10px] text-emerald-400/90 truncate max-w-[90px]">
                      {item.quality}
                    </span>
                  ) : item.vote_count > 0 ? (
                    <span className="text-zinc-500">
                      {item.vote_count >= 1000
                        ? `${(item.vote_count / 1000).toFixed(1)}k`
                        : item.vote_count}{" "}
                      оц.
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Pagination / Load More Footer */}
      <div className="pt-2 pb-6 flex flex-col items-center justify-center gap-2">
        {page < totalPages ? (
          <Button
            variant="outline"
            size="default"
            onClick={handleLoadMore}
            disabled={isFetching}
            className="w-full max-w-xs h-10 rounded-xl bg-cinema-850 hover:bg-cinema-800 border-border/80 hover:border-primary/50 text-foreground font-medium text-xs sm:text-sm shadow-sm active:scale-98 transition-all cursor-pointer"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" />
                <span>Загрузка следующей страницы...</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1 text-primary" />
                <span>Загрузить ещё (+20)</span>
              </>
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground font-medium">
            Вы посмотрели все релизы в этой категории
          </p>
        )}
      </div>
    </div>
  )

  // Mobile: dedicated full-screen screen view with sticky header and fluid transitions
  if (isMobile) {
    return (
      <AnimatePresence>
        {selectedShelfId !== null && (
          <motion.div
            key="shelf-screen-mobile"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-cinema-950 flex flex-col overscroll-none"
          >
            {/* Sticky Top Header Bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2.5 bg-cinema-950/95 backdrop-blur-xl border-b border-border/80 shadow-md pt-[max(0.6rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 active:scale-95 transition-all p-1 -ml-1 cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Назад</span>
              </button>

              <h2 className="text-sm font-bold text-foreground truncate max-w-[200px] text-center">
                {shelfMeta?.title || "Список фильмов"}
              </h2>

              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Single Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
              {renderContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Desktop: Dialog Modal
  return (
    <Dialog
      open={selectedShelfId !== null}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto bg-cinema-900 border-cinema-800 text-foreground p-5 sm:p-6 custom-scrollbar">
        <DialogTitle className="sr-only">
          {shelfMeta?.title || "Список фильмов"}
        </DialogTitle>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
