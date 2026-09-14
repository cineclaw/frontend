import React, { useState, useMemo } from "react"
import { Play, Check, CheckCheck, Calendar, Tv, Loader2, Star, Clock, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { useAppDispatch } from "@/store/store"
import { openCinemaPlayer } from "@/store/searchSlice"
import {
  useGetSeriesSeasonsQuery,
  useGetSeriesEpisodesQuery,
} from "@/api/moviesApi"
import type { SeriesSeasonItem, SeriesEpisodeItem } from "@/api/types"
import {
  useGetMountedStatusQuery,
  useGetPlayerInfoQuery,
  useMountTorrentMutation,
  useGetSeriesProgressQuery,
  useMarkWatchedMutation,
  type TorrentResult,
} from "@/api/torrentsApi"
import { getTmdbImageUrl } from "@/lib/tmdbImages"
import { formatRuntime } from "@/lib/utils"
import { useDefaultQuality, selectPreferredTorrent } from "@/lib/userSettings"

interface SeriesEpisodeBrowserProps {
  tconst: string
  title: string
  ruTitle?: string
  year?: number | null
  torrents?: TorrentResult[]
  isLoadingTorrents?: boolean
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function getEpisodesWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19) return "серий"
  if (mod10 === 1) return "серия"
  if (mod10 >= 2 && mod10 <= 4) return "серии"
  return "серий"
}

