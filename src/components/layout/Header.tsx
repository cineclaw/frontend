import { Activity, Sparkles, LogOut, User, SlidersHorizontal, Check, ChevronDown } from "lucide-react"
import { useGetStatusQuery } from "@/api/moviesApi"
import { useLogoutMutation } from "@/api/authApi"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { logout } from "@/store/authSlice"
import { Badge } from "@/components/ui/badge"
import { useState, useRef, useEffect } from "react"
import { useDefaultQuality, QUALITY_OPTIONS } from "@/lib/userSettings"

interface HeaderProps {
  onOpenDiagnostic?: () => void
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

function formatDocumentCount(count?: number): { full: string; compact: string } {
  if (!count) return { full: "0", compact: "0" }
  const full = count.toLocaleString("ru-RU")
  let compact = full
  if (count >= 1_000_000) {
    compact = `${(count / 1_000_000).toFixed(1)}M`
  } else if (count >= 10_000) {
    compact = `${Math.round(count / 1_000)}k`
  }
  return { full, compact }
}

export function Header({ onOpenDiagnostic }: HeaderProps) {
  const dispatch = useAppDispatch()
  const { isAuthenticated, username } = useAppSelector((state) => state.auth)
  const [logoutMutation] = useLogoutMutation()

  const handleLogout = async () => {
    try {
      await logoutMutation().unwrap()
    } catch {}
    dispatch(logout())
  }

  const [defaultQuality, setDefaultQuality] = useDefaultQuality()
  const [isQualityOpen, setIsQualityOpen] = useState(false)
  const qualityMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityOpen(false)
      }
    }
    if (isQualityOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isQualityOpen])

  const { data: status, isError, isLoading } = useGetStatusQuery(undefined, {
    pollingInterval: 15000,
  })

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-cinema-950/90 backdrop-blur-xl transition-all pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cinema-900 border border-primary/30 shadow-lg shadow-primary/10 overflow-hidden p-0.5">
            <img src="/favicon.svg" alt="CineClaw" className="h-full w-full object-contain rounded-lg" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                CineClaw
              </span>
              <button
                type="button"
                onClick={onOpenDiagnostic}
                className="group inline-flex items-center focus:outline-none"
                title="Открыть диагностику системы"
              >
                <Badge
                  variant="default"
                  className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground group-hover:bg-primary/80 transition-colors cursor-pointer"
                >
                  v{APP_VERSION}
                </Badge>
              </button>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Умный поиск по IMDb с русской локализацией
            </p>
          </div>
        </div>

        {/* Status Indicators & Diagnostics */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          {/* Service Status & Diagnostics Trigger Button */}
          <button
            type="button"
            onClick={onOpenDiagnostic}
            title="Диагностика и статус микросервисов"
            className="flex items-center space-x-1.5 sm:space-x-2 rounded-full border border-border/60 bg-cinema-900/90 px-2.5 sm:px-3 py-1 text-xs hover:border-primary/50 hover:bg-cinema-800 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 shadow-sm"
          >
            {isLoading ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="text-muted-foreground">Проверка...</span>
              </>
            ) : isError ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-red-400 font-medium">Сервер оффлайн</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                <span className="text-emerald-400 font-medium hidden sm:inline">Индекс:</span>
                <span className="font-bold text-foreground sm:hidden">
                  {formatDocumentCount(status?.total_documents).compact}
                </span>
                <span className="font-bold text-foreground hidden sm:inline">
                  {formatDocumentCount(status?.total_documents).full}
                </span>
                <span className="text-muted-foreground text-[11px] hidden md:inline">фильмов</span>
              </>
            )}
            <Activity className="h-3 w-3 text-muted-foreground hover:text-primary ml-0.5 sm:ml-1 shrink-0" />
          </button>

          {/* Default Quality Selector Popover */}
          <div className="relative" ref={qualityMenuRef}>
            <button
              type="button"
              onClick={() => setIsQualityOpen((prev) => !prev)}
              title="Качество по умолчанию для веб-просмотра"
              className="flex items-center space-x-1 sm:space-x-1.5 rounded-full border border-border/60 bg-cinema-900/90 px-2 sm:px-3 py-1 text-xs hover:border-emerald-500/50 hover:bg-cinema-800 transition-all cursor-pointer focus:outline-none shadow-sm font-semibold text-zinc-300 hover:text-white"
            >
              <SlidersHorizontal className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>
                {defaultQuality === "4k" ? "4K" : defaultQuality === "1080p" ? "1080p" : defaultQuality.toUpperCase()}
              </span>
              <ChevronDown
                className={`h-3 w-3 text-zinc-400 transition-transform duration-200 shrink-0 ${
                  isQualityOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isQualityOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-cinema-900/95 border border-border/80 p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/5 mb-1">
                  Качество по умолчанию
                </div>
                {QUALITY_OPTIONS.map((opt) => {
                  const isSelected = opt.tier === defaultQuality
                  return (
                    <button
                      key={opt.tier}
                      type="button"
                      onClick={() => {
                        setDefaultQuality(opt.tier)
                        setIsQualityOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-300 font-bold"
                          : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-zinc-500 font-normal font-mono">
                          {opt.resolution}
                        </span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-400 ml-2 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Badge variant="outline" className="hidden lg:flex items-center gap-1 border-primary/30 text-primary/90 bg-primary/5 py-1">
            <Sparkles className="h-3 w-3" />
            <span>Tantivy & Fuzzy</span>
          </Badge>

          {isAuthenticated && (
            <button
              type="button"
              onClick={handleLogout}
              title={`Выйти из учётной записи (${username || "admin"})`}
              className="flex items-center justify-center space-x-1 rounded-full border border-border/60 bg-cinema-900/90 p-1.5 sm:px-2.5 sm:py-1 text-xs text-cinema-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all cursor-pointer focus:outline-none shadow-sm"
            >
              <User className="h-3.5 w-3.5 text-cinema-400 hidden sm:inline" />
              <span className="text-[11px] font-medium hidden md:inline">{username || "admin"}</span>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
