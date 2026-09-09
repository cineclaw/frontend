import { Activity, Sparkles } from "lucide-react"
import { useGetStatusQuery } from "@/api/moviesApi"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  onOpenDiagnostic?: () => void
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

export function Header({ onOpenDiagnostic }: HeaderProps) {
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
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Service Status & Diagnostics Trigger Button */}
          <button
            type="button"
            onClick={onOpenDiagnostic}
            title="Диагностика и статус микросервисов"
            className="flex items-center space-x-2 rounded-full border border-border/60 bg-cinema-900/90 px-3 py-1 text-xs hover:border-primary/50 hover:bg-cinema-800 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 shadow-sm"
          >
            {isLoading ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-muted-foreground">Проверка...</span>
              </>
            ) : isError ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-red-400 font-medium">Сервер оффлайн</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-emerald-400 font-medium hidden sm:inline">Индекс:</span>
                <span className="font-bold text-foreground">
                  {status?.total_documents?.toLocaleString('ru-RU') || 0}
                </span>
                <span className="text-muted-foreground text-[11px] hidden md:inline">фильмов</span>
              </>
            )}
            <Activity className="h-3 w-3 text-muted-foreground hover:text-primary ml-1" />
          </button>

          <Badge variant="outline" className="hidden lg:flex items-center gap-1 border-primary/30 text-primary/90 bg-primary/5 py-1">
            <Sparkles className="h-3 w-3" />
            <span>Tantivy & Fuzzy</span>
          </Badge>
        </div>
      </div>
    </header>
  )
}
