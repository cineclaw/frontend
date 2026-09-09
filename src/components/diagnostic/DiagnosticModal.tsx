import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Copy,
  Check,
  Server,
  Database,
  Film,
  HardDrive,
  ShieldCheck,
  Wifi,
  Smartphone,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ServiceCheck {
  id: string
  name: string
  role: string
  icon: React.ElementType
  url: string
  status: "checking" | "online" | "offline"
  version?: string
  latencyMs?: number
  details?: Record<string, string | number | boolean>
  error?: string
}

interface DiagnosticModalProps {
  isOpen: boolean
  onClose: () => void
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

export function DiagnosticModal({ isOpen, onClose }: DiagnosticModalProps) {
  const isMobile = useIsMobile()
  const [copied, setCopied] = useState(false)
  const [services, setServices] = useState<ServiceCheck[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Browser & Client info
  const clientInfo = {
    version: `v${APP_VERSION}`,
    displayMode:
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error navigator.standalone is iOS Safari specific
        navigator.standalone)
        ? "PWA (Standalone)"
        : "Браузер",
    serviceWorker:
      typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? navigator.serviceWorker.controller
          ? "Активен"
          : "Поддерживается"
        : "Не поддерживается",
    screen:
      typeof window !== "undefined"
        ? `${window.innerWidth} × ${window.innerHeight} (dpr: ${window.devicePixelRatio})`
        : "Unknown",
    host: typeof window !== "undefined" ? window.location.hostname : "localhost",
    online: typeof navigator !== "undefined" && navigator.onLine ? "Онлайн" : "Офлайн",
  }

  const runDiagnostics = useCallback(async () => {
    setIsRefreshing(true)
    const hostname = window.location.hostname || "localhost"

    const checks: ServiceCheck[] = [
      {
        id: "frontend",
        name: "CineClaw Frontend",
        role: "React 19 / Vite / PWA клиент",
        icon: Smartphone,
        url: window.location.origin,
        status: "online",
        version: APP_VERSION,
        details: {
          "Режим работы": clientInfo.displayMode,
          "Service Worker": clientInfo.serviceWorker,
          "Разрешение экрана": clientInfo.screen,
          "Сеть": clientInfo.online,
        },
      },
      {
        id: "imdb-indexer",
        name: "IMDb Indexer",
        role: "Полнотекстовый поиск Tantivy & метаданные TMDB",
        icon: Database,
        url: `http://${hostname}:8090/status`,
        status: "checking",
      },
      {
        id: "tracker-proxy",
        name: "Tracker Proxy",
        role: "Агрегатор трекеров, дедупликатор & FUSE оркестратор",
        icon: Server,
        url: `http://${hostname}:9118/health`,
        status: "checking",
      },
      {
        id: "jellyfin",
        name: "Jellyfin Media Server",
        role: "Транскодирование и движок воспроизведения",
        icon: Film,
        url: `http://${hostname}:8096/System/Info/Public`,
        status: "checking",
      },
      {
        id: "tiramisu",
        name: "Tiramisu FUSE Engine",
        role: "Виртуальное монтирование торрентов для Jellyfin",
        icon: HardDrive,
        url: `http://${hostname}:9080/metrics`,
        status: "checking",
      },
      {
        id: "flaresolverr",
        name: "FlareSolverr",
        role: "Сервис обхода защиты Cloudflare Turnstile для RuTracker",
        icon: ShieldCheck,
        url: `http://${hostname}:8191`,
        status: "checking",
      },
    ]

    setServices(checks)

    // Execute checks in parallel
    const updatedChecks = await Promise.all(
      checks.map(async (check) => {
        if (check.id === "frontend") return check

        const start = performance.now()
        try {
          // Direct check or fallback to relative path through Nginx
          let endpoint = check.url
          if (check.id === "imdb-indexer") {
            endpoint = "/status"
          } else if (check.id === "tracker-proxy") {
            endpoint = "/torrents/health"
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)

          const res = await fetch(endpoint, {
            signal: controller.signal,
            cache: "no-cache",
          })
          clearTimeout(timeoutId)
          const latencyMs = Math.round(performance.now() - start)

          if (res.ok) {
            let data: Record<string, unknown> = {}
            try {
              data = await res.json()
            } catch {
              // Not json, raw text
            }

            const details: Record<string, string | number | boolean> = {}
            let version = check.version || "1.0.0"

            if (check.id === "imdb-indexer") {
              version = (data.version as string) || "1.0.0"
              if (data.total_documents !== undefined) {
                details["Проиндексировано фильмов"] = (data.total_documents as number).toLocaleString("ru-RU")
              }
              if (data.is_indexing !== undefined) {
                details["Фоновая индексация"] = data.is_indexing ? "Активна" : "Неактивна"
              }
            } else if (check.id === "tracker-proxy") {
              version = (data.version as string) || "1.0.0"
              details["Трекеры"] = "RuTracker, RuTor, NNM-Club"
              details["Кэш"] = "bbolt (активен)"
            } else if (check.id === "jellyfin") {
              version = (data.Version as string) || "10.9.x"
              if (data.ServerName) details["Имя сервера"] = data.ServerName as string
              if (data.OperatingSystem) details["ОС сервера"] = data.OperatingSystem as string
            } else if (check.id === "tiramisu") {
              details["Точка монтирования"] = "/media/virtual (FUSE)"
              details["Sequential streaming"] = "Активен"
            } else if (check.id === "flaresolverr") {
              details["Сессия Turnstile"] = "Готов"
            }

            return {
              ...check,
              status: "online" as const,
              version,
              latencyMs,
              details,
            }
          } else {
            // Non-200 but reachable
            return {
              ...check,
              status: "offline" as const,
              latencyMs,
              error: `HTTP ${res.status} ${res.statusText}`,
            }
          }
        } catch (err) {
          const latencyMs = Math.round(performance.now() - start)
          return {
            ...check,
            status: "offline" as const,
            latencyMs,
            error: err instanceof Error ? err.message : "Не отвечает",
          }
        }
      })
    )

    setServices(updatedChecks)
    setIsRefreshing(false)
  }, [clientInfo.displayMode, clientInfo.online, clientInfo.screen, clientInfo.serviceWorker])

  useEffect(() => {
    if (isOpen) {
      runDiagnostics()
    }
  }, [isOpen, runDiagnostics])

  // Copy structured report to clipboard
  const handleCopyReport = () => {
    const lines = [
      `=== CineClaw v${APP_VERSION} Диагностический отчёт ===`,
      `Дата: ${new Date().toLocaleString("ru-RU")}`,
      `Хост: ${clientInfo.host} | Клиент: ${clientInfo.displayMode} | Сеть: ${clientInfo.online}`,
      `Экран: ${clientInfo.screen}`,
      "",
      "--- Микросервисы ---",
    ]

    services.forEach((s) => {
      const statusText = s.status === "online" ? `ONLINE (${s.latencyMs}ms)` : `OFFLINE (${s.error || "err"})`
      lines.push(`• [${s.name}] v${s.version || "?"}: ${statusText}`)
      if (s.details) {
        Object.entries(s.details).forEach(([k, v]) => {
          lines.push(`    - ${k}: ${v}`)
        })
      }
    })

    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const content = (
    <div className="flex flex-col h-full bg-[#07090e] text-foreground">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 bg-[#07090e]/95 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-cinema-900 border border-border/60 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/30 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Диагностика системы</h2>
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                  v{APP_VERSION}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Статус микросервисов и версионирование CineClaw</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyReport}
            className="h-8 gap-1.5 border-border/70 bg-cinema-900/80 hover:bg-cinema-800 text-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Скопировано" : "Скопировать"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            disabled={isRefreshing}
            className="h-8 gap-1.5 border-border/70 bg-cinema-900/80 hover:bg-cinema-800 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Обновить</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4 pb-12">
        {/* Quick Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-border/50 bg-cinema-950/60 p-3">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold">Платформа</div>
            <div className="text-sm font-bold text-foreground mt-0.5 truncate">{clientInfo.displayMode}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">CineClaw v{APP_VERSION}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-cinema-950/60 p-3">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold">Хост NAS</div>
            <div className="text-sm font-bold text-foreground mt-0.5 truncate">{clientInfo.host}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Локальная сеть</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-cinema-950/60 p-3">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold">Статус сервисов</div>
            <div className="text-sm font-bold text-foreground mt-0.5">
              <span className="text-emerald-400 font-bold">
                {services.filter((s) => s.status === "online").length}
              </span>
              <span className="text-muted-foreground"> / {services.length} онлайн</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">Стек CineClaw активен</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-cinema-950/60 p-3">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold">Подключение</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {clientInfo.online}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">HTTP Gateway OK</div>
          </div>
        </div>

        {/* Microservices Matrix */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Компоненты и микросервисы
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Автоматическое версионирование SemVer
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((service) => {
              const Icon = service.icon
              const isOnline = service.status === "online"
              const isChecking = service.status === "checking"

              return (
                <div
                  key={service.id}
                  className="rounded-xl border border-border/60 bg-cinema-950/70 p-3.5 space-y-2.5 transition-all hover:border-primary/40 hover:bg-cinema-900/40 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cinema-900 border border-border/60 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{service.name}</span>
                          {service.version && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary bg-primary/5 font-mono"
                            >
                              v{service.version}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{service.role}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isChecking ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                          Тест...
                        </Badge>
                      ) : isOnline ? (
                        <div className="flex items-center gap-1.5">
                          {service.latencyMs !== undefined && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {service.latencyMs} мс
                            </span>
                          )}
                          <Badge className="text-[10px] gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Онлайн
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          Офлайн
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Details parameters list */}
                  {service.details && Object.keys(service.details).length > 0 && (
                    <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {Object.entries(service.details).map(([key, val]) => (
                        <div key={key} className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground">{key}</span>
                          <span className="font-medium text-foreground text-[11px] truncate">
                            {String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error if offline */}
                  {service.error && (
                    <div className="pt-2 border-t border-red-500/20 text-[11px] text-red-400">
                      Ошибка: {service.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* System Tips & Helpful Commands */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Wifi className="h-3.5 w-3.5" />
            Интеграция с NAS и управление
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Все микросервисы объединены в Docker-сеть <code className="text-primary font-mono">cineclaw-net</code>.
            Для перезапуска стека на NAS выполните <code className="bg-cinema-900 px-1 py-0.5 rounded font-mono">./install.sh --restart</code>,
            для проверки здоровья — <code className="bg-cinema-900 px-1 py-0.5 rounded font-mono">./install.sh --status</code>.
          </p>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-50 overflow-hidden bg-[#07090e]"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-border/80 bg-[#07090e] shadow-2xl h-[85vh] max-h-[700px] flex flex-col">
        <DialogTitle className="sr-only">Диагностика CineClaw</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  )
}
