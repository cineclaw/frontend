import { Star, Clock, Users, Play, Loader2 } from "lucide-react"
import { motion, type Variants } from "framer-motion"
import type { SearchHit } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { MoviePoster } from "./MoviePoster"
import { useQuickPlay } from "@/hooks/useQuickPlay"
import { getTmdbImageUrl, getTmdbImageSrcSet } from "@/lib/tmdbImages"
import {
  formatRating,
  formatRuntime,
  formatVotes,
  getTypeLabel,
} from "@/lib/utils"

export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -36, // "вылет сверху"
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 24,
      stiffness: 280,
    },
  },
  exit: {
    opacity: 0,
    y: 18,
    scale: 0.95,
    transition: {
      duration: 0.16,
      ease: "easeOut",
    },
  },
}

interface MovieCardProps {
  hit: SearchHit
  viewMode?: "grid" | "list"
  priority?: boolean
  onClick: () => void
}

export function MovieCard({ hit, viewMode = "grid", priority = false, onClick }: MovieCardProps) {
  const { movie, posters } = hit
  const mainTitle = movie.title_ru || movie.title_primary || movie.title_orig
  const hasAlternateTitle = movie.title_ru && movie.title_orig && movie.title_ru !== movie.title_orig
  const runtimeFormatted = formatRuntime(movie.runtime_minutes)

  const { quickPlay, isQuickPlaying } = useQuickPlay()
  const isSeries = movie.title_type === "tvSeries" || movie.title_type === "tvMiniSeries"
  const isTargetQuickPlaying = isQuickPlaying(movie.tconst)

  const handleQuickPlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    quickPlay({
      tconst: movie.tconst,
      title: movie.title_primary || movie.title_ru || movie.title_orig || "",
      ruTitle: movie.title_ru || undefined,
      isSeries,
      year: movie.year,
    })
  }

  // Color-coded rating badge
  const ratingVal = movie.rating || 0
  const ratingColor =
    ratingVal >= 8.0
      ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
      : ratingVal >= 6.5
      ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
      : "text-zinc-400 bg-zinc-800/40 border-border/40"

  if (viewMode === "list") {
    const listPosterSrc = hit.poster_path
      ? getTmdbImageUrl(hit.poster_path, "w185")
      : posters.medium && !posters.medium.startsWith("/poster/")
      ? posters.medium
      : undefined
    const listPosterSrcSet = hit.poster_path
      ? getTmdbImageSrcSet(hit.poster_path)
      : undefined
    const listPosterSizes = "(max-width: 640px) 70px, 100px"

    return (
      <motion.div
        variants={cardVariants}
        layout="position"
        whileHover={{ scale: 1.012 }}
        whileTap={{ scale: 0.985 }}
        onClick={onClick}
        className="group flex gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-2xl border border-border/70 bg-cinema-900/80 hover:bg-cinema-850 hover:border-primary/40 active:bg-cinema-800 shadow-md hover:shadow-xl transition-colors duration-150 cursor-pointer text-left select-none"
      >
        {/* Poster thumbnail */}
        <div className="relative w-16 sm:w-24 flex-shrink-0 group/poster">
          <MoviePoster
            src={listPosterSrc}
            srcSet={listPosterSrcSet}
            sizes={listPosterSizes}
            alt={mainTitle}
            priority={priority}
            className="rounded-xl shadow-md group-hover:scale-[1.02] transition-transform"
          />

          {/* Quick Play Overlay Button */}
          <button
            type="button"
            onClick={handleQuickPlay}
            disabled={isTargetQuickPlaying}
            title={isSeries ? "Быстрый просмотр следующей серии" : "Быстрый просмотр"}
            className="absolute inset-0 m-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-500/95 hover:bg-emerald-400 text-black shadow-lg shadow-black/60 flex items-center justify-center transition-all duration-200 opacity-90 sm:opacity-0 sm:group-hover/poster:opacity-100 hover:scale-110 active:scale-95 cursor-pointer z-10"
          >
            {isTargetQuickPlaying ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-between flex-grow py-0.5 min-w-0">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              {movie.rating ? (
                <div
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md border text-[11px] sm:text-xs font-bold ${ratingColor}`}
                >
                  <Star className="h-3 w-3 fill-current" />
                  <span>{formatRating(movie.rating)}</span>
                </div>
              ) : null}

              {movie.year ? (
                <Badge variant="year" className="text-[10px] sm:text-xs px-1.5 py-0">
                  {movie.year}
                </Badge>
              ) : null}

              <Badge variant="type" className="text-[10px] sm:text-xs px-1.5 py-0">
                {getTypeLabel(movie.title_type)}
              </Badge>

              {runtimeFormatted && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {runtimeFormatted}
                </span>
              )}
            </div>

            <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
              {mainTitle}
            </h3>

            {hasAlternateTitle && (
              <p className="text-[11px] sm:text-xs text-muted-foreground italic truncate">
                {movie.title_orig}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1.5 sm:pt-2 border-t border-border/40 text-[11px] sm:text-xs text-muted-foreground">
            {/* Genres */}
            <div className="flex items-center gap-1 overflow-hidden">
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="px-1.5 py-0.5 rounded bg-cinema-800 text-[10px] sm:text-[11px] text-zinc-300 truncate"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Votes */}
            {movie.num_votes > 0 && (
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-zinc-400">
                <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />
                <span>{formatVotes(movie.num_votes)}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Default Grid Card
  const gridPosterSrc = hit.poster_path
    ? getTmdbImageUrl(hit.poster_path, "w342")
    : posters.large && !posters.large.startsWith("/poster/")
    ? posters.large
    : undefined
  const gridPosterSrcSet = hit.poster_path
    ? getTmdbImageSrcSet(hit.poster_path)
    : undefined
  const gridPosterSizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"

  return (
    <motion.div
      variants={cardVariants}
      layout="position"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-cinema-900/70 overflow-hidden hover:bg-cinema-850/90 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 transition-colors duration-200 cursor-pointer text-left select-none"
    >
      {/* Poster Container */}
      <div className="relative w-full overflow-hidden">
        <MoviePoster
          src={gridPosterSrc}
          srcSet={gridPosterSrcSet}
          sizes={gridPosterSizes}
          alt={mainTitle}
          priority={priority}
          className="group-hover:scale-105 transition-transform duration-300"
        />

        {/* Floating Rating Badge on Poster */}
        {movie.rating ? (
          <div
            className={`absolute top-2 right-2 sm:top-2.5 sm:right-2.5 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg border backdrop-blur-md shadow-lg text-[10px] sm:text-xs font-bold ${ratingColor}`}
          >
            <Star className="h-3 w-3 fill-current" />
            <span>{formatRating(movie.rating)}</span>
          </div>
        ) : null}

        {/* Floating Year Badge on Poster */}
        {movie.year ? (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg border border-border/60 bg-cinema-950/80 backdrop-blur-md text-[11px] font-semibold text-zinc-300 shadow">
            {movie.year}
          </div>
        ) : null}

        {/* Quick Play Action Button Overlay */}
        <button
          type="button"
          onClick={handleQuickPlay}
          disabled={isTargetQuickPlaying}
          title={isSeries ? "Быстрый просмотр следующей серии" : "Быстрый просмотр"}
          className="absolute bottom-2.5 right-2.5 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500/95 hover:bg-emerald-400 text-black shadow-xl shadow-black/70 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {isTargetQuickPlaying ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-black" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Card Content */}
      <div className="flex flex-col justify-between flex-grow p-3.5 space-y-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground">
            <Badge variant="type" className="text-[10px] px-1.5 py-0 h-4.5">
              {getTypeLabel(movie.title_type)}
            </Badge>

            {runtimeFormatted && (
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {runtimeFormatted}
              </span>
            )}
          </div>

          <h3
            className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug"
            title={mainTitle}
          >
            {mainTitle}
          </h3>

          {hasAlternateTitle && (
            <p
              className="text-[11px] text-muted-foreground italic truncate mt-0.5"
              title={movie.title_orig}
            >
              {movie.title_orig}
            </p>
          )}
        </div>

        {/* Card Footer: Genres & Votes */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate max-w-[120px]">
            {movie.genres.slice(0, 2).join(", ") || "—"}
          </span>

          {movie.num_votes > 0 ? (
            <span className="font-mono text-zinc-400 font-medium whitespace-nowrap">
              {formatVotes(movie.num_votes)}
            </span>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
