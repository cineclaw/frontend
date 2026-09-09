import { Search, AlertCircle } from "lucide-react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import type { SearchHit } from "@/api/types"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedMovie } from "@/store/searchSlice"
import { MovieCard } from "./MovieCard"
import { Skeleton } from "@/components/ui/skeleton"
import { HomeShelves } from "@/components/home/HomeShelves"

interface MovieListProps {
  hits?: SearchHit[]
  isLoading: boolean
  isFetching: boolean
  isError: boolean
}

const resultsContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: "easeOut",
    },
  },
}

const emptyStateVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -15,
    transition: { duration: 0.18, ease: "easeIn" },
  },
}

export function MovieList({ hits, isLoading, isFetching, isError }: MovieListProps) {
  const dispatch = useAppDispatch()
  const { debouncedQuery, filters, viewMode } = useAppSelector((state) => state.search)

  // 1. Error State
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-destructive/30 bg-destructive/5 my-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-3" />
        <h3 className="text-lg font-bold text-foreground">Ошибка связи с сервером</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Не удалось получить результаты поиска. Проверьте, запущен ли бэкенд imdb-indexer на порту 8090.
        </p>
      </div>
    )
  }

  // 2. Initial Home Feed (TMDB Shelves when query is empty)
  if (!debouncedQuery.trim()) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="home-shelves"
          variants={emptyStateVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full flex flex-col justify-start"
        >
          <HomeShelves />
        </motion.div>
      </AnimatePresence>
    )
  }

  // 3. Loading Skeletons (when loading first time without previous hits)
  if (isLoading && (!hits || hits.length === 0)) {
    return (
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4"
            : "flex flex-col-reverse gap-3 max-w-3xl mx-auto"
        }
      >
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className={`rounded-2xl border border-border/40 bg-cinema-900/40 p-2.5 sm:p-3 space-y-3 ${
              viewMode === "list" ? "flex gap-3 sm:gap-4 items-center" : ""
            }`}
          >
            <Skeleton
              className={
                viewMode === "list"
                  ? "w-16 sm:w-24 aspect-[2/3] rounded-xl flex-shrink-0"
                  : "w-full aspect-[2/3] rounded-xl"
              }
            />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 4. No Results Found (checked only when query is present and request is done)
  if (debouncedQuery.trim() && hits && hits.length === 0 && !isLoading && !isFetching) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="no-results"
          variants={emptyStateVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-border/60 bg-cinema-900/40 my-8 max-w-md mx-auto"
        >
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-bold text-foreground">Ничего не найдено</h3>
          <p className="text-sm text-muted-foreground mt-1">
            По запросу <span className="text-primary font-medium">«{debouncedQuery}»</span> совпадений не найдено.
          </p>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Unique key to trigger smooth replacement animations when query or filters change
  const queryKey = `${debouncedQuery}-${viewMode}-${filters.type || ""}-${filters.year_from || ""}-${filters.year_to || ""}-${filters.min_votes || ""}`

  // 5. Results (Bottom-Up Flow: Rank 1 is closest to thumb at the bottom)
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Subtle fetching indicator */}
      {isFetching && (
        <div className="fixed top-18 right-4 z-30 px-3 py-1 rounded-full bg-cinema-900/90 border border-border text-[11px] text-primary font-mono shadow-lg backdrop-blur-md animate-pulse">
          Поиск...
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={queryKey}
          variants={resultsContainerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={
            viewMode === "grid"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4"
              : "flex flex-col-reverse justify-start gap-2.5 sm:gap-3"
          }
        >
          {hits?.map((hit, index) => (
            <MovieCard
              key={hit.movie.tconst}
              hit={hit}
              viewMode={viewMode}
              priority={index < 8}
              onClick={() => dispatch(setSelectedMovie(hit.movie))}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
