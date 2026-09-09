import { useState, useMemo, useEffect, useRef } from "react"
import {
  ArrowLeft,
  X,
  Star,
  Calendar,
  MapPin,
  Film,
  User,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Clapperboard,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setSelectedPersonId, setSelectedMovie } from "@/store/searchSlice"
import {
  useGetPersonDetailsQuery,
  useLazyResolveTmdbMovieQuery,
} from "@/api/moviesApi"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatRating } from "@/lib/utils"
import type { PersonCreditItem, MovieDoc } from "@/api/types"

const RU_MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
]

function formatRussianDate(dateStr: string): string {
  const parts = dateStr.split("-")
  if (parts.length !== 3) return dateStr
  const year = parts[0]
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${day} ${RU_MONTHS[monthIdx]} ${year}`
  }
  return dateStr
}

function getPluralYears(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return `${n} лет`
  if (mod10 === 1) return `${n} год`
  if (mod10 >= 2 && mod10 <= 4) return `${n} года`
  return `${n} лет`
}

function calculateAge(birthStr: string, deathStr?: string | null): number | null {
  try {
    const birth = new Date(birthStr)
    const end = deathStr ? new Date(deathStr) : new Date()
    let age = end.getFullYear() - birth.getFullYear()
    const m = end.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
      age--
    }
    return age > 0 ? age : null
  } catch {
    return null
  }
}

const DEPARTMENT_LABELS: Record<string, string> = {
  Acting: "Актёрское искусство",
  Directing: "Режиссура",
  Production: "Продюсирование",
  Writing: "Сценарий",
  Editing: "Монтаж",
  Sound: "Звук",
  Camera: "Операторская работа",
  Art: "Художественная постановка",
  Costume: "Костюмы и грим",
  VisualEffects: "Визуальные эффекты",
}

export function PersonModal() {
  const dispatch = useAppDispatch()
  const personId = useAppSelector((state) => state.search.selectedPersonId)
  const isMobile = useIsMobile()

  // Keep last id for exit animations
  const lastIdRef = useRef<number | null>(null)
  if (personId !== null) {
    lastIdRef.current = personId
  }
  const activePersonId = personId ?? lastIdRef.current

  const { data: person, isLoading, isError } = useGetPersonDetailsQuery(
    activePersonId ?? 0,
    { skip: !activePersonId }
  )

  const [triggerResolve] = useLazyResolveTmdbMovieQuery()
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  // Filters & Sorting state
  const [sortMode, setSortMode] = useState<"best" | "newest">("best")
  const [activeTab, setActiveTab] = useState<"all" | "cast" | "crew">("all")
  const [isBioExpanded, setIsBioExpanded] = useState(false)

  // Reset tab when person changes
  useEffect(() => {
    if (personId) {
      setSortMode("best")
      setActiveTab("all")
      setIsBioExpanded(false)
      setResolvingId(null)
    }
  }, [personId])

  // Handle browser back gesture / popstate
  useEffect(() => {
    if (!personId) return

    window.history.pushState({ cineclawPerson: personId }, "")

    const handlePopState = () => {
      dispatch(setSelectedPersonId(null))
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch(setSelectedPersonId(null))
      }
    }

    window.addEventListener("popstate", handlePopState)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [personId, dispatch])

  const handleClose = () => {
    if (window.history.state?.cineclawPerson) {
      window.history.back()
    } else {
      dispatch(setSelectedPersonId(null))
    }
  }

  // Deduplicate and process combined credits
  const processedCredits = useMemo(() => {
    if (!person) return []

    let list: (PersonCreditItem & { rolesLabel?: string })[] = []

    if (activeTab === "cast") {
      list = person.cast.map((c) => ({
        ...c,
        rolesLabel: c.character ? c.character : "Актёр",
      }))
    } else if (activeTab === "crew") {
      list = person.crew.map((c) => ({
        ...c,
        rolesLabel: c.job || c.department || "Создатель",
      }))
    } else {
      // Combined 'all' with deduplication
      const map = new Map<string, PersonCreditItem & { rolesLabel?: string; jobsList?: string[] }>()

      // Add cast credits first
      for (const c of person.cast) {
        const key = `${c.media_type}:${c.id}`
        map.set(key, {
          ...c,
          rolesLabel: c.character ? c.character : "Актёр",
          jobsList: c.character ? [c.character] : ["Актёр"],
        })
      }

      // Merge crew credits
      for (const cr of person.crew) {
        const key = `${cr.media_type}:${cr.id}`
        const existing = map.get(key)
        const job = cr.job || "Создатель"
        if (existing) {
          if (!existing.jobsList?.includes(job)) {
            existing.jobsList = [...(existing.jobsList || []), job]
          }
          existing.rolesLabel = existing.jobsList.slice(0, 2).join(" • ")
        } else {
          map.set(key, {
            ...cr,
            rolesLabel: job,
            jobsList: [job],
          })
        }
      }

      list = Array.from(map.values())
    }

    // Sort credits
    return list.sort((a, b) => {
      if (sortMode === "newest") {
        const yearA = a.year || (a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : 0) || 0
        const yearB = b.year || (b.release_date ? parseInt(b.release_date.slice(0, 4), 10) : 0) || 0
        if (yearB !== yearA) return yearB - yearA
        // Secondary sort by popularity / votes
        return (b.vote_count || 0) - (a.vote_count || 0)
      } else {
        // 'best' - quality score weighted by log10 votes
        const scoreA = (a.vote_average || 0) * Math.log10((a.vote_count || 0) + 1)
        const scoreB = (b.vote_average || 0) * Math.log10((b.vote_count || 0) + 1)
        return scoreB - scoreA
      }
    })
  }, [person, activeTab, sortMode])

  // Drill down into movie details
  const handleSelectMovie = async (item: PersonCreditItem) => {
    try {
      setResolvingId(item.id)
      const res = await triggerResolve({
        mediaType: item.media_type,
        tmdbId: item.id,
      }).unwrap()

      if (res) {
        dispatch(setSelectedMovie(res))
        dispatch(setSelectedPersonId(null))
      }
    } catch (err) {
      console.warn("Failed to resolve TMDB movie, falling back to local doc:", err)
      // Fallback: construct MovieDoc from credit item
      const fallbackDoc: MovieDoc = {
        tconst: `tmdb-${item.id}`,
        title_ru: item.title,
        title_orig: item.original_title || item.title,
        title_primary: item.title,
        russian_titles: [item.title],
        year: item.year || (item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : null),
        title_type: item.media_type === "tv" ? "tvSeries" : "movie",
        rating: item.vote_average || null,
        num_votes: item.vote_count || 0,
        genres: [],
      }
      dispatch(setSelectedMovie(fallbackDoc))
      dispatch(setSelectedPersonId(null))
    } finally {
      setResolvingId(null)
    }
  }

  if (!activePersonId) return null

  // Profile image
  const profileUrl = person?.profile_path
    ? `https://image.tmdb.org/t/p/w342${person.profile_path}`
    : null

  // Age and lifespan
  const age = person?.birthday ? calculateAge(person.birthday, person.deathday) : null
  const formattedBirthday = person?.birthday ? formatRussianDate(person.birthday) : null
  const formattedDeathday = person?.deathday ? formatRussianDate(person.deathday) : null

  // Biography truncation
  const bio = person?.biography?.trim()
  const isBioLong = (bio?.length || 0) > 280

  // Person modal content body
  const renderContent = () => (
    <div className="flex flex-col gap-6 text-left">
      {/* Top Profile Card */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start bg-cinema-850/60 p-4 sm:p-5 rounded-2xl border border-border/70 backdrop-blur-sm shadow-xl">
        {/* Avatar */}
        <div className="relative w-28 h-36 sm:w-36 sm:h-48 rounded-xl overflow-hidden bg-cinema-800 border border-border shrink-0 shadow-lg flex items-center justify-center">
          {profileUrl ? (
            <img
              src={profileUrl}
              alt={person?.name || "Person"}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <User className="h-14 w-14 text-muted-foreground/40" />
          )}
          {person?.known_for_department && (
            <div className="absolute bottom-1.5 inset-x-1.5 text-center">
              <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-black/75 backdrop-blur-md rounded-md text-zinc-200 border border-white/10 truncate max-w-full">
                {DEPARTMENT_LABELS[person.known_for_department] || person.known_for_department}
              </span>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1 min-w-0 space-y-2.5 text-center sm:text-left">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {person?.name || (isLoading ? "Загрузка..." : "Актёр")}
            </h1>
            {person?.known_for_department && (
              <p className="text-xs text-primary font-medium mt-0.5">
                {DEPARTMENT_LABELS[person.known_for_department] || person.known_for_department}
              </p>
            )}
          </div>

          {/* Quick facts */}
          <div className="flex flex-wrap gap-y-1.5 gap-x-4 justify-center sm:justify-start text-xs text-muted-foreground">
            {formattedBirthday && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                <span>
                  {formattedBirthday}
                  {age && !person?.deathday && ` (${getPluralYears(age)})`}
                </span>
              </div>
            )}

            {formattedDeathday && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <span>† {formattedDeathday}</span>
                {age && <span>(в {getPluralYears(age)})</span>}
              </div>
            )}

            {person?.place_of_birth && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-xs">
                  {person.place_of_birth}
                </span>
              </div>
            )}
          </div>

          {/* Biography */}
          {bio && (
            <div className="pt-1">
              <p
                className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal transition-all ${
                  !isBioExpanded && isBioLong ? "line-clamp-3 sm:line-clamp-4" : ""
                }`}
              >
                {bio}
              </p>
              {isBioLong && (
                <button
                  type="button"
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1 cursor-pointer"
                >
                  <span>{isBioExpanded ? "Свернуть" : "Читать далее"}</span>
                  {isBioExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* External TMDB link */}
          {person && (
            <div className="pt-1 flex justify-center sm:justify-start">
              <a
                href={`https://www.themoviedb.org/person/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-primary transition-colors"
              >
                <span>Профиль на TMDB</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Filmography Section */}
      <div className="space-y-3.5">
        {/* Filmography Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-primary" />
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Фильмография
            </h2>
            <Badge variant="secondary" className="font-mono text-xs px-2 py-0">
              {processedCredits.length}
            </Badge>
          </div>

          {/* Tab filters and Sort toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tabs: All / Cast / Crew */}
            {person && person.crew.length > 0 && person.cast.length > 0 && (
              <div className="inline-flex items-center bg-cinema-850 p-0.5 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("cast")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === "cast"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  В кадре ({person.cast.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("crew")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === "crew"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  За кадром ({person.crew.length})
                </button>
              </div>
            )}

            {/* Sorting: Newest vs Best */}
            <div className="inline-flex items-center bg-cinema-850 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setSortMode("best")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  sortMode === "best"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Сортировка по рейтингу и популярности"
              >
                <Sparkles className="h-3 w-3" />
                <span>Лучшие</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode("newest")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  sortMode === "newest"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Сортировка по году выхода (новые сначала)"
              >
                <Clock className="h-3 w-3" />
                <span>Новые</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">
              Загрузка фильмографии...
            </p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="py-8 text-center text-xs text-red-400">
            Не удалось загрузить данные персоны. Попробуйте позже.
          </div>
        )}

        {/* Filmography Cards Grid */}
        {!isLoading && processedCredits.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {processedCredits.map((item) => {
              const isResolving = resolvingId === item.id
              const poster = item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : null
              const posterSrcSet = item.poster_path
                ? `https://image.tmdb.org/t/p/w185${item.poster_path} 185w, https://image.tmdb.org/t/p/w342${item.poster_path} 342w, https://image.tmdb.org/t/p/w500${item.poster_path} 500w`
                : undefined
              const posterSizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"

              return (
                <button
                  key={`${item.media_type}-${item.id}`}
                  type="button"
                  onClick={() => handleSelectMovie(item)}
                  disabled={isResolving}
                  className="group relative flex flex-col text-left bg-cinema-850/80 hover:bg-cinema-800 border border-border/80 hover:border-primary/60 rounded-xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[2/3] w-full bg-cinema-900 overflow-hidden">
                    {poster ? (
                      <img
                        src={poster}
                        srcSet={posterSrcSet}
                        sizes={posterSizes}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1 p-2 text-center">
                        <Film className="h-8 w-8 opacity-40" />
                        <span className="text-[10px] leading-tight text-zinc-500">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {/* Top rating badge */}
                    {item.vote_average !== undefined && item.vote_average !== null && item.vote_average > 0 && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-400 border border-amber-500/20 shadow">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span>{formatRating(item.vote_average)}</span>
                      </div>
                    )}

                    {/* Media Type Badge (TV series) */}
                    {item.media_type === "tv" && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-sky-950/85 backdrop-blur-sm text-[9px] font-semibold text-sky-400 border border-sky-500/30">
                        Сериал
                      </div>
                    )}

                    {/* Loading Overlay when resolving */}
                    {isResolving && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-primary">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-[10px] font-medium text-white">
                          Открытие...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between gap-1">
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {item.title || item.original_title}
                      </h3>
                      {item.rolesLabel && (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate mt-0.5">
                          {item.rolesLabel}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400 font-mono">
                      <span>{item.year || "—"}</span>
                      {item.vote_count > 0 && (
                        <span className="text-zinc-500">
                          {item.vote_count >= 1000
                            ? `${(item.vote_count / 1000).toFixed(1)}k`
                            : item.vote_count}{" "}
                          оц.
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!isLoading && processedCredits.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            В этой категории нет проектов.
          </div>
        )}
      </div>
    </div>
  )

  // Mobile: dedicated full-screen screen view with sticky header and fluid transitions
  if (isMobile) {
    return (
      <AnimatePresence>
        {personId !== null && (
          <motion.div
            key="person-screen-mobile"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[80] bg-cinema-950 flex flex-col overscroll-none"
          >
            {/* Sticky Top Header Bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2.5 bg-cinema-950/95 backdrop-blur-xl border-b border-border/80 shadow-md pt-[max(0.6rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 active:scale-95 transition-all p-1 -ml-1 cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Назад</span>
              </button>

              <h2 className="text-sm font-bold text-foreground truncate max-w-[200px] text-center">
                {person?.name || "Персона"}
              </h2>

              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Single Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
              {renderContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Desktop: Dialog Modal
  return (
    <Dialog
      open={personId !== null}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto bg-cinema-900 border-cinema-800 text-foreground p-5 sm:p-6 custom-scrollbar">
        <DialogTitle className="sr-only">
          {person?.name || "Информация о персоне"}
        </DialogTitle>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
