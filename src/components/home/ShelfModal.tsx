import { useState, useEffect, useMemo, useRef } from "react"
import {
  ArrowLeft,
  X,
  Star,
  Film,
  Flame,
  Tv,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedShelfId, setSelectedMovie } from "@/store/searchSlice"
import {
  useGetHomeFeedsQuery,
  useLazyGetShelfPageQuery,
  useLazyResolveTmdbMovieQuery,
} from "@/api/moviesApi"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatRating } from "@/lib/utils"
import type { FeedItem, MovieDoc } from "@/api/types"

const SHELF_ICONS: Record<string, React.ElementType> = {
  flame: Flame,
  film: Film,
  tv: Tv,
  star: Sparkles,
}

const DEFAULT_TITLES: Record<string, { title: string; icon: string }> = {
  trending: { title: "В тренде на этой неделе", icon: "flame" },
  digital: { title: "Свежие цифровые релизы", icon: "film" },
  popular_series: { title: "Популярные сериалы", icon: "tv" },
  top_rated: { title: "Шедевры всех времён", icon: "star" },
}

export function ShelfModal() {
  const dispatch = useAppDispatch()
  const selectedShelfId = useAppSelector((state) => state.search.selectedShelfId)
  const isMobile = useIsMobile()

  // Pre-loaded home feeds for instantaneous page 1 display
  const { data: homeShelves } = useGetHomeFeedsQuery()
  const [triggerGetPage, { isFetching }] = useLazyGetShelfPageQuery()
  const [triggerResolve] = useLazyResolveTmdbMovieQuery()

  const [page, setPage] = useState<number>(1)
  const [items, setItems] = useState<FeedItem[]>([])
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalResults, setTotalResults] = useState<number | null>(null)
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  // Current shelf metadata (title, icon)
  const shelfMeta = useMemo(() => {
    if (!selectedShelfId) return null
    const found = homeShelves?.find((s) => s.id === selectedShelfId)
    if (found) {
      return { title: found.title, icon: found.icon }
    }
    return DEFAULT_TITLES[selectedShelfId] || { title: "Список фильмов", icon: "film" }
  }, [selectedShelfId, homeShelves])

  // Reset & load initial items when shelf opens
  useEffect(() => {
    if (!selectedShelfId) {
      setPage(1)
      setItems([])
      setTotalPages(1)
      setTotalResults(null)
      return
    }

    setPage(1)

    // Check if we already have page 1 in homeShelves
    const initialShelf = homeShelves?.find((s) => s.id === selectedShelfId)
    if (initialShelf && initialShelf.items.length > 0) {
      setItems(initialShelf.items)
      if (initialShelf.total_pages) setTotalPages(initialShelf.total_pages)
      if (initialShelf.total_results) setTotalResults(initialShelf.total_results)
    }

    // Always fetch fresh page 1 to ensure full pagination metadata
    triggerGetPage({ shelfId: selectedShelfId, page: 1 })
      .unwrap()
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
  }, [selectedShelfId, homeShelves, triggerGetPage])

  // Load next page
  const handleLoadMore = async () => {
    if (!selectedShelfId || isFetching) return
    const nextPage = page + 1
    try {
      const res = await triggerGetPage({ shelfId: selectedShelfId, page: nextPage }).unwrap()
      if (res?.items && res.items.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id))
          const newItems = res.items.filter((i) => !existingIds.has(i.id))
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
  const hasPushedHistory = useRef(false)
  useEffect(() => {
    if (selectedShelfId) {
      window.history.pushState(
        { ...(window.history.state || {}), cineclawShelf: selectedShelfId },
        ""
      )
      hasPushedHistory.current = true

      const handlePopState = (e: PopStateEvent) => {
        if (!e.state?.cineclawShelf) {
          hasPushedHistory.current = false
          dispatch(setSelectedShelfId(null))
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleClose()
        }
      }

      window.addEventListener("popstate", handlePopState)
      window.addEventListener("keydown", handleKeyDown)

      return () => {
        window.removeEventListener("popstate", handlePopState)
        window.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [selectedShelfId, dispatch])

  const handleClose = () => {
    if (window.history.state?.cineclawShelf) {
      window.history.back()
    } else {
      dispatch(setSelectedShelfId(null))
    }
  }

  // Drill down into Cine-Claw movie card with torrents and streaming
  const handleSelectMovie = async (item: FeedItem) => {
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

  const IconComponent = shelfMeta ? SHELF_ICONS[shelfMeta.icon] || Film : Film

  // Main grid and controls content
  const renderContent = () => (
    <div className="space-y-6">
      {/* Header section (desktop dialog header or mobile inner title) */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cinema-850 border border-border/80 text-primary shrink-0 shadow-xs">
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {shelfMeta?.title || "Список фильмов"}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>Показано: {items.length}</span>
              {totalResults && (
                <>
                  <span>•</span>
                  <span>Всего в каталоге: {totalResults.toLocaleString("ru-RU")}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5 text-zinc-300">
          Стр. {page}
        </Badge>
      </div>

      {/* Movie Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {items.map((item) => {
          const isResolving = resolvingId === item.id
          const posterUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
            : null

          return (
            <button
              key={`shelf-item-${item.id}`}
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
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1.5 p-2 text-center bg-cinema-800">
                    <Film className="h-9 w-9 opacity-40" />
                    <span className="text-[11px] leading-tight text-zinc-500 line-clamp-2">
                      {item.title}
                    </span>
                  </div>
                )}

                {/* Top rating badge */}
                {item.rating !== undefined && item.rating !== null && item.rating > 0 && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/20 shadow">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span>{formatRating(item.rating)}</span>
                  </div>
                )}

                {/* Media type badge (TV Series) */}
                {item.media_type === "tv" && (
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
                  {item.vote_count > 0 && (
                    <span className="text-zinc-500">
                      {item.vote_count >= 1000
                        ? `${(item.vote_count / 1000).toFixed(1)}k`
                        : item.vote_count}{" "}
                      оц.
                    </span>
                  )}
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
            Вы посмотрели все фильмы в этой категории
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
