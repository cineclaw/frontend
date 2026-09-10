import React, { useState, useMemo } from "react"
import { Play, Plus, Check, Loader2, Sparkles, AlertCircle } from "lucide-react"
import { useAppDispatch } from "@/store/store"
import { openCinemaPlayer } from "@/store/searchSlice"
import {
  useMountTorrentMutation,
  useGetMountedStatusQuery,
  type TorrentResult,
} from "@/api/torrentsApi"
import {
  getQualityOptions,
  type QualityTier,
  type QualityOption,
} from "@/lib/torrentSelector"
import { formatBytes } from "@/lib/utils"

interface QualityActionButtonsProps {
  tconst: string
  title: string
  ruTitle?: string
  year?: number | null
  isSeries?: boolean
  targetSeason?: number | null
  targetEpisode?: number | null
  torrents?: TorrentResult[]
  isLoadingTorrents?: boolean
}

function extractRuTitle(torrentTitle?: string): string | undefined {
  if (!torrentTitle) return undefined
  const slashIdx = torrentTitle.indexOf("/")
  let candidate = slashIdx !== -1 ? torrentTitle.slice(0, slashIdx).trim() : torrentTitle
  candidate = candidate.replace(/\s*[\(\[].*$/, "").trim()
  if (/[а-яёА-ЯЁ]/.test(candidate)) {
    return candidate
  }
  return undefined
}

export const QualityActionButtons: React.FC<QualityActionButtonsProps> = ({
  tconst,
  title,
  ruTitle,
  year,
  isSeries = false,
  targetSeason,
  targetEpisode,
  torrents,
  isLoadingTorrents = false,
}) => {
  const dispatch = useAppDispatch()
  const [mountTorrent, { isLoading: isMounting }] = useMountTorrentMutation()
  const { data: mountStatus } = useGetMountedStatusQuery(tconst, {
    skip: !tconst,
    pollingInterval: 5000,
  })

  const [mountSuccess, setMountSuccess] = useState<boolean>(false)
  const [mountError, setMountError] = useState<string | null>(null)

  // Compute quality options
  const qualityOptions = useMemo(() => {
    return getQualityOptions(torrents, mountStatus?.versions, targetSeason, isSeries, mountStatus?.seasons)
  }, [torrents, mountStatus?.versions, targetSeason, isSeries, mountStatus?.seasons])

  // Determine initial selected quality
  const [selectedQuality, setSelectedQuality] = useState<QualityTier>(() => {
    // 1. If mounted in 4k or 1080p, pick that
    const mounted = qualityOptions.find((q) => q.isMounted)
    if (mounted) return mounted.tier
    // 2. Otherwise pick 1080p if available, else 4k, else first available
    const opt1080 = qualityOptions.find((q) => q.tier === "1080p" && q.isAvailable)
    if (opt1080) return "1080p"
    const opt4k = qualityOptions.find((q) => q.tier === "4k" && q.isAvailable)
    if (opt4k) return "4k"
    const firstAvail = qualityOptions.find((q) => q.isAvailable)
    return firstAvail ? firstAvail.tier : "1080p"
  })

  // Ensure selected quality is updated if options change and current isn't available
  const activeOption: QualityOption | undefined =
    qualityOptions.find((q) => q.tier === selectedQuality) ||
    qualityOptions.find((q) => q.isAvailable) ||
    qualityOptions[1]

  const isCurrentQualityMounted = Boolean(activeOption?.isMounted)

  const handleWatch = async () => {
    setMountError(null)

    // 1. If already mounted, immediately launch player
    if (isCurrentQualityMounted) {
      dispatch(
        openCinemaPlayer({
          tconst,
          title,
          ruTitle,
          initialSeason: targetSeason || undefined,
          initialEpisode: targetEpisode || undefined,
        })
      )
      return
    }

    // 2. If not mounted, find best torrent and trigger auto-mount with add_version
    const best = activeOption?.bestTorrent
    if (!best || (!best.magnet && !best.id)) {
      setMountError("Раздача для выбранного качества не найдена")
      return
    }

    try {
      // Trigger mount with add_version
      await mountTorrent({
        tconst,
        title,
        ru_title: extractRuTitle(best.title) || ruTitle,
        year: year ? year.toString() : undefined,
        type: isSeries ? "tvSeries" : "movie",
        season: targetSeason ?? undefined,
        magnet: best.magnet,
        tracker: best.tracker || (best.trackers && best.trackers[0]),
        torrent_id: best.id,
        details_url: best.details_url,
        mode: "add_version",
        version_name: activeOption?.shortLabel,
        resolution: best.resolution,
        folder_name: mountStatus?.folder_name,
      }).unwrap()

      // Launch player immediately - it has Jellyfin auto-sync polling built in!
      dispatch(
        openCinemaPlayer({
          tconst,
          title,
          ruTitle,
          initialSeason: targetSeason || undefined,
          initialEpisode: targetEpisode || undefined,
        })
      )
    } catch (err: any) {
      console.error("Auto mount failed:", err)
      setMountError(err?.data?.error || err?.message || "Ошибка монтирования торрента")
    }
  }

  const handleAdd = async () => {
    setMountError(null)
    const best = activeOption?.bestTorrent
    if (!best || (!best.magnet && !best.id)) {
      setMountError("Нет доступной раздачи для добавления")
      return
    }

    try {
      await mountTorrent({
        tconst,
        title,
        ru_title: extractRuTitle(best.title) || ruTitle,
        year: year ? year.toString() : undefined,
        type: isSeries ? "tvSeries" : "movie",
        season: targetSeason ?? undefined,
        magnet: best.magnet,
        tracker: best.tracker || (best.trackers && best.trackers[0]),
        torrent_id: best.id,
        details_url: best.details_url,
        mode: "add_version",
        version_name: activeOption?.shortLabel,
        resolution: best.resolution,
        folder_name: mountStatus?.folder_name,
      }).unwrap()

      setMountSuccess(true)
      setTimeout(() => setMountSuccess(false), 4000)
    } catch (err: any) {
      console.error("Add failed:", err)
      setMountError(err?.data?.error || err?.message || "Ошибка добавления в медиатеку")
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-cinema-900/90 backdrop-blur-xl shadow-2xl space-y-4 text-left">
      {/* Quality Pills Selector Row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400">Выберите качество:</span>
          {isLoadingTorrents && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Поиск раздач...
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {qualityOptions.map((opt) => {
            const isSelected = opt.tier === selectedQuality
            const isMounted = opt.isMounted
            const isAvail = opt.isAvailable

            return (
              <button
                key={opt.tier}
                type="button"
                onClick={() => setSelectedQuality(opt.tier)}
                disabled={!isAvail && !isMounted}
                className={`relative py-2 px-1.5 sm:px-2 rounded-xl text-center text-xs font-bold transition-all duration-200 border flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500/60 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                    : isAvail || isMounted
                    ? "bg-cinema-850/80 border-border/70 text-zinc-300 hover:bg-cinema-800 hover:text-white"
                    : "bg-cinema-950/40 border-border/30 text-zinc-600 opacity-40 cursor-not-allowed"
                }`}
              >
                <span className="flex items-center gap-1 truncate">
                  {opt.tier === "4k" && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                  {opt.shortLabel}
                </span>

                {/* Sub status dot */}
                <div className="flex items-center gap-1 text-[10px] font-normal">
                  {isMounted ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      В медиатеке
                    </span>
                  ) : opt.bestTorrent ? (
                    <span className="text-zinc-400 font-mono">
                      🌱 {opt.seeders}
                    </span>
                  ) : (
                    <span className="text-zinc-500">нет</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Quality Release Metadata Pill */}
      {activeOption?.bestTorrent && (
        <div className="px-3 py-1.5 rounded-xl bg-cinema-850/60 border border-border/60 text-[11px] text-zinc-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-white">{activeOption.shortLabel}</span>
            <span className="text-zinc-500">•</span>
            <span>{formatBytes(activeOption.sizeBytes)}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-emerald-400 font-medium">🌱 {activeOption.seeders} сидов</span>
          </div>
          {activeOption.audioLabel && (
            <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 font-semibold text-[10px] shrink-0 border border-white/5">
              {activeOption.audioLabel}
            </span>
          )}
        </div>
      )}

      {/* Error message banner */}
      {mountError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{mountError}</span>
        </div>
      )}

      {/* Main Two Action Buttons: [ ▶ Смотреть ] and [ ＋ Добавить ] */}
      <div className="flex items-center gap-2.5 pt-0.5">
        {/* Play / Watch Button */}
        <button
          type="button"
          onClick={handleWatch}
          disabled={isMounting || (!activeOption?.isAvailable && !isCurrentQualityMounted)}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-[0.98] text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMounting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Подготовка...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>
                {isCurrentQualityMounted
                  ? `Смотреть (${activeOption?.shortLabel})`
                  : `Смотреть в ${activeOption?.shortLabel || "HD"}`}
              </span>
            </>
          )}
        </button>

        {/* Add to Library Button */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isMounting || isCurrentQualityMounted || mountSuccess || !activeOption?.bestTorrent}
          title={isCurrentQualityMounted ? "Уже добавлено в медиатеку" : "Добавить в медиатеку"}
          className={`py-3 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-200 border ${
            isCurrentQualityMounted || mountSuccess
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 cursor-default"
              : "bg-cinema-850 hover:bg-cinema-800 border-border/80 text-zinc-200 hover:text-white active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {isMounting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isCurrentQualityMounted || mountSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">В медиатеке</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Добавить</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
