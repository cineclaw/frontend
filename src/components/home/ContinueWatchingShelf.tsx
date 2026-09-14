import React, { useState, useEffect, useMemo, useRef } from "react"
import { Play, PlayCircle, Clock, Sparkles, X, Trash2 } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { openCinemaPlayer } from "@/store/searchSlice"
import { useGetResumeItemsQuery, useDeleteResumeItemMutation, type ResumeItem } from "@/api/torrentsApi"

const resolveThumbnail = (item: ResumeItem): string => {
  if (item.image_url) {
    if (
      item.image_url.startsWith("http://") ||
      item.image_url.startsWith("https://")
    ) {
      return item.image_url
    }
    if (item.image_url.startsWith("/") && !item.image_url.startsWith("/poster/")) {
      return `https://image.tmdb.org/t/p/w780${item.image_url}`
    }
  }
  return ""
}

interface ContinueWatchingCardProps {
  item: ResumeItem
  onPlay: (item: ResumeItem) => void
  onRemove: (item: ResumeItem) => void
  formatRemainingMinutes: (duration: number, resume: number) => string
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  item,
  onPlay,
  onRemove,
  formatRemainingMinutes,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(() => resolveThumbnail(item))
  const [hasError, setHasError] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setImageSrc(resolveThumbnail(item))
    setHasError(false)
  }, [item.image_url, item.tconst])

  // Reset confirmation after 6 seconds of inactivity
  useEffect(() => {
    if (!isConfirming) return
    const timer = setTimeout(() => {
      setIsConfirming(false)
    }, 6000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  const handleImageError = () => {
    setHasError(true)
  }

  // Mobile long-press handler to open deletion overlay
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsConfirming(true)
    }, 450)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  // Robust percentage calculation directly from resume / duration seconds
  const percent = item.duration_seconds > 0
    ? Math.min(100, Math.max(3, Math.round((item.resume_seconds / item.duration_seconds) * 100)))
    : Math.min(100, Math.max(3, Math.round(item.played_percentage)))

  const remainingText = formatRemainingMinutes(item.duration_seconds, item.resume_seconds)

  return (
    <div
      onClick={() => {
        if (!isConfirming) {
          onPlay(item)
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!isConfirming) {
            onPlay(item)
          }
        }
      }}
      className="group relative w-60 sm:w-72 shrink-0 aspect-[16/9] rounded-2xl border border-border/80 bg-cinema-900 overflow-hidden cursor-pointer shadow-xl hover:border-emerald-500/50 hover:shadow-emerald-950/40 transition-all duration-200 active:scale-[0.98] snap-start flex flex-col justify-between select-none"
    >
      {/* Background Thumbnail Image or Fallback */}
      {imageSrc && !hasError ? (
        <img
          src={imageSrc}
          alt=""
          role="presentation"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={handleImageError}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-cinema-900 via-cinema-850 to-cinema-950 flex items-center justify-center opacity-40">
          <PlayCircle className="w-12 h-12 text-white/20" />
        </div>
      )}

      {/* Gradient Darkening Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 group-hover:via-black/30 transition-colors pointer-events-none" />

      {/* Top Meta Pill */}
      <div className="relative z-10 p-2.5 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-[10px] sm:text-[11px] font-semibold text-emerald-400 backdrop-blur-md">
          {item.media_type === "Episode"
            ? `S${item.season_number}:E${item.episode_number}`
            : "Фильм"}
        </span>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {item.is_next_up ? (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30 backdrop-blur-md shadow-sm">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Далее</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-zinc-300 bg-black/60 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-md">
              <Clock className="w-2.5 h-2.5 opacity-70" />
              <span>{remainingText}</span>
            </div>
          )}

          {/* Ergonomic Delete Trigger Button (Comfortable 28px touch target, visible on mobile) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsConfirming(true)
            }}
            title="Удалить из «Продолжить просмотр»"
            aria-label="Удалить из «Продолжить просмотр»"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/70 hover:bg-red-500/20 active:bg-red-500/40 text-zinc-400 hover:text-red-300 border border-white/15 hover:border-red-500/40 backdrop-blur-md transition-all sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Play Button Splash on Hover */}
      <div className="absolute inset-0 z-10 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="p-3.5 rounded-full bg-emerald-500/90 text-black shadow-lg shadow-emerald-500/30 group-hover:scale-110 group-hover:bg-emerald-400 transition-transform duration-200">
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </div>
      </div>

      {/* Bottom Details & Progress Bar */}
      <div className="relative z-10 p-3 space-y-1.5 pointer-events-none">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-extrabold text-white truncate drop-shadow-md">
            {item.title || item.series_name || "Без названия"}
          </h3>
          {item.episode_title && item.media_type === "Episode" && (
            <p className="text-[11px] text-zinc-300 truncate font-medium drop-shadow-sm">
              {item.is_next_up ? `Далее: ${item.episode_title}` : item.episode_title}
            </p>
          )}
        </div>

        {/* Progress Bar (only for in-progress items) */}
        {!item.is_next_up ? (
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : (
          <div className="text-[10px] text-cyan-400/90 font-medium">
            Готово к просмотру
          </div>
        )}
      </div>

      {/* Full-Card Confirmation Overlay (100% Mobile-Friendly, Safe Thumb Touch Target) */}
      {isConfirming && (
        <div
          onClick={(e) => {
            e.stopPropagation()
          }}
          className="absolute inset-0 z-30 bg-zinc-950/95 backdrop-blur-md p-3.5 flex flex-col justify-between rounded-2xl animate-fade-in border border-red-500/50 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              Удалить из списка?
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsConfirming(false)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/20"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-left py-0.5">
            <div className="text-xs sm:text-sm font-bold text-white line-clamp-1">
              {item.title || item.series_name}
            </div>
            {item.episode_title && item.media_type === "Episode" && (
              <div className="text-[11px] text-zinc-400 line-clamp-1">
                S{item.season_number}:E{item.episode_number} • {item.episode_title}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsConfirming(false)
              }}
              className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-semibold transition shadow-sm border border-white/5"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsConfirming(false)
                onRemove(item)
              }}
              className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-red-950/60"
            >
              Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const ContinueWatchingShelf: React.FC = () => {
  const dispatch = useAppDispatch()
  const { data: resumeItems, isLoading, refetch } = useGetResumeItemsQuery(undefined, {
    pollingInterval: 15000,
  })
  const [deleteResumeItem] = useDeleteResumeItemMutation()

  const isPlayerOpen = useAppSelector((s) => Boolean(s.search.activePlayer))
  const prevIsPlayerOpenRef = useRef(isPlayerOpen)

  // When exiting playback, immediately refetch resume items so new items show up instantly!
  useEffect(() => {
    if (prevIsPlayerOpenRef.current && !isPlayerOpen) {
      refetch()
      const t = setTimeout(() => refetch(), 1000)
      return () => clearTimeout(t)
    }
    prevIsPlayerOpenRef.current = isPlayerOpen
  }, [isPlayerOpen, refetch])

  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'next_up'>('all')

  const inProgressCount = useMemo(
    () => (resumeItems || []).filter((i) => !i.is_next_up).length,
    [resumeItems]
  )
  const nextUpCount = useMemo(
    () => (resumeItems || []).filter((i) => i.is_next_up).length,
    [resumeItems]
  )

  const filteredItems = useMemo(() => {
    if (!resumeItems) return []
    if (activeFilter === 'in_progress') return resumeItems.filter((i) => !i.is_next_up)
    if (activeFilter === 'next_up') return resumeItems.filter((i) => i.is_next_up)
    return resumeItems
  }, [resumeItems, activeFilter])

  if (isLoading || !resumeItems || resumeItems.length === 0) {
    return null
  }

  const handlePlay = (item: ResumeItem) => {
    dispatch(
      openCinemaPlayer({
        tconst: item.tconst || "",
        title: item.title,
        ruTitle: item.series_name || item.title,
        initialSeason: item.season_number || undefined,
        initialEpisode: item.episode_number || undefined,
        autoResume: true,
      })
    )
  }

  const handleRemove = async (item: ResumeItem) => {
    try {
      await deleteResumeItem({
        item_id: item.item_id,
        tconst: item.tconst,
        season: item.season_number,
        episode: item.episode_number,
        is_next_up: item.is_next_up,
      }).unwrap()
      refetch()
    } catch (err) {
      console.error("Failed to remove resume item:", err)
    }
  }

  const formatRemainingMinutes = (duration: number, resume: number): string => {
    const diffSec = Math.max(0, duration - resume)
    const mins = Math.round(diffSec / 60)
    if (mins >= 60) {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      return m > 0 ? `${h}ч ${m}м` : `${h}ч`
    }
    return `${mins} мин`
  }

  return (
    <section className="space-y-3 pt-2 animate-fade-in text-left">
      {/* Shelf Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <PlayCircle className="h-4 w-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">
            Продолжить просмотр
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cinema-850 text-zinc-400 border border-border/70 font-mono">
            {resumeItems.length}
          </span>
        </div>

        {/* Filter Pills if both in-progress and next-up exist */}
        {inProgressCount > 0 && nextUpCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                activeFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'bg-cinema-850 hover:bg-cinema-800 text-zinc-400 border border-white/5'
              }`}
            >
              Все ({resumeItems.length})
            </button>
            <button
              onClick={() => setActiveFilter('in_progress')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                activeFilter === 'in_progress'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'bg-cinema-850 hover:bg-cinema-800 text-zinc-400 border border-white/5'
              }`}
            >
              В процессе ({inProgressCount})
            </button>
            <button
              onClick={() => setActiveFilter('next_up')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                activeFilter === 'next_up'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'bg-cinema-850 hover:bg-cinema-800 text-zinc-400 border border-white/5'
              }`}
            >
              Далее ({nextUpCount})
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Scroll Cards Row (Edge-to-Edge) */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 pl-4 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6 snap-x snap-mandatory">
        {filteredItems.map((item) => (
          <ContinueWatchingCard
            key={item.item_id}
            item={item}
            onPlay={handlePlay}
            onRemove={handleRemove}
            formatRemainingMinutes={formatRemainingMinutes}
          />
        ))}
        {/* Trailing spacer for comfortable right padding when scrolled to end */}
        <div className="shrink-0 w-4 sm:w-6 pointer-events-none" aria-hidden="true" />
      </div>
    </section>
  )
}
