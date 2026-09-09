import { useState, useMemo } from "react"
import {
  Download,
  ExternalLink,
  Magnet,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Check,
  HardDrive,
  Layers,
  AlertCircle,
  Tv,
  Monitor,
  Plus,
  Loader2,
} from "lucide-react"
import {
  useGetTorrentsQuery,
  useForceRefreshTorrentsMutation,
  useMountTorrentMutation,
  useGetMountedStatusQuery,
} from "@/api/torrentsApi"
import { useGetSeriesSeasonsQuery } from "@/api/moviesApi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MountConflictDialog } from "./MountConflictDialog"

interface TorrentListProps {
  query: string
  imdbId: string
  year?: number | null
  isSeries?: boolean
}

function extractRuTitle(torrentTitle: string): string | undefined {
  if (!torrentTitle) return undefined
  const slashIdx = torrentTitle.indexOf("/")
  let candidate = slashIdx !== -1 ? torrentTitle.slice(0, slashIdx).trim() : torrentTitle
  candidate = candidate.replace(/\s*[\(\[].*$/, "").trim()
  if (/[а-яёА-ЯЁ]/.test(candidate)) {
    return candidate
  }
  return undefined
}

export function TorrentList({ query, imdbId, year, isSeries }: TorrentListProps) {
  const [selectedTracker, setSelectedTracker] = useState<string>("all")
  const [selectedResolution, setSelectedResolution] = useState<string>("all")
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [copiedMagnet, setCopiedMagnet] = useState<string | null>(null)

  // Fetch seasons metadata from TMDB (via imdb-indexer) for TV series
  const { currentData: seriesData } = useGetSeriesSeasonsQuery(imdbId, {
    skip: !isSeries,
  })

  // Initial query with bbolt cache on backend
  const {
    currentData: torrents,
    isLoading,
    isError,
    isFetching,
  } = useGetTorrentsQuery({
    q: query,
    imdb_id: imdbId,
    type: isSeries ? 'tv' : 'movie',
    limit: 100,
  })

  // Trigger for force refreshing backend cache and updating Redux store
  const [forceRefresh, { isLoading: isForceRefreshing, data: refreshedTorrents }] =
    useForceRefreshTorrentsMutation()

  const handleRefresh = () => {
    forceRefresh({
      q: query,
      imdb_id: imdbId,
      type: isSeries ? 'tv' : 'movie',
      limit: 100,
    })
  }


  const handleCopyMagnet = (magnet: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(magnet)
    setCopiedMagnet(magnet)
    setTimeout(() => setCopiedMagnet(null), 2000)
  }

  const [mountTorrent] = useMountTorrentMutation()
  const [mountingTorrentId, setMountingTorrentId] = useState<string | null>(null)
  const [mountedTorrentIds, setMountedTorrentIds] = useState<Set<string>>(new Set())
  const [mountErrors, setMountErrors] = useState<Record<string, string>>({})

  const { data: mountStatus } = useGetMountedStatusQuery(imdbId)
  const [conflictTorrent, setConflictTorrent] = useState<any | null>(null)
  const [conflictTargetSeason, setConflictTargetSeason] = useState<number | null>(null)
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState<boolean>(false)

  const executeMount = async (
    torrent: any,
    targetSeason: number | null,
    mode: "add" | "replace" | "add_version",
    versionName?: string
  ) => {
    const tId = torrent.info_hash || torrent.id
    setMountingTorrentId(tId)
    setMountErrors((prev) => {
      const next = { ...prev }
      delete next[tId]
      return next
    })

    try {
      await mountTorrent({
        tconst: imdbId,
        title: query,
        ru_title: torrent.ru_title || extractRuTitle(torrent.title),
        year: year ? year.toString() : undefined,
        type: isSeries ? "tvSeries" : "movie",
        season: targetSeason ?? undefined,
        magnet: torrent.magnet || undefined,
        tracker: torrent.tracker,
        torrent_id: torrent.id,
        details_url: torrent.details_url,
        mode,
        version_name: versionName,
        resolution: torrent.resolution,
        folder_name: mountStatus?.folder_name,
      }).unwrap()

      setMountedTorrentIds((prev) => new Set(prev).add(tId))
      window.open(`http://${window.location.hostname}:8096`, "_blank")
      setIsConflictDialogOpen(false)
    } catch (err: any) {
      console.error("Failed to mount torrent for streaming:", err)
      const errMsg =
        err?.data?.error || err?.error || err?.message || "Ошибка монтирования в Jellyfin"
      setMountErrors((prev) => ({ ...prev, [tId]: errMsg }))
    } finally {
      setMountingTorrentId(null)
    }
  }

  const handleStreamToJellyfin = async (torrent: any, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!torrent.magnet && !torrent.id) return

    const tId = torrent.info_hash || torrent.id
    if (mountedTorrentIds.has(tId)) {
      window.open(`http://${window.location.hostname}:8096`, "_blank")
      return
    }

    const isMultiSeason =
      (torrent.seasons && torrent.seasons.length > 1) || torrent.is_complete
    const targetSeason = isMultiSeason
      ? null
      : selectedSeason || (torrent.seasons?.[0] ?? null)

    // Check conflict against currently mounted library
    let hasConflict = false
    if (mountStatus?.mounted) {
      if (!isSeries) {
        hasConflict = true
      } else {
        if (isMultiSeason) {
          hasConflict = Boolean(
            mountStatus.seasons && mountStatus.seasons.length > 0
          )
        } else if (targetSeason !== null) {
          hasConflict = Boolean(
            mountStatus.seasons && mountStatus.seasons.includes(targetSeason)
          )
        }
      }
    }

    if (hasConflict) {
      setConflictTorrent(torrent)
      setConflictTargetSeason(targetSeason)
      setIsConflictDialogOpen(true)
      return
    }

    // No conflict: mount directly with mode "add"
    await executeMount(torrent, targetSeason, "add")
  }

  const items = refreshedTorrents || torrents || []

  // Tracker filter counts
  const trackerCounts = {
    all: items.length,
    rutracker: items.filter((t) => (t.trackers ? t.trackers.includes("rutracker") : t.tracker === "rutracker")).length,
    nnmclub: items.filter((t) => (t.trackers ? t.trackers.includes("nnmclub") : t.tracker === "nnmclub")).length,
    rutor: items.filter((t) => (t.trackers ? t.trackers.includes("rutor") : t.tracker === "rutor")).length,
  }

  // Resolution filter counts
  const resCounts = {
    all: items.length,
    "4k": items.filter((t) => t.resolution === "4k").length,
    "1080p": items.filter((t) => t.resolution === "1080p").length,
    lq: items.filter((t) => t.resolution === "lq" || !t.resolution).length,
  }

  // Build sorted list of seasons from TMDB and any detected from torrent titles
  const seasonsList = useMemo(() => {
    if (!isSeries) return []

    const seasonMap = new Map<number, { season_number: number; name?: string; episode_count?: number }>()

    if (seriesData?.seasons) {
      for (const s of seriesData.seasons) {
        if (s.season_number > 0) {
          seasonMap.set(s.season_number, {
            season_number: s.season_number,
            name: s.name,
            episode_count: s.episode_count,
          })
        }
      }
    }

    // Also include any seasons parsed from torrent releases
    for (const t of items) {
      if (t.seasons) {
        for (const sNum of t.seasons) {
          if (sNum > 0 && !seasonMap.has(sNum)) {
            seasonMap.set(sNum, {
              season_number: sNum,
              name: `Сезон ${sNum}`,
            })
          }
        }
      }
    }

    return Array.from(seasonMap.values()).sort((a, b) => a.season_number - b.season_number)
  }, [isSeries, seriesData, items])

  // Filter and two-tier rank torrents reactively (0 ms client-side)
  const filteredTorrents = useMemo(() => {
    // 1. Tracker filter
    let list = selectedTracker === "all"
      ? items
      : items.filter((t) => (t.trackers ? t.trackers.includes(selectedTracker) : t.tracker === selectedTracker))

    // 2. Resolution filter
    if (selectedResolution !== "all") {
      list = list.filter((t) => {
        if (selectedResolution === "lq") {
          return t.resolution === "lq" || !t.resolution
        }
        return t.resolution === selectedResolution
      })
    }

    // 3. Season filter & ranking
    if (isSeries && selectedSeason !== null) {
      list = list.filter((t) => {
        const hasSeason = t.seasons && t.seasons.includes(selectedSeason)
        const isComplete = t.is_complete
        return hasSeason || isComplete
      })

      return [...list].sort((a, b) => {
        // Tier 1: exact single-season (seasons.length === 1 && seasons[0] === selectedSeason && !is_complete)
        const aExact = (a.seasons?.length === 1 && a.seasons[0] === selectedSeason && !a.is_complete) ? 1 : 0
        const bExact = (b.seasons?.length === 1 && b.seasons[0] === selectedSeason && !b.is_complete) ? 1 : 0

        if (aExact !== bExact) {
          return bExact - aExact // Tier 1 first
        }
        return b.seeds - a.seeds
      })
    }

    // Default sort by seeds descending
    return [...list].sort((a, b) => b.seeds - a.seeds)
  }, [items, selectedTracker, selectedResolution, isSeries, selectedSeason])

  // Counts for active season
  const exactSeasonCount = useMemo(() => {
    if (selectedSeason === null) return 0
    return items.filter(
      (t) => t.seasons?.length === 1 && t.seasons[0] === selectedSeason && !t.is_complete
    ).length
  }, [items, selectedSeason])

  const packSeasonCount = useMemo(() => {
    if (selectedSeason === null) return 0
    return items.filter(
      (t) => ((t.seasons && t.seasons.includes(selectedSeason) && t.seasons.length > 1) || t.is_complete)
    ).length
  }, [items, selectedSeason])

  const isBusy = isLoading || isFetching || isForceRefreshing

  return (
    <div className="mt-6 pt-5 border-t border-border/60 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-base font-bold text-foreground">Торрент-раздачи</h3>
          {!isLoading && items.length > 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono">
              {filteredTorrents.length} {filteredTorrents.length !== items.length ? `из ${items.length}` : ""}
            </Badge>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isBusy}
            className="h-8 px-2.5 text-xs gap-1.5 border-border/70 hover:bg-cinema-850 hover:text-foreground"
            title="Принудительно обновить кэш и пересканировать трекеры"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin text-primary" : ""}`} />
            <span>{isBusy ? "Поиск..." : "Обновить"}</span>
          </Button>
        </div>
      </div>

      {/* Season Selector Tabs (TV Series Only) */}
      {isSeries && seasonsList.length > 0 && (
        <div className="mb-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Tv className="h-3.5 w-3.5 text-primary" />
            <span>Сезоны:</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedSeason(null)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                selectedSeason === null
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "bg-cinema-850 text-zinc-400 hover:text-zinc-200 border border-border/50"
              }`}
            >
              <span>Все сезоны</span>
              <span className="text-[10px] opacity-75 font-mono">({items.length})</span>
            </button>

            {seasonsList.map((s) => {
              const count = items.filter(
                (t) => (t.seasons && t.seasons.includes(s.season_number)) || t.is_complete
              ).length
              const isSelected = selectedSeason === s.season_number

              return (
                <button
                  key={s.season_number}
                  onClick={() => setSelectedSeason(s.season_number)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : count > 0
                      ? "bg-cinema-850 text-zinc-300 hover:text-white border border-border/60 hover:border-border"
                      : "bg-cinema-900/40 text-zinc-500 border border-border/30 hover:text-zinc-400"
                  }`}
                >
                  <span>{s.season_number} сезон</span>
                  {s.episode_count ? (
                    <span className="text-[10px] opacity-65">({s.episode_count} сер.)</span>
                  ) : null}
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                        isSelected
                          ? "bg-black/30 text-white"
                          : "bg-cinema-800 text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Season Info Banner */}
      {selectedSeason !== null && (
        <div className="flex items-center justify-between text-xs py-1.5 px-3 mb-3 rounded-lg bg-cinema-850/70 border border-border/60">
          <span className="text-zinc-300">
            Выбран <strong className="text-primary font-bold">{selectedSeason} сезон</strong>:{" "}
            <span className="text-sky-400 font-semibold">{exactSeasonCount} отдельных</span>
            {packSeasonCount > 0 && (
              <>
                {" + "}
                <span className="text-indigo-400 font-semibold">{packSeasonCount} в сборниках/паках</span>
              </>
            )}
          </span>
          <button
            onClick={() => setSelectedSeason(null)}
            className="text-zinc-400 hover:text-zinc-200 text-[11px] underline"
          >
            Показать все
          </button>
        </div>
      )}

      {/* Resolution Filter Tabs */}
      {!isLoading && items.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5 text-xs overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 flex-nowrap sm:flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 mr-1 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <Monitor className="h-3 w-3 text-primary" />
            Качество:
          </span>
          <button
            onClick={() => setSelectedResolution("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap ${
              selectedResolution === "all"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "bg-cinema-850 text-zinc-400 hover:text-zinc-200 border border-border/50"
            }`}
          >
            Все ({resCounts.all})
          </button>
          {resCounts["4k"] > 0 && (
            <button
              onClick={() => setSelectedResolution("4k")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1 ${
                selectedResolution === "4k"
                  ? "bg-amber-500 text-black shadow-sm font-bold"
                  : "bg-cinema-850 text-amber-400 hover:text-amber-300 border border-amber-500/30"
              }`}
            >
              <span>4K UHD</span>
              <span className="text-[10px] opacity-80 font-mono">({resCounts["4k"]})</span>
            </button>
          )}
          {resCounts["1080p"] > 0 && (
            <button
              onClick={() => setSelectedResolution("1080p")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1 ${
                selectedResolution === "1080p"
                  ? "bg-sky-500 text-white shadow-sm font-semibold"
                  : "bg-cinema-850 text-sky-400 hover:text-sky-300 border border-sky-500/30"
              }`}
            >
              <span>1080p</span>
              <span className="text-[10px] opacity-80 font-mono">({resCounts["1080p"]})</span>
            </button>
          )}
          {resCounts.lq > 0 && (
            <button
              onClick={() => setSelectedResolution("lq")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1 ${
                selectedResolution === "lq"
                  ? "bg-zinc-600 text-white shadow-sm font-semibold"
                  : "bg-cinema-850 text-zinc-400 hover:text-zinc-200 border border-border/50"
              }`}
            >
              <span>LQ (остальные)</span>
              <span className="text-[10px] opacity-80 font-mono">({resCounts.lq})</span>
            </button>
          )}
        </div>
      )}

      {/* Tracker Filter Tabs */}
      {!isLoading && items.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-xs overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 flex-nowrap sm:flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 mr-1 shrink-0 whitespace-nowrap">
            Трекер:
          </span>
          <button
            onClick={() => setSelectedTracker("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap ${
              selectedTracker === "all"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "bg-cinema-850 text-zinc-400 hover:text-zinc-200 border border-border/50"
            }`}
          >
            Все ({trackerCounts.all})
          </button>
          {trackerCounts.rutracker > 0 && (
            <button
              onClick={() => setSelectedTracker("rutracker")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap ${
                selectedTracker === "rutracker"
                  ? "bg-sky-500 text-white shadow-sm font-semibold"
                  : "bg-cinema-850 text-zinc-400 hover:text-sky-300 border border-border/50"
              }`}
            >
              RuTracker ({trackerCounts.rutracker})
            </button>
          )}
          {trackerCounts.nnmclub > 0 && (
            <button
              onClick={() => setSelectedTracker("nnmclub")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap ${
                selectedTracker === "nnmclub"
                  ? "bg-purple-500 text-white shadow-sm font-semibold"
                  : "bg-cinema-850 text-zinc-400 hover:text-purple-300 border border-border/50"
              }`}
            >
              NNM-Club ({trackerCounts.nnmclub})
            </button>
          )}
          {trackerCounts.rutor > 0 && (
            <button
              onClick={() => setSelectedTracker("rutor")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 whitespace-nowrap ${
                selectedTracker === "rutor"
                  ? "bg-emerald-500 text-white shadow-sm font-semibold"
                  : "bg-cinema-850 text-zinc-400 hover:text-emerald-300 border border-border/50"
              }`}
            >
              RuTor ({trackerCounts.rutor})
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isBusy && items.length === 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Сканируем RuTracker, RuTor и NNM-Club...</span>
          </div>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-16 rounded-xl bg-cinema-850/50 border border-border/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && items.length === 0 && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-center">
          <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-1.5" />
          <p className="text-xs text-destructive font-medium">
            Не удалось загрузить список торрентов
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-2 text-xs h-7 gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Повторить
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isBusy && !isError && filteredTorrents.length === 0 && (
        <div className="py-8 text-center border border-dashed border-border/60 rounded-xl bg-cinema-950/30">
          <HardDrive className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-400">
            {selectedSeason !== null || selectedResolution !== "all" || selectedTracker !== "all"
              ? "По выбранным фильтрам раздачи не найдены"
              : "Раздачи не найдены"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedSeason !== null || selectedResolution !== "all" || selectedTracker !== "all" ? (
              <button
                onClick={() => {
                  setSelectedSeason(null)
                  setSelectedResolution("all")
                  setSelectedTracker("all")
                }}
                className="text-primary hover:underline"
              >
                Сбросить фильтры
              </button>
            ) : (
              "Попробуйте выполнить принудительный поиск"
            )}
          </p>
          {selectedSeason === null && selectedResolution === "all" && selectedTracker === "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-3 text-xs h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Искать снова
            </Button>
          )}
        </div>
      )}

      {/* Results List (Flows with page on mobile; scrollable box on desktop) */}
      {filteredTorrents.length > 0 && (
        <div className="space-y-2.5 w-full min-w-0 md:max-h-96 md:overflow-y-auto md:overflow-x-hidden md:pr-1.5 md:custom-scrollbar">
          {filteredTorrents.map((torrent) => {
            const effectiveTrackers = torrent.trackers && torrent.trackers.length > 0
              ? torrent.trackers
              : [torrent.tracker]
            const isMerged = effectiveTrackers.length > 1

            return (
              <div
                key={`${effectiveTrackers.join("-")}-${torrent.id}`}
                className="p-3 rounded-xl border border-border/60 bg-cinema-850/60 hover:bg-cinema-850 hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-left w-full min-w-0"
              >
                {/* Left: Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* Tracker Badges */}
                    {effectiveTrackers.map((tr) => {
                      if (tr === "rutracker") {
                        return (
                          <span
                            key={tr}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30"
                          >
                            RuTracker
                          </span>
                        )
                      }
                      if (tr === "rutor") {
                        return (
                          <span
                            key={tr}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          >
                            RuTor
                          </span>
                        )
                      }
                      if (tr === "nnmclub") {
                        return (
                          <span
                            key={tr}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30"
                          >
                            NNM-Club
                          </span>
                        )
                      }
                      return (
                        <span
                          key={tr}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-zinc-800 text-zinc-300 border border-zinc-700"
                        >
                          {tr}
                        </span>
                      )
                    })}

                    {isMerged && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/35 shadow-sm"
                        title={`Раздача найдена на ${effectiveTrackers.length} трекерах и объединена`}
                      >
                        Склеено ({effectiveTrackers.length})
                      </span>
                    )}

                    {/* Resolution Badge */}
                    {torrent.resolution === "4k" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                        4K UHD
                      </span>
                    )}
                    {torrent.resolution === "1080p" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        1080p
                      </span>
                    )}
                    {(torrent.resolution === "lq" || !torrent.resolution) && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                        LQ
                      </span>
                    )}

                    {/* Season Badges */}
                    {torrent.seasons && torrent.seasons.length === 1 && !torrent.is_complete && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        {torrent.seasons[0]} сезон
                      </span>
                    )}
                    {torrent.seasons && torrent.seasons.length > 1 && !torrent.is_complete && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Сезоны {torrent.seasons[0]}-{torrent.seasons[torrent.seasons.length - 1]}
                      </span>
                    )}
                    {torrent.is_complete && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Все сезоны
                      </span>
                    )}

                    {/* Size */}
                    <span className="text-xs font-semibold text-zinc-300 font-mono">
                      {torrent.size_human}
                    </span>

                    {/* Seeds / Leeches */}
                    <span
                      className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 cursor-default"
                      title={
                        torrent.sources && torrent.sources.length > 1
                          ? `Сиды по трекерам: ${torrent.sources
                              .map(
                                (s) =>
                                  `${s.tracker === "rutracker" ? "RuTracker" : s.tracker === "rutor" ? "RuTor" : "NNM-Club"}: ${s.seeds}`
                              )
                              .join(", ")}`
                          : undefined
                      }
                    >
                      <ArrowUp className="h-3 w-3" />
                      {torrent.seeds}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs font-mono text-zinc-500 cursor-default"
                      title={
                        torrent.sources && torrent.sources.length > 1
                          ? `Пиры по трекерам: ${torrent.sources
                              .map(
                                (s) =>
                                  `${s.tracker === "rutracker" ? "RuTracker" : s.tracker === "rutor" ? "RuTor" : "NNM-Club"}: ${s.leeches}`
                              )
                              .join(", ")}`
                          : undefined
                      }
                    >
                      <ArrowDown className="h-3 w-3" />
                      {torrent.leeches}
                    </span>

                    {/* Category */}
                    {torrent.category && (
                      <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                        • {torrent.category}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <a
                    href={torrent.details_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-zinc-200 hover:text-primary transition-colors line-clamp-2 break-words block leading-relaxed"
                    title={torrent.title}
                  >
                    {torrent.title}
                  </a>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap self-start md:self-center">
                  {/* Add to Jellyfin Button */}
                  {torrent.magnet || torrent.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        size="sm"
                        className={`h-9 sm:h-8 px-3 sm:px-2.5 text-xs gap-1.5 transition-all font-semibold active:scale-95 shadow-sm ${
                          mountErrors[torrent.info_hash || torrent.id]
                            ? "bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30"
                            : mountedTorrentIds.has(torrent.info_hash || torrent.id)
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30"
                            : "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 hover:text-white"
                        }`}
                        disabled={mountingTorrentId === (torrent.info_hash || torrent.id)}
                        onClick={(e) => handleStreamToJellyfin(torrent, e)}
                        title={
                          mountErrors[torrent.info_hash || torrent.id]
                            ? `Ошибка: ${mountErrors[torrent.info_hash || torrent.id]}. Нажмите, чтобы повторить.`
                            : mountedTorrentIds.has(torrent.info_hash || torrent.id)
                            ? "Открыть в Jellyfin"
                            : "Добавить в библиотеку Jellyfin"
                        }
                      >
                        {mountingTorrentId === (torrent.info_hash || torrent.id) ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Монтирование...</span>
                          </>
                        ) : mountErrors[torrent.info_hash || torrent.id] ? (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                            <span>Повторить</span>
                          </>
                        ) : mountedTorrentIds.has(torrent.info_hash || torrent.id) ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>В Jellyfin</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Добавить</span>
                          </>
                        )}
                      </Button>
                      {mountErrors[torrent.info_hash || torrent.id] && (
                        <span
                          className="text-[10px] text-rose-400 max-w-[170px] truncate"
                          title={mountErrors[torrent.info_hash || torrent.id]}
                        >
                          {mountErrors[torrent.info_hash || torrent.id]}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Magnet Button */}
                  {torrent.magnet ? (
                    <div className="flex items-center gap-1">
                      <a
                        href={torrent.magnet}
                        className="inline-flex"
                        title={
                          isMerged
                            ? "Открыть мульти-трекерный Magnet (подключается ко всем трекерам одновременно)"
                            : "Открыть Magnet в торрент-клиенте"
                        }
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2.5 text-xs gap-1.5 bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30"
                        >
                          <Magnet className="h-3.5 w-3.5" />
                          <span className="hidden md:inline">
                            {isMerged ? "Мульти-Magnet" : "Magnet"}
                          </span>
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                        onClick={(e) => handleCopyMagnet(torrent.magnet!, e)}
                        title="Скопировать Magnet-ссылку"
                      >
                        {copiedMagnet === torrent.magnet ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <span className="text-[10px] font-mono">copy</span>
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {/* Download .torrent button */}
                  {torrent.download_url ? (
                    <a
                      href={torrent.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                      title="Скачать .torrent файл"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs gap-1.5 border-border/70 text-zinc-300 hover:text-white hover:bg-cinema-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">.torrent</span>
                      </Button>
                    </a>
                  ) : null}

                  {/* Open Tracker Topic(s) */}
                  {torrent.sources && torrent.sources.length > 1 ? (
                    <div className="flex items-center gap-1">
                      {torrent.sources.map((src) => {
                        const label =
                          src.tracker === "rutracker"
                            ? "RT"
                            : src.tracker === "rutor"
                            ? "RU"
                            : "NNM"
                        const fullName =
                          src.tracker === "rutracker"
                            ? "RuTracker"
                            : src.tracker === "rutor"
                            ? "RuTor"
                            : "NNM-Club"
                        return (
                          <a
                            key={src.tracker}
                            href={src.details_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-bold text-zinc-300 hover:text-white bg-cinema-800 hover:bg-cinema-700 transition-colors border border-border/70"
                            title={`Перейти к теме на ${fullName}`}
                          >
                            <span>{label}</span>
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <a
                      href={torrent.details_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-cinema-800 transition-colors"
                      title="Перейти к теме на трекере"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <MountConflictDialog
        open={isConflictDialogOpen}
        onOpenChange={setIsConflictDialogOpen}
        torrent={conflictTorrent}
        isSeries={isSeries}
        targetSeason={conflictTargetSeason}
        existingVersions={mountStatus?.versions}
        onConfirm={(mode, versionName) =>
          executeMount(conflictTorrent, conflictTargetSeason, mode, versionName)
        }
        isMounting={
          mountingTorrentId ===
          (conflictTorrent?.info_hash || conflictTorrent?.id)
        }
      />
    </div>
  )
}
