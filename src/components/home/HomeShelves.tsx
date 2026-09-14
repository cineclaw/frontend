import { useState } from "react"
import {
  Flame,
  Film,
  Tv,
  Star,
  Loader2,
  ChevronRight,
  Play,
} from "lucide-react"
import { useQuickPlay } from "@/hooks/useQuickPlay"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedMovie, setSelectedShelfId } from "@/store/searchSlice"
import {
  useGetHomeFeedsQuery,
  useLazyResolveTmdbMovieQuery,
  useLazySearchMoviesQuery,
} from "@/api/moviesApi"
import { formatRating } from "@/lib/utils"
import { CatalogTilesGrid } from "./CatalogTilesGrid"
import { ContinueWatchingShelf } from "./ContinueWatchingShelf"
import { WatchlistShelf } from "./WatchlistShelf"
import { getTmdbImageUrl } from "@/lib/tmdbImages"
import type { FeedItem, MovieDoc } from "@/api/types"

export function HomeShelves() {
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const selectedMediaType = useAppSelector((state) => state.search.selectedMediaType)

  // Fetch only lightweight home feeds
  const { data: shelves } = useGetHomeFeedsQuery(undefined, {
    skip: !isAuthenticated,
  })
  const [triggerResolve] = useLazyResolveTmdbMovieQuery()
  const [triggerSearch] = useLazySearchMoviesQuery()
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const { quickPlay, isQuickPlaying } = useQuickPlay()

  const handleSelectMovie = async (item: FeedItem) => {
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

    const isTrackerItem = Boolean(item.tracker || item.seeds !== undefined)
    setResolvingId(item.id)

    try {
      // 1. First try Tantivy title search
      const searchQuery = item.original_title || item.title
      if (searchQuery) {
        try {
          const searchRes = await triggerSearch({
            q: searchQuery,
            type: item.media_type === "tv" ? "tvSeries" : "movie",
          }).unwrap()
          if (searchRes?.hits && searchRes.hits.length > 0) {
            dispatch(setSelectedMovie(searchRes.hits[0].movie))
            return
          }
        } catch {
          // ignore and proceed to fallback
        }
      }

      // 2. Only resolve via TMDB if item is from a real TMDB shelf (not tracker synthetic index)
      if (!isTrackerItem && item.id) {
        const res = await triggerResolve({
          mediaType: item.media_type,
          tmdbId: item.id,
        }).unwrap()

        if (res) {
          dispatch(setSelectedMovie(res))
          return
        }
      }
    } catch (err) {
      console.warn("Failed to resolve movie, falling back to local doc:", err)
    } finally {
      setResolvingId(null)
    }

    const fallbackDoc: MovieDoc = {
      tconst: isTrackerItem ? `search-${encodeURIComponent(item.original_title || item.title)}` : `tmdb-${item.id}`,
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
  }

  // Find a matching featured shelf to display as a preview strip
  const featuredShelf = shelves?.find((s) =>
    selectedMediaType === "tv"
      ? s.id === "apple_tv" || s.id === "popular_series"
      : s.id === "trending"
  ) || shelves?.[0]

  return (
    <div className="space-y-7 pt-1 pb-8 w-full text-left">
      {/* Continue Watching Shelf (TorrServer SQLite Resume Integration) */}
      <ContinueWatchingShelf />

      {/* Watchlist Shelf ("Буду смотреть") */}
      <WatchlistShelf />

      {/* Featured Preview Shelf (Single Strip) */}
      {featuredShelf && featuredShelf.items && featuredShelf.items.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-cinema-850 border border-border/70 text-primary">
                {selectedMediaType === "tv" ? (
                  <Tv className="h-4 w-4" />
                ) : (
                  <Flame className="h-4 w-4" />
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                {selectedMediaType === "tv" ? "Популярные премьеры сериалов" : "В тренде прямо сейчас"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dispatch(setSelectedShelfId(featuredShelf.id))}
              className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-1.5 rounded-md hover:bg-primary/10 active:scale-95 cursor-pointer select-none group/btn"
            >
              <span>Все</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Horizontal Swipeable Preview Strip (Edge-to-Edge) */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain pb-2 pl-4 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6 snap-x snap-mandatory">
            {featuredShelf.items.slice(0, 10).map((item) => {
              const isResolving = resolvingId === item.id
              const posterUrl = getTmdbImageUrl(item.poster_path, "w342") || null

              return (
                <div
                  key={`${featuredShelf.id}-${item.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => !isResolving && handleSelectMovie(item)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isResolving) {
                      e.preventDefault()
                      handleSelectMovie(item)
                    }
                  }}
                  className={`group w-28 sm:w-36 flex-shrink-0 flex flex-col text-left cursor-pointer active:scale-97 transition-all duration-200 select-none ${
                    isResolving ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-cinema-850 border border-border/80 group-hover:border-primary/60 group-hover:shadow-lg transition-all">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover object-center group-hover:scale-104 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-muted-foreground/60 bg-cinema-900">
                        <Film className="h-6 w-6 mb-1 stroke-1" />
                        <span className="text-[10px] line-clamp-2 leading-tight">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {item.rating !== undefined && item.rating !== null && item.rating > 0 && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/20 shadow">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span>{formatRating(item.rating)}</span>
                      </div>
                    )}

                    {isResolving && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-1 text-primary z-10">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-[9px] font-medium text-white">
                          Открытие...
                        </span>
                      </div>
                    )}

                    {/* Quick Play Overlay Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        quickPlay({
                          tconst: item.tconst,
                          tmdbId: item.tracker || item.seeds !== undefined ? undefined : item.id,
                          title: item.title || item.original_title || "",
                          ruTitle: item.title,
                          isSeries: item.media_type === "tv",
                          year: item.year,
                        })
                      }}
                      disabled={isQuickPlaying(item.tconst || item.id)}
                      title={item.media_type === "tv" ? "Быстрый просмотр следующей серии" : "Быстрый просмотр"}
                      className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-emerald-500/95 hover:bg-emerald-400 text-black shadow-lg shadow-black/70 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      {isQuickPlaying(item.tconst || item.id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="pt-1.5 px-0.5 space-y-0.5">
                    <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                      {item.title || item.original_title}
                    </h3>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>{item.year || "—"}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Trailing spacer for comfortable right padding when scrolled to end */}
            <div className="shrink-0 w-4 sm:w-6 pointer-events-none" aria-hidden="true" />
          </div>
        </section>
      )}

      {/* Catalog Hub Launcher Tiles */}
      <section className="space-y-3">
        <div className="px-4 sm:px-6 flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            Каталоги и коллекции
          </h2>
          <span className="text-xs text-muted-foreground/70">
            Выберите категорию для открытия
          </span>
        </div>
        <CatalogTilesGrid />
      </section>
    </div>
  )
}
