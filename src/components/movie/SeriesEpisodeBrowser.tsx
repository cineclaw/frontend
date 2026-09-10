import React, { useState, useMemo } from "react"
import { Play, Check, Calendar, Tv, Loader2 } from "lucide-react"
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
  type TorrentResult,
} from "@/api/torrentsApi"
import { getQualityOptions } from "@/lib/torrentSelector"
import { QualityActionButtons } from "./QualityActionButtons"

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

export const SeriesEpisodeBrowser: React.FC<SeriesEpisodeBrowserProps> = ({
  tconst,
  title,
  ruTitle,
  year,
  torrents,
  isLoadingTorrents = false,
}) => {
  const dispatch = useAppDispatch()

  // 1. Fetch seasons breakdown from TMDB
  const { data: seasonsData, isLoading: isLoadingSeasons } = useGetSeriesSeasonsQuery(tconst)

  // 2. Fetch all episodes metadata from TMDB
  const { data: episodesData, isLoading: isLoadingEpisodes } = useGetSeriesEpisodesQuery(tconst)

  // 3. Fetch mounted status in Jellyfin
  const { data: mountStatus } = useGetMountedStatusQuery(tconst, {
    skip: !tconst,
  })

  // Valid seasons (excluding season 0 / specials)
  const validSeasons = useMemo(() => {
    return (seasonsData?.seasons || []).filter((s) => s.season_number > 0)
  }, [seasonsData?.seasons])

  // Active season state
  const [selectedSeason, setSelectedSeason] = useState<number>(1)

  // Sync with available seasons once loaded
  const activeSeasonNumber = useMemo(() => {
    if (validSeasons.some((s) => s.season_number === selectedSeason)) {
      return selectedSeason
    }
    return validSeasons[0]?.season_number || 1
  }, [validSeasons, selectedSeason])

  // 4. Fetch player info for the active season to know mounted status & resume positions
  const { data: playerInfo } = useGetPlayerInfoQuery(
    { tconst, season: activeSeasonNumber },
    { skip: !tconst }
  )

  // Episodes for active season
  const currentEpisodes = useMemo(() => {
    return (episodesData || []).filter((e) => e.season_number === activeSeasonNumber)
  }, [episodesData, activeSeasonNumber])

  // Map Jellyfin episode progress
  const jellyfinEpisodesMap = useMemo(() => {
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
    return map
  }, [playerInfo?.episodes, activeSeasonNumber])

  const [mountingEpisode, setMountingEpisode] = useState<number | null>(null)
  const [mountTorrent] = useMountTorrentMutation()

  const isSeasonMounted = Boolean(
    mountStatus?.seasons?.includes(activeSeasonNumber) ||
    (playerInfo?.episodes && playerInfo.episodes.some((e) => e.season_number === activeSeasonNumber))
  )

  const handlePlayEpisode = async (episodeNumber: number) => {
    if (!isSeasonMounted) {
      setMountingEpisode(episodeNumber)
      const qualityOpts = getQualityOptions(
        torrents,
        mountStatus?.versions,
        activeSeasonNumber,
        true,
        mountStatus?.seasons
      )
      const bestOpt =
        qualityOpts.find((q) => q.isAvailable && q.bestTorrent) || qualityOpts[1]
      const best = bestOpt?.bestTorrent
      if (best && (best.magnet || best.id)) {
        try {
          await mountTorrent({
            tconst,
            title,
            ru_title: ruTitle,
            year: year ? year.toString() : undefined,
            type: "tvSeries",
            season: activeSeasonNumber,
            magnet: best.magnet,
            tracker: best.tracker || (best.trackers && best.trackers[0]),
            torrent_id: best.id,
            details_url: best.details_url,
            mode: "add_version",
            version_name: bestOpt.shortLabel,
            resolution: best.resolution,
            folder_name: mountStatus?.folder_name,
          }).unwrap()
        } catch (e) {
          console.error("Auto mount season failed:", e)
        }
      }
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
      {/* Quick Action & Quality Selector for the Active Season */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Сезон {activeSeasonNumber}
            </h3>
          </div>
          {isSeasonMounted && (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Смонтирован в Jellyfin
            </span>
          )}
        </div>

        <QualityActionButtons
          tconst={tconst}
          title={title}
          ruTitle={ruTitle}
          year={year}
          isSeries={true}
          targetSeason={activeSeasonNumber}
          targetEpisode={1}
          torrents={torrents}
          isLoadingTorrents={isLoadingTorrents}
        />
      </div>

      {/* Season Selection Tabs */}
      {validSeasons.length > 1 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-zinc-400 px-1">Сезоны:</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {validSeasons.map((s: SeriesSeasonItem) => {
              const isActive = s.season_number === activeSeasonNumber
              const isMounted = mountStatus?.seasons?.includes(s.season_number)

              return (
                <button
                  key={s.season_number}
                  type="button"
                  onClick={() => setSelectedSeason(s.season_number)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 border ${
                    isActive
                      ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40"
                      : "bg-cinema-850 hover:bg-cinema-800 border-border/70 text-zinc-300 hover:text-white"
                  }`}
                >
                  <span>{s.name || `Сезон ${s.season_number}`}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/40 text-zinc-400 font-mono">
                    {s.episode_count} эп.
                  </span>
                  {isMounted && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="В библиотеке" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Episodes List */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-zinc-300">
            Серии ({currentEpisodes.length}):
          </div>
          {isLoadingEpisodes && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Loader2 className="w-3 h-3 animate-spin" />
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
            const jfData = jellyfinEpisodesMap.get(ep.episode_number)
            const hasResume = jfData && jfData.resume_seconds > 10 && !jfData.is_played
            const stillUrl = ep.still_path
              ? `http://${window.location.hostname}:8090/poster${ep.still_path}`
              : undefined

            return (
              <div
                key={ep.episode_number}
                onClick={() => handlePlayEpisode(ep.episode_number)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handlePlayEpisode(ep.episode_number)
                  }
                }}
                className="group relative p-3 rounded-2xl border border-border/70 bg-cinema-900 hover:border-emerald-500/40 hover:bg-cinema-850/80 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row gap-3 items-start sm:items-center"
              >
                {/* Episode 16:9 Thumbnail */}
                <div className="relative w-full sm:w-44 aspect-[16/9] shrink-0 rounded-xl overflow-hidden bg-zinc-950 border border-border/60 flex items-center justify-center">
                  {stillUrl ? (
                    <img
                      src={stillUrl}
                      alt={ep.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-zinc-600 flex flex-col items-center">
                      <Tv className="w-6 h-6" />
                    </div>
                  )}

                  {/* Dark gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  {/* Episode Number badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] font-bold text-white backdrop-blur-md">
                    {ep.episode_number}
                  </div>

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

                  {/* Resume line inside thumbnail */}
                  {hasResume && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div className="h-full bg-emerald-400 w-1/3" />
                    </div>
                  )}
                </div>

                {/* Episode Details */}
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {ep.episode_number}. {ep.name || `Эпизод ${ep.episode_number}`}
                    </h4>
                    {jfData?.is_played && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        Просмотрено
                      </span>
                    )}
                  </div>

                  {ep.air_date && (
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Calendar className="w-3 h-3 opacity-60" />
                      <span>{formatDate(ep.air_date)}</span>
                    </div>
                  )}

                  {ep.overview && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {ep.overview}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
