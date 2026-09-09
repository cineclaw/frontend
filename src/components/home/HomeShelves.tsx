import { useState } from "react"
import {
  Flame,
  Film,
  Tv,
  Sparkles,
  Star,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react"
import { useAppDispatch } from "@/store/store"
import { setSelectedMovie, setSelectedShelfId } from "@/store/searchSlice"
import {
  useGetHomeFeedsQuery,
  useLazyResolveTmdbMovieQuery,
} from "@/api/moviesApi"
import { formatRating } from "@/lib/utils"
import type { FeedShelf, FeedItem, MovieDoc } from "@/api/types"

const SHELF_ICONS: Record<string, React.ElementType> = {
  flame: Flame,
  film: Film,
  tv: Tv,
  star: Sparkles,
}

export function HomeShelves() {
  const dispatch = useAppDispatch()
  const { data: shelves, isLoading, isError } = useGetHomeFeedsQuery()
  const [triggerResolve] = useLazyResolveTmdbMovieQuery()
  const [resolvingId, setResolvingId] = useState<number | null>(null)

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

  // Loading skeleton shelves
  if (isLoading) {
    return (
      <div className="space-y-6 pt-2 pb-6 w-full max-w-3xl mx-auto text-left">
        {[1, 2].map((n) => (
          <div key={n} className="space-y-2.5">
            <div className="h-5 w-44 bg-cinema-850 rounded-md animate-pulse" />
            <div className="flex gap-3 overflow-hidden -mx-3 px-3 sm:-mx-6 sm:px-6">
              {[1, 2, 3, 4, 5].map((card) => (
                <div
                  key={card}
                  className="w-32 sm:w-40 aspect-[2/3] rounded-xl bg-cinema-850/80 animate-pulse shrink-0"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (isError || !shelves || shelves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-border/60 bg-cinema-900/40 my-8 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <h3 className="text-sm font-bold text-foreground">
          Не удалось загрузить списки TMDB
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Попробуйте использовать поиск по названию в строке ниже.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-1 pb-4 w-full max-w-3xl mx-auto text-left">
      {/* Horizontal Shelves */}
      {shelves.map((shelf: FeedShelf) => {
        const IconComponent = SHELF_ICONS[shelf.icon] || Film

        return (
          <section key={shelf.id} className="space-y-2.5">
            {/* Shelf Title Header */}
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-cinema-850 border border-border/70 text-primary">
                  <IconComponent className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                  {shelf.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => dispatch(setSelectedShelfId(shelf.id))}
                className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-1.5 rounded-md hover:bg-primary/10 active:scale-95 cursor-pointer select-none group/btn"
              >
                <span>Ещё</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Horizontal Swipeable Carousel */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain pb-2 -mx-3 px-3 sm:-mx-6 sm:px-6">
              {shelf.items.map((item) => {
                const isResolving = resolvingId === item.id
                const posterUrl = item.poster_path
                  ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
                  : null

                return (
                  <button
                    key={`${shelf.id}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectMovie(item)}
                    disabled={isResolving}
                    className="group w-32 sm:w-40 flex-shrink-0 flex flex-col text-left cursor-pointer active:scale-97 transition-all duration-200 select-none disabled:opacity-60 disabled:cursor-not-allowed"
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
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1 p-2 text-center bg-cinema-800">
                          <Film className="h-8 w-8 opacity-40" />
                          <span className="text-[10px] leading-tight text-zinc-500 line-clamp-2">
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
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-1 text-primary">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-[9px] font-medium text-white">
                            Открытие...
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Movie Info */}
                    <div className="pt-1.5 px-0.5 space-y-0.5">
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                        {item.title || item.original_title}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
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
          </section>
        )
      })}
    </div>
  )
}
