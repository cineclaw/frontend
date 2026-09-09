import { Star, Clock, Users } from "lucide-react"
import { motion, type Variants } from "framer-motion"
import type { SearchHit } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { MoviePoster } from "./MoviePoster"
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

  // Color-coded rating badge
  const ratingVal = movie.rating || 0
  const ratingColor =
    ratingVal >= 8.0
      ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
      : ratingVal >= 6.5
      ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
      : "text-zinc-400 bg-zinc-800/40 border-border/40"

  if (viewMode === "list") {
    const listPosterSrc = posters.medium || posters.large || `/poster/${movie.tconst}?size=w185&v=2`
    const listPosterSrcSet = [
      `${posters.small || `/poster/${movie.tconst}?size=w154&v=2`} 154w`,
      `${posters.medium || `/poster/${movie.tconst}?size=w185&v=2`} 185w`,
      `${posters.large || `/poster/${movie.tconst}?size=w342&v=2`} 342w`,
    ].join(", ")
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
        <div className="w-16 sm:w-24 flex-shrink-0">
          <MoviePoster
            src={listPosterSrc}
            srcSet={listPosterSrcSet}
            sizes={listPosterSizes}
            alt={mainTitle}
            priority={priority}
            className="rounded-xl shadow-md group-hover:scale-[1.02] transition-transform"
          />
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
  const gridPosterSrc = posters.large || `/poster/${movie.tconst}?size=w342&v=2`
  const gridPosterSrcSet = [
    `${posters.medium || `/poster/${movie.tconst}?size=w185&v=2`} 185w`,
    `${posters.large || `/poster/${movie.tconst}?size=w342&v=2`} 342w`,
    `/poster/${movie.tconst}?size=w500&v=2 500w`,
  ].join(", ")
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
