import { useState } from "react"
import { Film, Users, Play, User, ChevronDown, ChevronUp } from "lucide-react"
import type { CastMember, CrewMember, VideoItem } from "@/api/types"
import { useAppDispatch } from "@/store/store"
import { setSelectedPersonId } from "@/store/searchSlice"

// --- Overview / Synopsis Component ---
interface MovieOverviewProps {
  overview?: string | null
  className?: string
}

export function MovieOverview({ overview, className = "" }: MovieOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!overview || overview.trim() === "") return null

  const isLong = overview.length > 220

  return (
    <div className={`space-y-1.5 text-left ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Описание
      </h3>
      <p
        className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal transition-all ${
          !isExpanded && isLong ? "line-clamp-3 sm:line-clamp-4" : ""
        }`}
      >
        {overview}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-0.5"
        >
          <span>{isExpanded ? "Свернуть" : "Читать далее"}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

// --- Crew Badges Component ---
interface MovieCrewBadgesProps {
  crew?: CrewMember[] | null
  className?: string
}

const JOB_LABELS: Record<string, string> = {
  Creator: "Создатель",
  Director: "Режиссёр",
  Screenplay: "Сценарий",
  Writer: "Сценарий",
  "Executive Producer": "Исполнительный продюсер",
  Producer: "Продюсер",
  "Original Music Composer": "Композитор",
  Music: "Композитор",
  "Director of Photography": "Оператор",
  Cinematography: "Оператор",
  Editor: "Монтаж",
}

const TV_JOB_PRIORITY = [
  "Creator",
  "Director",
  "Screenplay",
  "Writer",
  "Executive Producer",
  "Original Music Composer",
  "Music",
  "Producer",
  "Director of Photography",
  "Cinematography",
  "Editor",
]

const MOVIE_JOB_PRIORITY = [
  "Director",
  "Screenplay",
  "Writer",
  "Producer",
  "Executive Producer",
  "Original Music Composer",
  "Music",
  "Director of Photography",
  "Cinematography",
  "Editor",
]

export function MovieCrewBadges({ crew, className = "" }: MovieCrewBadgesProps) {
  const dispatch = useAppDispatch()
  if (!crew || crew.length === 0) return null

  const isTvShow = crew.some((m) => m.job === "Creator")
  const prominentIds = new Set(
    crew.filter((m) => m.job === "Creator" || m.job === "Director" || m.job === "Writer").map((m) => m.id)
  )
  const jobPriority = isTvShow ? TV_JOB_PRIORITY : MOVIE_JOB_PRIORITY

  // Group crew by localized job with member IDs
  const grouped = crew.reduce<Record<string, { id: number; name: string }[]>>((acc, member) => {
    const rawJob = member.job
    // In TV shows, creators/directors/writers are already featured, avoid duplicating them in "Исполнительный продюсер"
    if (isTvShow && rawJob === "Executive Producer" && prominentIds.has(member.id)) {
      return acc
    }

    const label = JOB_LABELS[rawJob] || rawJob
    if (!acc[label]) acc[label] = []
    if (!acc[label].some((m) => m.id === member.id)) {
      acc[label].push({ id: member.id, name: member.name })
    }
    return acc
  }, {})

  // Sort entries by prioritized order
  const entries = Object.entries(grouped).sort(([jobA], [jobB]) => {
    const keyA = Object.keys(JOB_LABELS).find((k) => JOB_LABELS[k] === jobA) || jobA
    const keyB = Object.keys(JOB_LABELS).find((k) => JOB_LABELS[k] === jobB) || jobB
    const indexA = jobPriority.indexOf(keyA)
    const indexB = jobPriority.indexOf(keyB)
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB)
  })

  if (entries.length === 0) return null

  return (
    <div className={`space-y-1 text-left ${className}`}>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {entries.slice(0, 6).map(([job, members]) => (
          <div key={job} className="inline-flex items-baseline gap-1.5">
            <span className="text-muted-foreground font-medium">{job}:</span>
            <span className="text-foreground font-semibold">
              {members.slice(0, 2).map((m, idx) => (
                <span key={m.id}>
                  {idx > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => dispatch(setSelectedPersonId(m.id))}
                    className="hover:text-primary hover:underline transition-colors cursor-pointer text-left font-semibold"
                    title={`${m.name} — информация и фильмография`}
                  >
                    {m.name}
                  </button>
                </span>
              ))}
              {members.length > 2 ? ` и др.` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Cast Avatar Carousel ---
interface MovieCastProps {
  cast?: CastMember[] | null
  className?: string
}

function CastAvatar({ member }: { member: CastMember }) {
  const dispatch = useAppDispatch()
  const [imgError, setImgError] = useState(false)
  const profileUrl =
    member.profile_path && !imgError
      ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
      : null

  return (
    <button
      type="button"
      onClick={() => dispatch(setSelectedPersonId(member.id))}
      className="flex flex-col items-center w-16 sm:w-20 shrink-0 text-center group cursor-pointer active:scale-95 transition-transform"
      title={`${member.name} — биография и фильмография`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-cinema-850 border border-border/80 group-hover:border-primary/60 group-hover:ring-2 group-hover:ring-primary/20 transition-all shadow-md flex items-center justify-center mb-1.5 shrink-0">
        {profileUrl ? (
          <img
            src={profileUrl}
            alt={member.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-cinema-800 text-muted-foreground">
            <User className="h-6 w-6 opacity-60" />
          </div>
        )}
      </div>
      <span className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight truncate w-full group-hover:text-primary transition-colors">
        {member.name}
      </span>
      {member.character && (
        <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight truncate w-full mt-0.5">
          {member.character}
        </span>
      )}
    </button>
  )
}

export function MovieCast({ cast, className = "" }: MovieCastProps) {
  if (!cast || cast.length === 0) return null

  return (
    <div className={`space-y-2.5 text-left ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-3.5 w-3.5 text-primary" />
        <span>В главных ролях</span>
        <span className="text-[10px] font-mono text-zinc-500 font-normal">
          ({cast.length})
        </span>
      </div>

      {/* Horizontal swipeable row */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar overscroll-x-contain">
        {cast.map((member) => (
          <CastAvatar key={member.id} member={member} />
        ))}
      </div>
    </div>
  )
}

// --- Trailers Carousel ---
interface MovieTrailersProps {
  videos?: VideoItem[] | null
  onSelectTrailer: (video: VideoItem) => void
  className?: string
}

export function MovieTrailers({
  videos,
  onSelectTrailer,
  className = "",
}: MovieTrailersProps) {
  if (!videos || videos.length === 0) return null

  return (
    <div className={`space-y-2.5 text-left ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Film className="h-3.5 w-3.5 text-primary" />
        <span>Трейлеры и видео</span>
        <span className="text-[10px] font-mono text-zinc-500 font-normal">
          ({videos.length})
        </span>
      </div>

      {/* Horizontal swipeable cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar overscroll-x-contain">
        {videos.map((video) => {
          const thumbUrl = `https://img.youtube.com/vi/${video.key}/mqdefault.jpg`
          const isTrailer =
            video.type.toLowerCase() === "trailer" ||
            video.name.toLowerCase().includes("трейлер")

          return (
            <div
              key={video.id}
              onClick={() => onSelectTrailer(video)}
              className="w-44 sm:w-52 shrink-0 group cursor-pointer space-y-1.5 text-left active:scale-[0.98] transition-transform"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-cinema-850 border border-border/80 group-hover:border-primary/60 transition-all shadow-md">
                <img
                  src={thumbUrl}
                  alt={video.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Dark gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white group-hover:bg-primary group-hover:border-primary group-hover:scale-110 transition-all shadow-lg">
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Badge (Trailer / Teaser / Official) */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/75 backdrop-blur-md text-white border border-white/10 uppercase tracking-wider">
                    {isTrailer ? "Трейлер" : video.type}
                  </span>
                  {video.official && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/80 text-white backdrop-blur-md">
                      Официальный
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <p className="text-[11px] font-medium text-zinc-300 group-hover:text-primary transition-colors truncate">
                {video.name}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
