import { useState } from "react"
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Compass,
  Trophy,
  Star,
  Quote,
} from "lucide-react"
import { useGetCriticSummaryQuery } from "@/api/aiApi"

interface CriticsSectionProps {
  tconst: string
  className?: string
}

export function CriticsSection({ tconst, className = "" }: CriticsSectionProps) {
  const { data, isLoading, isError } = useGetCriticSummaryQuery(tconst, {
    skip: !tconst || !tconst.startsWith("tt"),
  })
  const [isExpanded, setIsExpanded] = useState(false)

  // Skeleton loading state
  if (isLoading) {
    return (
      <div className={`space-y-2.5 text-left ${className}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="h-6 w-24 rounded-lg bg-cinema-800/80 animate-pulse" />
          <div className="h-6 w-20 rounded-lg bg-cinema-800/80 animate-pulse" />
          <div className="h-6 w-20 rounded-lg bg-cinema-800/80 animate-pulse" />
        </div>
        <div className="p-3 rounded-xl bg-cinema-850/60 border border-border/40 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-cinema-800 animate-pulse" />
            <div className="h-3 w-32 rounded bg-cinema-800 animate-pulse" />
          </div>
          <div className="h-3 w-[90%] rounded bg-cinema-800/60 animate-pulse" />
          <div className="h-3 w-[70%] rounded bg-cinema-800/60 animate-pulse" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return null
  }

  const { scores, verdict, tone, pros, cons, target_audience } = data
  const hasScores =
    scores.rotten_tomatoes != null ||
    scores.metacritic != null ||
    scores.imdb != null ||
    scores.awards

  if (!hasScores && !verdict) {
    return null
  }

  // Tone badge formatting
  const toneConfig: Record<string, { label: string; color: string; border: string; bg: string }> = {
    strongly_positive: {
      label: "Восторженный приём",
      color: "text-emerald-400",
      border: "border-emerald-500/40",
      bg: "bg-emerald-950/40",
    },
    positive: {
      label: "Положительный приём",
      color: "text-teal-400",
      border: "border-teal-500/40",
      bg: "bg-teal-950/40",
    },
    mixed: {
      label: "Смешанные отзывы",
      color: "text-amber-400",
      border: "border-amber-500/40",
      bg: "bg-amber-950/40",
    },
    negative: {
      label: "Сдержанный / Спорный",
      color: "text-rose-400",
      border: "border-rose-500/40",
      bg: "bg-rose-950/40",
    },
  }

  const currentTone = toneConfig[tone] || toneConfig.positive

  return (
    <div className={`space-y-2.5 text-left ${className}`}>
      {/* 1. Numerical Scores Bar */}
      {hasScores && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* Rotten Tomatoes Badge */}
          {scores.rotten_tomatoes != null && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold tracking-tight shadow-sm ${
                scores.rotten_tomatoes >= 60
                  ? "bg-red-950/40 border-red-500/30 text-red-300"
                  : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              }`}
              title="Рейтинг одобрения кинокритиков Rotten Tomatoes (Tomatometer)"
            >
              <span className="text-sm">🍅</span>
              <span>{scores.rotten_tomatoes}%</span>
            </div>
          )}

          {/* Metacritic Badge */}
          {scores.metacritic != null && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono tracking-tight shadow-sm ${
                scores.metacritic >= 61
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : scores.metacritic >= 40
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
              title="Средневзвешенная оценка мировой прессы на Metacritic (Metascore)"
            >
              <span className="font-sans font-black text-[10px] px-1 py-0.2 rounded bg-black/40 border border-white/10">
                M
              </span>
              <span>{scores.metacritic}</span>
            </div>
          )}

          {/* IMDb Badge */}
          {scores.imdb != null && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-amber-950/30 border-amber-500/30 text-amber-300 text-xs font-bold tracking-tight shadow-sm"
              title={`Оценка зрителей IMDb: ${scores.imdb}/10 ${scores.imdb_votes ? `(${scores.imdb_votes} оценок)` : ""}`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{scores.imdb.toFixed(1)}</span>
            </div>
          )}

          {/* Awards Badge */}
          {scores.awards && scores.awards !== "N/A" && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-cinema-850/90 border-border/70 text-zinc-300 text-[11px] font-medium truncate max-w-full shadow-sm"
              title={scores.awards}
            >
              <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="truncate">{scores.awards}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. AI Critics Consensus Card */}
      {verdict && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-b from-cinema-850/90 to-cinema-900/90 border border-border/70 shadow-lg space-y-2.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Консенсус критиков
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide ${currentTone.bg} ${currentTone.border} ${currentTone.color}`}
              >
                {currentTone.label}
              </span>

              {(pros.length > 0 || cons.length > 0 || target_audience) && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 rounded-md text-zinc-400 hover:text-foreground hover:bg-cinema-800 transition-colors"
                  title={isExpanded ? "Свернуть детали" : "Развернуть детали"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Verdict Text */}
          <div className="flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5 rotate-180" />
            <p className="text-xs sm:text-[13px] text-zinc-200 leading-relaxed font-normal">
              {verdict}
            </p>
          </div>

          {/* Expandable Details: Pros, Cons, Target Audience */}
          {isExpanded && (
            <div className="pt-2 border-t border-border/50 space-y-3 animate-in fade-in-50 duration-200">
              {/* Pros & Cons Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Pros */}
                {pros.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                      <ThumbsUp className="h-3 w-3" />
                      <span>За что хвалят</span>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-300">
                      {pros.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 select-none">•</span>
                          <span className="leading-snug">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cons */}
                {cons.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-400 uppercase tracking-wide">
                      <ThumbsDown className="h-3 w-3" />
                      <span>За что ругают</span>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-300">
                      {cons.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-rose-400 select-none">•</span>
                          <span className="leading-snug">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Target Audience */}
              {target_audience && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-cinema-800/50 border border-border/40 text-xs text-zinc-300">
                  <Compass className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block">
                      Кому стоит смотреть
                    </span>
                    <span className="leading-relaxed">{target_audience}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
