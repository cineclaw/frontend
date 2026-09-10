import React, { useState, useMemo } from "react"
import { Play, PlayCircle, Clock, Sparkles } from "lucide-react"
import { useAppDispatch } from "@/store/store"
import { openCinemaPlayer } from "@/store/searchSlice"
import { useGetResumeItemsQuery, type ResumeItem } from "@/api/torrentsApi"

export const ContinueWatchingShelf: React.FC = () => {
  const dispatch = useAppDispatch()
  const { data: resumeItems, isLoading } = useGetResumeItemsQuery(undefined, {
    pollingInterval: 15000,
  })

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
      })
    )
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
    <section className="space-y-3 px-1 sm:px-2 pt-2 animate-fade-in text-left">
      {/* Shelf Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
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

      {/* Horizontal Scroll Cards Row */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1.5 snap-x snap-mandatory">
        {filteredItems.map((item) => {
          // Robust calculation directly from resume / duration seconds to avoid full-scale bug
          const percent = item.duration_seconds > 0
            ? Math.min(100, Math.max(3, Math.round((item.resume_seconds / item.duration_seconds) * 100)))
            : Math.min(100, Math.max(3, Math.round(item.played_percentage)))

          const remainingText = formatRemainingMinutes(item.duration_seconds, item.resume_seconds)

          return (
            <div
              key={item.item_id}
              onClick={() => handlePlay(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handlePlay(item)
                }
              }}
              className="group relative w-60 sm:w-72 shrink-0 aspect-[16/9] rounded-2xl border border-border/80 bg-cinema-900 overflow-hidden cursor-pointer shadow-xl hover:border-emerald-500/50 hover:shadow-emerald-950/40 transition-all duration-200 active:scale-[0.98] snap-start flex flex-col justify-between"
            >
              {/* Background Thumbnail Image */}
              <img
                src={item.image_url}
                alt={item.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback to dark background if backdrop image fails
                  ;(e.target as HTMLElement).style.display = "none"
                }}
              />

              {/* Gradient Darkening Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 group-hover:via-black/30 transition-colors" />

              {/* Top Meta Pill */}
              <div className="relative z-10 p-2.5 flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-[10px] sm:text-[11px] font-semibold text-emerald-400 backdrop-blur-md">
                  {item.media_type === "Episode"
                    ? `S${item.season_number}:E${item.episode_number}`
                    : "Фильм"}
                </span>

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
              </div>

              {/* Center Play Button Splash on Hover */}
              <div className="absolute inset-0 z-10 flex items-center justify-center opacity-85 group-hover:opacity-100 transition-opacity">
                <div className="p-3.5 rounded-full bg-emerald-500/90 text-black shadow-lg shadow-emerald-500/30 group-hover:scale-110 group-hover:bg-emerald-400 transition-transform duration-200">
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </div>
              </div>

              {/* Bottom Details & Progress Bar */}
              <div className="relative z-10 p-3 space-y-1.5">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white truncate drop-shadow-md">
                    {item.title}
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
            </div>
          )
        })}
      </div>
    </section>
  )
}
