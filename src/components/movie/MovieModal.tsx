import { useState, useEffect, useRef } from "react"
import {
  Star,
  Clock,
  Calendar,
  ExternalLink,
  Globe,
  CheckCircle2,
  Trash2,
  Loader2,
  ArrowLeft,
  Play,
  ChevronDown,
  Layers,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedMovie, openCinemaPlayer } from "@/store/searchSlice"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoviePoster } from "./MoviePoster"
import { TorrentList } from "./TorrentList"
import { QualityActionButtons } from "./QualityActionButtons"
import { SeriesEpisodeBrowser } from "./SeriesEpisodeBrowser"
import {
  formatRating,
  formatRuntime,
  formatVotes,
  getTypeLabel,
} from "@/lib/utils"
import {
  useGetMountedStatusQuery,
  useUnmountTorrentMutation,
  useGetTorrentsQuery,
} from "@/api/torrentsApi"
import { useGetMovieMetadataQuery } from "@/api/moviesApi"
import { useIsMobile } from "@/hooks/useMediaQuery"
import {
  MovieOverview,
  MovieCrewBadges,
  MovieCast,
  MovieTrailers,
} from "./MovieMetadataSection"
import { CriticsSection } from "./CriticsSection"
import { TrailerModal } from "./TrailerModal"
import type { VideoItem, MovieDoc } from "@/api/types"

