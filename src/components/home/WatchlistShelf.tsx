import React, { useState } from "react"
import { Bookmark, X, Star, Film, Tv } from "lucide-react"
import { useAppDispatch } from "@/store/store"
import { setSelectedMovie } from "@/store/searchSlice"
import { useGetWatchlistQuery, useRemoveFromWatchlistMutation, type WatchlistItem } from "@/api/torrentsApi"
import { formatRating } from "@/lib/utils"
import { getTmdbImageUrl } from "@/lib/tmdbImages"
import type { MovieDoc } from "@/api/types"

interface WatchlistCardProps {
  item: WatchlistItem
  onSelect: (item: WatchlistItem) => void
  onRemove: (imdbId: string) => void
}

const WatchlistCard: React.FC<WatchlistCardProps> = ({ item, onSelect, onRemove }) => {
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const posterUrl = getTmdbImageUrl(item.poster_path, "w500") || ""

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleting(true)
    onRemove(item.imdb_id)
  }

  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(item)
        }
      }}
      className="group relative w-36 sm:w-44 shrink-0 rounded-xl border border-border/70 bg-cinema-900 overflow-hidden cursor-pointer shadow-lg hover:border-amber-500/50 hover:shadow-amber-950/30 transition-all duration-200 active:scale-[0.98] snap-start flex flex-col"
    >
      {/* Poster Container with 2:3 Aspect Ratio */}
      <div className="relative aspect-[2/3] w-full bg-cinema-950 overflow-hidden">
        {posterUrl && !imageError ? (
          <img
            src={posterUrl}
            alt=""
            role="presentation"
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 p-2 text-center">
            {item.media_type === "tv" ? <Tv className="w-8 h-8 mb-1" /> : <Film className="w-8 h-8 mb-1" />}
            <span className="text-[10px] line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-950 via-transparent to-black/30 pointer-events-none" />

        {/* Remove Button (top right) */}
        <button
          type="button"
          onClick={handleRemove}
          disabled={isDeleting}
          title="Удалить из списка"
          aria-label="Удалить из списка"
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-colors shadow-md z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Rating Badge (top left) */}
        {item.rating !== undefined && item.rating > 0 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-amber-400 text-[11px] font-medium shadow-md">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{formatRating(item.rating)}</span>
          </div>
        )}

        {/* Media Type Pill (bottom left) */}
        <div className="absolute bottom-2 left-2">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10">
            {item.media_type === "tv" ? "Сериал" : "Фильм"}
          </span>
        </div>
      </div>

      {/* Card Info Footer */}
      <div className="p-2.5 flex flex-col gap-0.5 flex-grow justify-between">
        <h4 className="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors line-clamp-1 leading-snug">
          {item.title}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>{item.year || ""}</span>
          {item.original_title && item.original_title !== item.title && (
            <span className="truncate max-w-[80px] text-zinc-400 opacity-60">
              {item.original_title}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const WatchlistShelf: React.FC = () => {
  const dispatch = useAppDispatch()
  const { data: items, isLoading } = useGetWatchlistQuery(undefined, {
    pollingInterval: 15000,
  })
  const [removeFromWatchlist] = useRemoveFromWatchlistMutation()

  if (isLoading || !items || items.length === 0) {
    return null
  }

  const handleSelect = (item: WatchlistItem) => {
    const doc: MovieDoc = {
      tconst: item.imdb_id,
      title_ru: item.title,
      title_orig: item.original_title || item.title,
      title_primary: item.title,
      russian_titles: [item.title],
      year: item.year || null,
      title_type: item.media_type === "tv" ? "tvSeries" : "movie",
      rating: item.rating || null,
      num_votes: 0,
      genres: [],
    }
    dispatch(setSelectedMovie(doc))
  }

  const handleRemove = async (imdbId: string) => {
    try {
      await removeFromWatchlist(imdbId).unwrap()
    } catch (err) {
      console.error("Failed to remove from watchlist:", err)
    }
  }

  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-cinema-850 border border-border/70 text-amber-400">
            <Bookmark className="h-4 w-4 fill-amber-400/20" />
          </div>
          <h3 className="text-base font-medium text-foreground tracking-tight flex items-center gap-2">
            Буду смотреть
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-normal">
              {items.length}
            </span>
          </h3>
        </div>
      </div>

      {/* Carousel (Edge-to-Edge) */}
      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-2 pt-0.5 pl-4 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6 snap-x snap-mandatory">
        {items.map((item) => (
          <WatchlistCard
            key={item.imdb_id}
            item={item}
            onSelect={handleSelect}
            onRemove={handleRemove}
          />
        ))}
        {/* Trailing spacer for comfortable right padding when scrolled to end */}
        <div className="shrink-0 w-4 sm:w-6 pointer-events-none" aria-hidden="true" />
      </div>
    </section>
  )
}