export const SeriesEpisodeBrowser: React.FC<SeriesEpisodeBrowserProps> = ({
  tconst,
  title,
  ruTitle,
  year,
  torrents,
  isLoadingTorrents = false,
}) => {
  const dispatch = useAppDispatch()
  const [defaultQuality] = useDefaultQuality()

  // 1. Fetch seasons breakdown from TMDB
  const { data: seasonsData, isLoading: isLoadingSeasons } = useGetSeriesSeasonsQuery(tconst)

  // 2. Fetch all episodes metadata from TMDB
  const { data: episodesData, isLoading: isLoadingEpisodes } = useGetSeriesEpisodesQuery(tconst)

  // 3. Fetch mounted status in TorrServer
  const { data: mountStatus } = useGetMountedStatusQuery(tconst, {
    skip: !tconst,
  })

  // Valid seasons (excluding season 0 / specials)
  const validSeasons = useMemo(() => {
    return (seasonsData?.seasons || []).filter((s) => s.season_number > 0)
  }, [seasonsData?.seasons])

  // Active season state
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [isSeasonOverviewExpanded, setIsSeasonOverviewExpanded] = useState<boolean>(false)

  // Sync with available seasons once loaded
  const activeSeasonNumber = useMemo(() => {
    if (validSeasons.some((s) => s.season_number === selectedSeason)) {
      return selectedSeason
    }
    return validSeasons[0]?.season_number || 1
  }, [validSeasons, selectedSeason])

  // Active season metadata object
  const currentSeasonData = useMemo(() => {
    return validSeasons.find((s) => s.season_number === activeSeasonNumber)
  }, [validSeasons, activeSeasonNumber])

  // 4. Fetch player info for active season to know progress & mounted status
  const { data: playerInfo } = useGetPlayerInfoQuery(
    { tconst, season: activeSeasonNumber },
    { skip: !tconst }
  )

  // 5. Fetch series watched progress
  const { data: seriesProgress } = useGetSeriesProgressQuery(tconst, {
    skip: !tconst,
  })
  const [markWatchedMutation] = useMarkWatchedMutation()
  const [pendingCatchUp, setPendingCatchUp] = useState<{ season: number; episode: number } | null>(null)

  // Episodes for active season
  const currentEpisodes = useMemo(() => {
    return (episodesData || []).filter((e) => e.season_number === activeSeasonNumber)
  }, [episodesData, activeSeasonNumber])

  // Map episode progress
  const episodesProgressMap = useMemo(() => {
    const map = new Map<number, { id: string; resume_seconds: number; is_played: boolean }>()
    if (playerInfo?.episodes) {
      for (const ep of playerInfo.episodes) {
        if (ep.season_number === activeSeasonNumber) {
          map.set(ep.episode_number, {
            id: ep.id,
            resume_seconds: ep.resume_seconds,
            is_played: ep.is_played,
          })
        }
      }
    }
    // Merge from seriesProgress
    if (seriesProgress?.episodes) {
      for (const [key, epStatus] of Object.entries(seriesProgress.episodes)) {
        if (epStatus.season_number === activeSeasonNumber) {
          const prev = map.get(epStatus.episode_number)
          map.set(epStatus.episode_number, {
            id: prev?.id || key,
            resume_seconds: epStatus.position_seconds || prev?.resume_seconds || 0,
            is_played: epStatus.is_completed || prev?.is_played || false,
          })
        }
      }
    }
    return map
  }, [playerInfo?.episodes, seriesProgress?.episodes, activeSeasonNumber])

  // Determine the smartest next episode for this season
  const nextEpisodeToWatch = useMemo(() => {
    if (currentEpisodes.length === 0) return 1
    // 1. Look for in-progress episode
    for (const ep of currentEpisodes) {
      const prog = episodesProgressMap.get(ep.episode_number)
      if (prog && prog.resume_seconds > 10 && !prog.is_played) {
        return ep.episode_number
      }
    }
    // 2. Look for the first unplayed episode
    for (const ep of currentEpisodes) {
      const prog = episodesProgressMap.get(ep.episode_number)
      if (!prog || !prog.is_played) {
        return ep.episode_number
      }
    }
    // 3. Fallback to episode 1
    return 1
  }, [currentEpisodes, episodesProgressMap])

  const [mountingEpisode, setMountingEpisode] = useState<number | null>(null)
  const [mountTorrent] = useMountTorrentMutation()

  const isSeasonMounted = Boolean(
    mountStatus?.seasons?.includes(activeSeasonNumber) ||
    (playerInfo?.episodes && playerInfo.episodes.some((e) => e.season_number === activeSeasonNumber))
  )

  const hasUnwatchedPrior = (targetSeason: number, targetEpisode: number): boolean => {
    if (!episodesData || episodesData.length === 0) return false
    for (const ep of episodesData) {
      if (ep.season_number <= 0) continue
      if (
        ep.season_number < targetSeason ||
        (ep.season_number === targetSeason && ep.episode_number < targetEpisode)
      ) {
        const keyX = `${ep.season_number}x${ep.episode_number}`
        const keyUnderscore = `${ep.season_number}_${ep.episode_number}`
        const status = seriesProgress?.episodes?.[keyX] || seriesProgress?.episodes?.[keyUnderscore]
        if (!status?.is_completed) {
          return true
        }
      }
    }
    return false
  }

  const onEpisodeClick = (episodeNumber: number) => {
    if (hasUnwatchedPrior(activeSeasonNumber, episodeNumber)) {
      setPendingCatchUp({ season: activeSeasonNumber, episode: episodeNumber })
    } else {
      handlePlayEpisode(episodeNumber)
    }
  }

  const handleConfirmCatchUp = async (markPrior: boolean) => {
    if (!pendingCatchUp) return
    const { season, episode } = pendingCatchUp
    setPendingCatchUp(null)
    if (markPrior) {
      try {
        await markWatchedMutation({
          imdb_id: tconst,
          mode: "up_to",
          title: ruTitle || title,
          up_to_season: season,
          up_to_episode: episode,
          completed: true,
        }).unwrap()
      } catch (err) {
        console.error("Failed to mark up to episode watched:", err)
      }
    }
    handlePlayEpisode(episode)
  }

  const handleToggleSeasonWatched = async () => {
    const isCompleted = seriesProgress?.seasons?.[String(activeSeasonNumber)]?.is_completed ?? false
    try {
      await markWatchedMutation({
        imdb_id: tconst,
        mode: "season",
        title: ruTitle || title,
        season: activeSeasonNumber,
        completed: !isCompleted,
      }).unwrap()
    } catch (err) {
      console.error("Failed to toggle season watched:", err)
    }
  }

  const handleToggleEpisodeWatched = async (episodeNumber: number, currentCompleted: boolean) => {
    try {
      await markWatchedMutation({
        imdb_id: tconst,
        mode: "episode",
        title: ruTitle || title,
        season: activeSeasonNumber,
        episode: episodeNumber,
        completed: !currentCompleted,
      }).unwrap()
    } catch (err) {
      console.error("Failed to toggle episode watched:", err)
    }
  }

  const handlePlayEpisode = async (episodeNumber: number) => {
    try {
      if (!isSeasonMounted && torrents && torrents.length > 0) {
        setMountingEpisode(episodeNumber)
        const bestTorrent = selectPreferredTorrent(torrents, defaultQuality, activeSeasonNumber, true)
        if (bestTorrent && (bestTorrent.magnet || bestTorrent.id)) {
          try {
            await mountTorrent({
              tconst,
              title,
              ru_title: ruTitle,
              year: year ? year.toString() : undefined,
              type: "tvSeries",
              season: activeSeasonNumber,
              magnet: bestTorrent.magnet,
              tracker: bestTorrent.tracker || (bestTorrent.trackers && bestTorrent.trackers[0]),
              torrent_id: bestTorrent.id,
              details_url: bestTorrent.details_url,
              mode: "add_version",
              version_name: defaultQuality.toUpperCase(),
              resolution: bestTorrent.resolution,
              folder_name: mountStatus?.folder_name,
            }).unwrap()
          } catch (e) {
            console.warn("Auto-mount season error:", e)
          }
        }
      }
    } finally {
      setMountingEpisode(null)
    }

    dispatch(
      openCinemaPlayer({
        tconst,
        title,
        ruTitle,
        initialSeason: activeSeasonNumber,
        initialEpisode: episodeNumber,
      })
    )
  }

  // Season year
  const seasonYear = useMemo(() => {
    if (currentSeasonData?.air_date) {
      try {
        return new Date(currentSeasonData.air_date).getFullYear()
      } catch {
        return undefined
      }
    }
    return undefined
  }, [currentSeasonData?.air_date])

  if (isLoadingSeasons && !seasonsData) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
        <span className="text-xs">Загрузка информации о сезонах...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-left">
      {/* 1. All Seasons at once with Poster Covers */}
      {validSeasons.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-300">
              Сезоны ({validSeasons.length}):
            </span>
            {isLoadingTorrents && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                Поиск раздач...
              </span>
            )}
          </div>

          <div className="flex gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar overscroll-x-contain pb-2 -mx-4 pl-4 sm:-mx-6 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6">
            {validSeasons.map((s: SeriesSeasonItem) => {
              const isSelected = s.season_number === activeSeasonNumber
              const isMounted = mountStatus?.seasons?.includes(s.season_number)
              const rawPoster = s.poster_path || seasonsData?.poster_path
              const posterUrl = getTmdbImageUrl(rawPoster, "w342")
              const sYear = s.air_date ? new Date(s.air_date).getFullYear() : null

              return (
                <button
                  key={s.season_number}
                  type="button"
                  onClick={() => {
                    setSelectedSeason(s.season_number)
                    setIsSeasonOverviewExpanded(false)
                  }}
                  className={`group relative w-24 sm:w-28 shrink-0 flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer select-none p-1.5 border active:scale-95 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/50 shadow-xl shadow-emerald-950/50"
                      : "border-border/70 bg-cinema-900/85 hover:bg-cinema-850 hover:border-zinc-500"
                  }`}
                >
                  {/* Season 2:3 Vertical Poster */}
                  <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-zinc-950 border border-white/5 shadow-md">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={s.name || `Сезон ${s.season_number}`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 p-2 text-center">
                        <Tv className="w-6 h-6 mb-1 text-zinc-500" />
                        <span className="text-[10px] font-semibold text-zinc-400">
                          {s.season_number}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                    {/* Top Status Indicators */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                      {isMounted && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black shadow-sm shadow-emerald-500 animate-pulse"
                          title="В медиатеке"
                        />
                      )}
                    </div>

                    {s.vote_average && s.vote_average > 0 ? (
                      <div className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded bg-black/80 border border-amber-500/30 text-[9px] font-bold text-amber-400 backdrop-blur-xs flex items-center gap-0.5 shadow">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>{s.vote_average.toFixed(1)}</span>
                      </div>
                    ) : null}

                    {/* Bottom Metadata in Poster */}
                    <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between text-[9px] font-semibold text-zinc-300 pointer-events-none">
                      {(() => {
                        const sProg = seriesProgress?.seasons?.[String(s.season_number)]
                        if (sProg?.is_completed) {
                          return (
                            <span className="px-1 py-0.2 rounded bg-emerald-500/90 text-black font-extrabold flex items-center gap-0.5 shadow">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              Все серии
                            </span>
                          )
                        }
                        if (sProg && sProg.watched_episodes > 0) {
                          return (
                            <span className="px-1 py-0.2 rounded bg-black/85 text-emerald-400 font-mono font-bold shadow">
                              {sProg.watched_episodes}/{s.episode_count}
                            </span>
                          )
                        }
                        return (
                          <span className="px-1 py-0.2 rounded bg-black/75 backdrop-blur-xs font-mono">
                            {s.episode_count} эп.
                          </span>
                        )
                      })()}
                      {sYear && (
                        <span className="px-1 py-0.2 rounded bg-black/75 backdrop-blur-xs font-mono text-zinc-400">
                          {sYear}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Season Label */}
                  <div className="pt-1.5 px-0.5">
                    <h4
                      className={`text-xs font-bold truncate leading-tight transition-colors ${
                        isSelected ? "text-emerald-300" : "text-white group-hover:text-zinc-200"
                      }`}
                    >
                      {s.name || `Сезон ${s.season_number}`}
                    </h4>
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {s.episode_count} {getEpisodesWord(s.episode_count)}
                    </span>
                  </div>
                </button>
              )
            })}
            {/* Trailing spacer for comfortable right padding when scrolled to end */}
            <div className="shrink-0 w-3 sm:w-4 pointer-events-none" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* 2. Active Season Showcase & Action Banner (Clean without technical clutter) */}
      <div className="rounded-2xl border border-border/80 bg-cinema-900/90 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-base sm:text-lg font-black text-white">
                {currentSeasonData?.name || `Сезон ${activeSeasonNumber}`}
              </h3>
              {isSeasonMounted && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  В медиатеке
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400 mt-1">
              {currentSeasonData?.episode_count && (
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 font-semibold text-[11px]">
                  {currentSeasonData.episode_count} {getEpisodesWord(currentSeasonData.episode_count)}
                </span>
              )}
              {seasonYear && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  <span>{seasonYear} г.</span>
                </span>
              )}
              {currentSeasonData?.vote_average && currentSeasonData.vote_average > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{currentSeasonData.vote_average.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Season Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Mark Season Button */}
            <button
              type="button"
              onClick={handleToggleSeasonWatched}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                seriesProgress?.seasons?.[String(activeSeasonNumber)]?.is_completed
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white"
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${seriesProgress?.seasons?.[String(activeSeasonNumber)]?.is_completed ? "text-emerald-400 stroke-[2.5]" : "text-zinc-400"}`} />
              <span>
                {seriesProgress?.seasons?.[String(activeSeasonNumber)]?.is_completed
                  ? "Сезон просмотрен"
                  : "Отметить сезон"}
              </span>
            </button>

            {/* Quick Play Season Button */}
            <button
              type="button"
              onClick={() => onEpisodeClick(nextEpisodeToWatch)}
              disabled={mountingEpisode !== null}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {mountingEpisode === nextEpisodeToWatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Запуск...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>
                    {nextEpisodeToWatch > 1
                      ? `Продолжить с ${nextEpisodeToWatch} серии`
                      : "Смотреть сезон"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Season Overview */}
        {currentSeasonData?.overview && (
          <div className="pt-1 border-t border-border/50">
            <p
              className={`text-xs text-zinc-300 leading-relaxed ${
                isSeasonOverviewExpanded ? "" : "line-clamp-2 sm:line-clamp-3"
              }`}
            >
              {currentSeasonData.overview}
            </p>
            {currentSeasonData.overview.length > 140 && (
              <button
                type="button"
                onClick={() => setIsSeasonOverviewExpanded(!isSeasonOverviewExpanded)}
                className="mt-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{isSeasonOverviewExpanded ? "Свернуть" : "Подробнее о сезоне"}</span>
                {isSeasonOverviewExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Episodes List */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-zinc-300">
            Серии ({currentEpisodes.length}):
          </div>
          {isLoadingEpisodes && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              Загрузка серий...
            </span>
          )}
        </div>

        {currentEpisodes.length === 0 && !isLoadingEpisodes && (
          <div className="p-6 rounded-2xl bg-cinema-900 border border-border/60 text-center text-xs text-zinc-400">
            Информация о сериях этого сезона скоро появится
          </div>
        )}

        <div className="space-y-2.5">
          {currentEpisodes.map((ep: SeriesEpisodeItem) => {
            const epProgress = episodesProgressMap.get(ep.episode_number)
            const hasResume = epProgress && epProgress.resume_seconds > 10 && !epProgress.is_played
            const stillUrl = getTmdbImageUrl(ep.still_path, "w500")
            const formattedDuration = formatRuntime(ep.runtime)

            return (
              <div
                key={ep.episode_number}
                onClick={() => onEpisodeClick(ep.episode_number)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onEpisodeClick(ep.episode_number)
                  }
                }}
                className="group relative p-3 rounded-2xl border border-border/70 bg-cinema-900 hover:border-emerald-500/40 hover:bg-cinema-850/90 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row gap-3.5 items-start sm:items-center"
              >
                {/* Episode 16:9 Thumbnail Still */}
                <div className="relative w-full sm:w-48 aspect-[16/9] shrink-0 rounded-xl overflow-hidden bg-zinc-950 border border-border/60 flex items-center justify-center">
                  {stillUrl ? (
                    <img
                      src={stillUrl}
                      alt={ep.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-zinc-600 flex flex-col items-center gap-1">
                      <Tv className="w-6 h-6" />
                      <span className="text-[10px] text-zinc-500 font-medium">
                        Серия {ep.episode_number}
                      </span>
                    </div>
                  )}

                  {/* Dark gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                  {/* Episode Number badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[10px] font-bold text-white backdrop-blur-md">
                    {ep.episode_number}
                  </div>

                  {/* Duration Badge */}
                  {formattedDuration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-[10px] font-mono text-zinc-300 flex items-center gap-1 backdrop-blur-md">
                      <Clock className="w-2.5 h-2.5 text-zinc-400" />
                      <span>{formattedDuration}</span>
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity">
                    <div className="p-2.5 rounded-full bg-emerald-500/90 text-black shadow-lg shadow-emerald-500/30 group-hover:scale-110 group-hover:bg-emerald-400 transition-transform">
                      {mountingEpisode === ep.episode_number ? (
                        <Loader2 className="h-4 w-4 animate-spin text-black" />
                      ) : (
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Resume progress bar in thumbnail */}
                  {hasResume && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div className="h-full bg-emerald-400 w-1/3" />
                    </div>
                  )}
                </div>

                {/* Episode Details */}
                <div className="flex-1 min-w-0 space-y-1.5 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {ep.episode_number}. {ep.name || `Эпизод ${ep.episode_number}`}
                    </h4>
                    {ep.episode_type === "finale" && (
                      <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Финал
                      </span>
                    )}
                    {epProgress?.is_played && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        Просмотрено
                      </span>
                    )}
                  </div>

                  {/* Episode Metadata Row */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                    {ep.air_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 opacity-60" />
                        <span>{formatDate(ep.air_date)}</span>
                      </div>
                    )}
                    {ep.vote_average && ep.vote_average > 0 && (
                      <div className="flex items-center gap-1 text-amber-400 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{ep.vote_average.toFixed(1)}</span>
                        {ep.vote_count && ep.vote_count > 0 && (
                          <span className="text-[10px] text-zinc-500">({ep.vote_count})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Episode Synopsis */}
                  {ep.overview && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {ep.overview}
                    </p>
                  )}
                </div>

                {/* Quick Watched Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleEpisodeWatched(ep.episode_number, Boolean(epProgress?.is_played))
                  }}
                  className={`self-start sm:self-center shrink-0 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    epProgress?.is_played
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                  }`}
                  title={epProgress?.is_played ? "Снять отметку о просмотре" : "Отметить как просмотренную"}
                >
                  <Check className={`w-4 h-4 ${epProgress?.is_played ? "stroke-[2.5]" : "stroke-2"}`} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Catch-Up Prompt Modal */}
      {pendingCatchUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-cinema-900 p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Предыдущие серии не просмотрены
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Вы начинаете просмотр с {pendingCatchUp.episode} серии {pendingCatchUp.season} сезона, но некоторые предыдущие серии ещё не были отмечены как просмотренные. Пометить их как просмотренные?
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleConfirmCatchUp(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Пометить предыдущие и смотреть</span>
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCatchUp(false)}
                className="py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white font-semibold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Только смотреть
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingCatchUp(null)}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 pt-1 cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