export function MovieModal() {
  const dispatch = useAppDispatch()
  const movie = useAppSelector((state) => state.search.selectedMovie)
  const activePlayer = useAppSelector((state) => state.search.activePlayer)
  const isPlayerActive = Boolean(activePlayer)
  const lastMovieRef = useRef<MovieDoc | null>(null)
  if (movie) {
    lastMovieRef.current = movie
  }
  const activeMovie = movie || lastMovieRef.current

  const [showConfirmUnmount, setShowConfirmUnmount] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<VideoItem | null>(null)
  const isMobile = useIsMobile()

  const isSeries = activeMovie?.title_type === "tvSeries" || activeMovie?.title_type === "tvMiniSeries"
  const mainTitle = activeMovie?.title_ru || activeMovie?.title_primary || activeMovie?.title_orig || ""

  const { data: torrents, isLoading: isLoadingTorrents } = useGetTorrentsQuery(
    {
      q: mainTitle,
      imdb_id: activeMovie?.tconst || "",
      type: isSeries ? "tv" : "movie",
      limit: 100,
    },
    { skip: !activeMovie?.tconst }
  )

  const { data: mountStatus } = useGetMountedStatusQuery(
    activeMovie?.tconst ?? "",
    { skip: !activeMovie }
  )
  const {
    currentData: metadata,
    isLoading: isMetadataLoading,
    isFetching: isMetadataFetching,
  } = useGetMovieMetadataQuery(
    activeMovie?.tconst ?? "",
    { skip: !activeMovie }
  )
  const isMetadataBusy = isMetadataLoading || (isMetadataFetching && !metadata)
  const [unmountTorrent, { isLoading: isUnmounting }] = useUnmountTorrentMutation()

  // Lock background body scroll and handle browser back button / gestures on mobile
  useEffect(() => {
    if (!movie) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    window.history.pushState(
      { ...(window.history.state || {}), cineclawMovie: movie.tconst },
      ""
    )

    const handlePopState = (e: PopStateEvent) => {
      // If a trailer is currently open, close it first without exiting the movie screen
      if (activeTrailer) {
        setActiveTrailer(null)
      } else if (!e.state?.cineclawMovie) {
        dispatch(setSelectedMovie(null))
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeTrailer) {
          setActiveTrailer(null)
        } else {
          dispatch(setSelectedMovie(null))
        }
      }
    }

    window.addEventListener("popstate", handlePopState)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [movie?.tconst, activeTrailer, dispatch])

  if (!activeMovie) return null

  const handleBack = () => {
    if (activeTrailer) {
      setActiveTrailer(null)
      return
    }
    if (window.history.state?.cineclawMovie) {
      window.history.back()
    } else {
      dispatch(setSelectedMovie(null))
    }
  }

  const handleSelectTrailer = (video: VideoItem) => {
    if (isMobile) {
      window.history.pushState({ cineclawTrailer: video.id }, "")
    }
    setActiveTrailer(video)
  }

  const handleCloseTrailer = () => {
    if (isMobile && window.history.state?.cineclawTrailer) {
      window.history.back()
    } else {
      setActiveTrailer(null)
    }
  }

  const handleUnmount = async () => {
    try {
      await unmountTorrent({
        tconst: activeMovie.tconst,
        type: isSeries ? "shows" : "movies",
      }).unwrap()
      setShowConfirmUnmount(false)
    } catch (e) {
      console.error("Unmount failed", e)
    }
  }

  const runtimeFormatted = formatRuntime(activeMovie.runtime_minutes)
  const posterUrl = `/poster/${activeMovie.tconst}?size=w500`
  const imdbUrl = `https://www.imdb.com/title/${activeMovie.tconst}/`

  // -------------------------------------------------------------
  // MOBILE VIEW: Dedicated Full-Screen Screen with Smooth Slide Transitions
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <AnimatePresence>
        {movie && (
          <motion.div
            key="mobile-movie-screen"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.9 }}
            className="fixed inset-0 z-[70] bg-cinema-950 flex flex-col overflow-y-auto overscroll-contain no-scrollbar shadow-2xl"
          >
            {/* Sticky Top Navigation Bar */}
            <header className="sticky top-0 z-30 flex items-center justify-between px-3 py-2 bg-cinema-950/95 backdrop-blur-xl border-b border-border/80 pt-[max(0.5rem,env(safe-area-inset-top))]">
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cinema-850/90 border border-border/80 text-foreground font-semibold text-xs active:scale-95 transition-all shadow-sm"
              >
                <ArrowLeft className="h-4 w-4 text-primary" />
                <span>Назад</span>
              </button>

              {/* Center Title Summary */}
              <div className="flex-1 mx-2 text-center min-w-0">
                <span className="font-bold text-xs text-foreground truncate block">
                  {mainTitle}
                </span>
                {activeMovie.year && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {activeMovie.year}
                  </span>
                )}
              </div>

              {/* Right Action Icons */}
              <div className="flex items-center gap-1.5">
                {mountStatus?.mounted && !showConfirmUnmount && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/15"
                    onClick={() => setShowConfirmUnmount(true)}
                    title="Удалить из библиотеки"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <a
                  href={imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-cinema-850/90 border border-border/80 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                  title="Открыть на IMDb"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </header>

            {/* Delete Confirmation Alert Banner (Mobile) */}
            {showConfirmUnmount && (
              <div className="p-3 bg-destructive/15 border-b border-destructive/30 flex items-center justify-between gap-2 animate-in fade-in">
                <span className="text-xs text-destructive font-medium">
                  Удалить из библиотеки?
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    disabled={isUnmounting}
                    onClick={handleUnmount}
                  >
                    {isUnmounting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Удалить"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-zinc-400"
                    onClick={() => setShowConfirmUnmount(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}

            {/* Content Body */}
            <div className="p-4 space-y-4 flex-1 pb-[max(3rem,env(safe-area-inset-bottom))]">
              {/* Top Hero: Poster + Meta Details */}
              <div className="flex gap-3.5 items-start">
                {/* Poster */}
                <div className="w-28 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-border/80">
                  <MoviePoster src={posterUrl} alt={mainTitle} />
                </div>

                {/* Details beside poster */}
                <div className="flex-1 min-w-0 space-y-2 text-left">
                  <h1 className="text-lg font-black tracking-tight text-foreground leading-snug break-words">
                    {mainTitle}
                  </h1>

                  {activeMovie.title_orig && activeMovie.title_orig !== mainTitle && (
                    <p className="text-xs text-muted-foreground italic font-medium truncate">
                      {activeMovie.title_orig}
                    </p>
                  )}

                  {/* Badges Row */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {activeMovie.rating ? (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span>{formatRating(activeMovie.rating)}</span>
                      </div>
                    ) : null}

                    {activeMovie.year ? (
                      <Badge variant="year" className="text-[11px] px-2 py-0.5">
                        <Calendar className="h-2.5 w-2.5 mr-1 opacity-70" />
                        {activeMovie.year}
                      </Badge>
                    ) : null}

                    <Badge variant="type" className="text-[11px] px-2 py-0.5">
                      {getTypeLabel(activeMovie.title_type)}
                    </Badge>

                    {runtimeFormatted && (
                      <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                        <Clock className="h-2.5 w-2.5 mr-1 opacity-70" />
                        {runtimeFormatted}
                      </Badge>
                    )}
                  </div>

                  {/* Votes Metric */}
                  {activeMovie.num_votes > 0 && (
                    <div className="text-[11px] text-muted-foreground font-mono pt-1">
                      IMDb: <strong className="text-zinc-200">{formatVotes(activeMovie.num_votes)}</strong> голосов
                    </div>
                  )}
                </div>
              </div>

              {/* Genres Chips */}
              {activeMovie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeMovie.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2.5 py-1 rounded-lg border border-border/70 bg-cinema-850 text-xs text-zinc-300 font-medium"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Mounted in Jellyfin Card */}
              {mountStatus?.mounted && (
                <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/25 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-300">
                        В медиатеке
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono truncate">
                        {mountStatus.file_count} файл(ов)
                        {mountStatus.versions && mountStatus.versions.length > 0
                          ? ` • ${mountStatus.versions.join(", ")}`
                          : null}
                        {isSeries && mountStatus.seasons && mountStatus.seasons.length > 0
                          ? ` • S${mountStatus.seasons.join(", S")}`
                          : null}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      dispatch(
                        openCinemaPlayer({
                          tconst: activeMovie.tconst,
                          title: mainTitle,
                          ruTitle: activeMovie.title_ru || undefined,
                        })
                      )
                    }
                    className="h-8 px-3 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 gap-1.5 shadow-md shadow-emerald-950/50 active:scale-95 shrink-0"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Смотреть</span>
                  </Button>
                </div>
              )}

              {/* Alternate Russian Titles */}
              {activeMovie.russian_titles.length > 1 && (
                <div className="text-left pt-1">
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1">
                    Альтернативные названия:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeMovie.russian_titles
                      .filter((t) => t !== mainTitle)
                      .slice(0, 5)
                      .map((t, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 font-normal"
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Primary Action Buttons (Quality & Watch / Add) or Series Browser */}
              <div className="w-full min-w-0 pt-2">
                {isSeries ? (
                  <SeriesEpisodeBrowser
                    tconst={activeMovie.tconst}
                    title={mainTitle}
                    ruTitle={activeMovie.title_ru || undefined}
                    year={activeMovie.year}
                    torrents={torrents}
                    isLoadingTorrents={isLoadingTorrents}
                  />
                ) : (
                  <QualityActionButtons
                    tconst={activeMovie.tconst}
                    title={mainTitle}
                    ruTitle={activeMovie.title_ru || undefined}
                    year={activeMovie.year}
                    isSeries={false}
                    torrents={torrents}
                    isLoadingTorrents={isLoadingTorrents}
                  />
                )}
              </div>

              {/* Critics & AI Consensus Section */}
              <CriticsSection tconst={activeMovie.tconst} className="pt-2" />

              {/* Metadata Section: Overview / Synopsis */}
              <MovieOverview
                overview={metadata?.overview}
                isLoading={isMetadataBusy}
                className="pt-2"
              />

              {/* Metadata Section: Crew (Director, Screenplay, Creator) */}
              <MovieCrewBadges
                crew={metadata?.crew}
                isLoading={isMetadataBusy}
                className="pt-1"
              />

              {/* Metadata Section: Trailers & Teasers */}
              <MovieTrailers
                videos={metadata?.videos}
                onSelectTrailer={handleSelectTrailer}
                isLoading={isMetadataBusy}
                className="pt-2"
              />

              {/* Metadata Section: Cast */}
              <MovieCast
                cast={metadata?.cast}
                isLoading={isMetadataBusy}
                className="pt-2"
              />

              {/* Collapsible Manual Torrent List (Optional for power users) */}
              <div className="w-full min-w-0 pt-2">
                <details className="group rounded-2xl border border-border/70 bg-cinema-900/60 overflow-hidden transition-colors">
                  <summary className="px-4 py-3 cursor-pointer select-none font-bold text-xs text-zinc-400 hover:text-white flex items-center justify-between transition-colors">
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" />
                      Ручной выбор раздачи
                      {torrents && torrents.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-850 text-zinc-400 font-mono border border-border/60">
                          {torrents.length}
                        </span>
                      )}
                    </span>
                    <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open:rotate-180 text-zinc-500" />
                  </summary>
                  <div className="p-3 sm:p-4 border-t border-border/40">
                    <TorrentList
                      key={activeMovie.tconst}
                      query={mainTitle}
                      imdbId={activeMovie.tconst}
                      year={activeMovie.year}
                      isSeries={isSeries}
                      onPlayMedia={() =>
                        dispatch(
                          openCinemaPlayer({
                            tconst: activeMovie.tconst,
                            title: mainTitle,
                            ruTitle: activeMovie.title_ru || undefined,
                          })
                        )
                      }
                    />
                  </div>
                </details>
              </div>
            </div>

            {/* Embedded Trailer Modal */}
            <TrailerModal video={activeTrailer} onClose={handleCloseTrailer} />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // -------------------------------------------------------------
  // DESKTOP VIEW: Centered Modal Dialog with Smooth Exit Animation
  // -------------------------------------------------------------
  return (
    <>
      <Dialog
        open={!!movie && !isPlayerActive}
        onOpenChange={(open) => {
          if (!open && !isPlayerActive) dispatch(setSelectedMovie(null))
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden bg-cinema-900 border-border/80 p-4 sm:p-6 rounded-2xl shadow-2xl custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start w-full min-w-0">
            {/* Left Column: Poster */}
            <div className="sm:col-span-4 flex-shrink-0">
              <MoviePoster
                src={posterUrl}
                alt={mainTitle}
                className="w-full rounded-xl shadow-2xl border border-border/80"
              />
            </div>

            {/* Right Column: Movie Details */}
            <div className="sm:col-span-8 flex flex-col justify-between h-full space-y-3.5 text-left">
              <div>
                {/* Badges Row */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {activeMovie.rating ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-bold shadow-sm">
                      <Star className="h-4 w-4 fill-current" />
                      <span>{formatRating(activeMovie.rating)}</span>
                      <span className="text-zinc-500 font-normal text-xs">/ 10</span>
                    </div>
                  ) : null}

                  {activeMovie.year ? (
                    <Badge variant="year" className="text-xs px-2 py-1">
                      <Calendar className="h-3 w-3 mr-1 opacity-70" />
                      {activeMovie.year}
                    </Badge>
                  ) : null}

                  <Badge variant="type" className="text-xs px-2 py-1">
                    {getTypeLabel(activeMovie.title_type)}
                  </Badge>

                  {runtimeFormatted && (
                    <Badge variant="secondary" className="text-xs px-2 py-1">
                      <Clock className="h-3 w-3 mr-1 opacity-70" />
                      {runtimeFormatted}
                    </Badge>
                  )}
                </div>

                {/* Title Header */}
                <DialogHeader className="p-0 space-y-1">
                  <DialogTitle className="text-2xl font-black tracking-tight text-foreground break-words">
                    {mainTitle}
                  </DialogTitle>
                  {activeMovie.title_orig && activeMovie.title_orig !== mainTitle && (
                    <p className="text-sm text-muted-foreground italic font-medium break-words">
                      Оригинал: {activeMovie.title_orig}
                    </p>
                  )}
                </DialogHeader>

                {/* Genres */}
                {activeMovie.genres.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {activeMovie.genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-0.5 rounded-md border border-border/60 bg-cinema-850 text-xs text-zinc-300 font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Critics & AI Consensus Section */}
                <CriticsSection tconst={activeMovie.tconst} className="mt-3.5" />

                {/* Overview / Synopsis */}
                <MovieOverview
                  overview={metadata?.overview}
                  isLoading={isMetadataBusy}
                  className="mt-3.5"
                />

                {/* Crew Details */}
                <MovieCrewBadges
                  crew={metadata?.crew}
                  isLoading={isMetadataBusy}
                  className="mt-3"
                />

                {/* Votes Metric */}
                {activeMovie.num_votes > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl border border-border/60 bg-cinema-950/70 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Голосов на IMDb:</span>
                    <span className="font-mono text-zinc-200 font-bold">
                      {activeMovie.num_votes.toLocaleString("ru-RU")} ({formatVotes(activeMovie.num_votes)})
                    </span>
                  </div>
                )}

                {/* Alternate Russian Titles */}
                {activeMovie.russian_titles.length > 1 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      <span>Другие названия на русском:</span>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {activeMovie.russian_titles
                        .filter((t) => t !== mainTitle)
                        .slice(0, 5)
                        .map((t, idx) => (
                          <li key={idx} className="truncate">
                            {t}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {/* Mounted in Jellyfin Status & Unmount Action */}
                {mountStatus?.mounted && (
                  <div className="mt-3.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/25 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-emerald-300">
                          В медиатеке
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate">
                          {mountStatus.file_count} файл(ов)
                          {mountStatus.versions && mountStatus.versions.length > 0
                            ? ` • Версии: ${mountStatus.versions.join(", ")}`
                            : null}
                          {isSeries && mountStatus.seasons && mountStatus.seasons.length > 0
                            ? ` • Сезоны: ${mountStatus.seasons.join(", ")}`
                            : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!showConfirmUnmount && (
                        <Button
                          size="sm"
                          onClick={() =>
                            dispatch(
                              openCinemaPlayer({
                                tconst: activeMovie.tconst,
                                title: mainTitle,
                                ruTitle: activeMovie.title_ru || undefined,
                              })
                            )
                          }
                          className="h-7 px-3 text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold shadow-sm active:scale-95 transition-all"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Смотреть онлайн</span>
                        </Button>
                      )}
                      {showConfirmUnmount ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2.5 text-xs gap-1"
                            disabled={isUnmounting}
                            onClick={handleUnmount}
                          >
                            {isUnmounting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span>Точно удалить?</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
                            onClick={() => setShowConfirmUnmount(false)}
                          >
                            Отмена
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/15 hover:text-destructive transition-colors"
                          onClick={() => setShowConfirmUnmount(true)}
                          title="Удалить файлы и торрент из медиатеки"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Удалить из библиотеки</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-zinc-500">
                  ID: {activeMovie.tconst}
                </span>

                <a
                  href={imdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="default" size="sm" className="gap-2 text-xs">
                    <span>Открыть на IMDb</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons (Quality & Watch / Add) or Series Browser */}
          <div className="w-full min-w-0 pt-4 border-t border-border/50">
            {isSeries ? (
              <SeriesEpisodeBrowser
                tconst={activeMovie.tconst}
                title={mainTitle}
                ruTitle={activeMovie.title_ru || undefined}
                year={activeMovie.year}
                torrents={torrents}
                isLoadingTorrents={isLoadingTorrents}
              />
            ) : (
              <QualityActionButtons
                tconst={activeMovie.tconst}
                title={mainTitle}
                ruTitle={activeMovie.title_ru || undefined}
                year={activeMovie.year}
                isSeries={false}
                torrents={torrents}
                isLoadingTorrents={isLoadingTorrents}
              />
            )}
          </div>

          {/* Full-width section: Trailers */}
          <MovieTrailers
            videos={metadata?.videos}
            onSelectTrailer={setActiveTrailer}
            isLoading={isMetadataBusy}
            className="w-full min-w-0 pt-4 border-t border-border/50"
          />

          {/* Full-width section: Cast */}
          <MovieCast
            cast={metadata?.cast}
            isLoading={isMetadataBusy}
            className="w-full min-w-0 pt-4 border-t border-border/50"
          />

          {/* Collapsible Manual Torrent List (Optional for power users) */}
          <div className="w-full min-w-0 pt-4 border-t border-border/50">
            <details className="group rounded-2xl border border-border/70 bg-cinema-900/60 overflow-hidden transition-colors">
              <summary className="px-4 py-3 cursor-pointer select-none font-bold text-xs text-zinc-400 hover:text-white flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" />
                  Ручной выбор раздачи
                  {torrents && torrents.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-850 text-zinc-400 font-mono border border-border/60">
                      {torrents.length}
                    </span>
                  )}
                </span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open:rotate-180 text-zinc-500" />
              </summary>
              <div className="p-3 sm:p-4 border-t border-border/40">
                <TorrentList
                  key={activeMovie.tconst}
                  query={mainTitle}
                  imdbId={activeMovie.tconst}
                  year={activeMovie.year}
                  isSeries={isSeries}
                  onPlayMedia={() =>
                    dispatch(
                      openCinemaPlayer({
                        tconst: activeMovie.tconst,
                        title: mainTitle,
                        ruTitle: activeMovie.title_ru || undefined,
                      })
                    )
                  }
                />
              </div>
            </details>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Trailer Modal */}
      <TrailerModal video={activeTrailer} onClose={() => setActiveTrailer(null)} />
    </>
  )
}
