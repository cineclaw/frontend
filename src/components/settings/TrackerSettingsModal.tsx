import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cookie,
  Laptop,
  Flame,
  Info,
} from "lucide-react"
import {
  useGetTrackersStatusQuery,
  useUpdateRuTrackerCookieMutation,
  useTestRuTrackerMutation,
} from "@/api/moviesApi"

interface TrackerSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TrackerSettingsModal({ isOpen, onClose }: TrackerSettingsModalProps) {
  const { data: trackers, isLoading, refetch } = useGetTrackersStatusQuery(undefined, {
    skip: !isOpen,
    pollingInterval: isOpen ? 10000 : 0,
  })

  const [updateCookie, { isLoading: isUpdating }] = useUpdateRuTrackerCookieMutation()
  const [testRuTracker, { isLoading: isTesting }] = useTestRuTrackerMutation()

  const [cookieInput, setCookieInput] = useState("")
  const [userAgentInput, setUserAgentInput] = useState("")
  const [testResult, setTestResult] = useState<{
    type: "success" | "error" | "info"
    message: string
  } | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isUaCopied, setIsUaCopied] = useState(false)

  // Pre-fill user agent with current browser user agent if available
  useEffect(() => {
    if (typeof navigator !== "undefined" && !userAgentInput) {
      setUserAgentInput(navigator.userAgent)
    }
  }, [isOpen])

  // Set existing masked cookie if available
  useEffect(() => {
    if (trackers?.rutracker?.user_agent && !userAgentInput) {
      setUserAgentInput(trackers.rutracker.user_agent)
    }
  }, [trackers])

  const handleFillBrowserUA = () => {
    if (typeof navigator !== "undefined") {
      setUserAgentInput(navigator.userAgent)
      setIsUaCopied(true)
      setTimeout(() => setIsUaCopied(false), 2000)
    }
  }

  const handleSaveCookie = async () => {
    if (!cookieInput.trim()) {
      setTestResult({
        type: "error",
        message: "Пожалуйста, вставьте строку Cookie или значения cf_clearance и bb_session",
      })
      return
    }

    setTestResult(null)
    try {
      const res = await updateCookie({
        cookie: cookieInput.trim(),
        user_agent: userAgentInput.trim() || (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
      }).unwrap()

      if (res.ok) {
        setTestResult({
          type: "success",
          message: res.message || "RuTracker успешно подключен и готов к поиску!",
        })
        setCookieInput("")
      } else {
        setTestResult({
          type: "error",
          message: res.message || "Ошибка подключения: проверьте правильность куки cf_clearance",
        })
      }
    } catch (err: any) {
      setTestResult({
        type: "error",
        message: err?.data?.message || err?.message || "Не удалось отправить куки на сервер",
      })
    }
  }

  const handleRunTest = async () => {
    setTestResult(null)
    try {
      const res = await testRuTracker().unwrap()
      if (res.ok) {
        setTestResult({
          type: "success",
          message: res.message || "Связь с RuTracker стабильна (200 OK)",
        })
      } else {
        setTestResult({
          type: "error",
          message: res.message || "RuTracker не ответил: обновите cookie или cf_clearance",
        })
      }
    } catch (err: any) {
      setTestResult({
        type: "error",
        message: err?.data?.message || err?.message || "Ошибка при проверке подключения",
      })
    }
  }

  const rutrackerStatus = trackers?.rutracker
  const isRutrackerOnline = rutrackerStatus?.has_cookie && rutrackerStatus?.has_cf_clearance

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-cinema-950/95 border-border/80 text-foreground p-0 overflow-hidden shadow-2xl backdrop-blur-2xl rounded-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 border-b border-border/50 bg-gradient-to-b from-cinema-900/80 to-transparent shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                  Статус и авторизация трекеров
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Управление подключением к RuTor, NNM-Club и RuTracker
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 px-2.5 rounded-lg border-border/60 bg-cinema-900/60 hover:bg-cinema-800 text-xs text-zinc-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Обновить
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Tracker Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* RuTor Card */}
            <div className="rounded-xl border border-border/60 bg-cinema-900/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-zinc-200 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-emerald-400" />
                  RuTor
                </span>
                <Badge variant="default" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                  Онлайн
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Открытый трекер. Регистрация и куки не требуются.
              </p>
              <div className="mt-2 text-[10px] text-zinc-400 truncate">
                rutor.info
              </div>
            </div>

            {/* NNM-Club Card */}
            <div className="rounded-xl border border-border/60 bg-cinema-900/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  NNM-Club
                </span>
                <Badge variant="default" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                  Онлайн
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Авторизация по логину <span className="text-zinc-200 font-mono font-medium">{trackers?.nnmclub?.username || "andvikt"}</span>
              </p>
              <div className="mt-2 text-[10px] text-zinc-400 truncate">
                nnmclub.to
              </div>
            </div>

            {/* RuTracker Card */}
            <div className="rounded-xl border border-border/60 bg-cinema-900/40 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-zinc-200 flex items-center gap-1.5">
                  <Cookie className="h-4 w-4 text-amber-400" />
                  RuTracker
                </span>
                {isRutrackerOnline ? (
                  <Badge variant="default" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                    Активен
                  </Badge>
                ) : (
                  <Badge variant="default" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0 h-4 animate-pulse">
                    Нужна кука
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Логин: <span className="text-zinc-200 font-mono font-medium">{trackers?.rutracker?.username || "stdevil3"}</span>
              </p>
              <div className="mt-2 text-[10px] text-zinc-400 truncate">
                rutracker.org
              </div>
            </div>
          </div>

          {/* RuTracker Cookie Setup Section */}
          <div className="rounded-2xl border border-border/70 bg-cinema-900/50 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-zinc-100 flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-primary" />
                  Авторизация и Cloudflare Cookie для RuTracker
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Для обхода защиты Cloudflare Turnstile вставьте строку Cookie из вашего браузера (живет от 1 до 3 месяцев).
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRunTest}
                disabled={isTesting || isUpdating}
                className="h-8 px-3 rounded-lg border-border/70 bg-cinema-800 hover:bg-cinema-700 text-xs shrink-0"
              >
                <RefreshCw className={`h-3 w-3 mr-1.5 ${isTesting ? "animate-spin" : ""}`} />
                Проверить связь
              </Button>
            </div>

            {/* Current Status Info */}
            {rutrackerStatus?.masked_cookie && (
              <div className="rounded-xl bg-cinema-950/80 border border-border/50 p-3 text-xs space-y-1 font-mono">
                <div className="text-muted-foreground text-[11px]">Текущие сохраненные куки:</div>
                <div className="text-emerald-400 break-all text-[11px]">
                  {rutrackerStatus.masked_cookie}
                </div>
              </div>
            )}

            {/* Cookie Textarea Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Строка Cookie (bb_session, cf_clearance, bb_guid)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  (из DevTools браузера)
                </span>
              </label>
              <textarea
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                placeholder="bb_session=0-7284165-...; cf_clearance=usC5dvUSe19a...; bb_guid=eqv5vH1WzIUP"
                rows={3}
                className="w-full rounded-xl border border-border/80 bg-cinema-950/90 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all resize-none"
              />
            </div>

            {/* User-Agent Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  User-Agent браузера
                </label>
                <button
                  type="button"
                  onClick={handleFillBrowserUA}
                  className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer"
                >
                  {isUaCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Laptop className="h-3 w-3" />}
                  <span>{isUaCopied ? "Вставлено!" : "Использовать мой текущий User-Agent"}</span>
                </button>
              </div>
              <input
                type="text"
                value={userAgentInput}
                onChange={(e) => setUserAgentInput(e.target.value)}
                placeholder="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ..."
                className="w-full rounded-xl border border-border/80 bg-cinema-950/90 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Feedback Alert */}
            {testResult && (
              <div
                className={`rounded-xl p-3 text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95 ${
                  testResult.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : testResult.type === "error"
                    ? "bg-red-500/10 border border-red-500/30 text-red-300"
                    : "bg-cinema-800 border border-border text-zinc-300"
                }`}
              >
                {testResult.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {testResult.type === "success" ? "Успешное подключение" : "Результат проверки"}
                  </div>
                  <div className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                    {testResult.message}
                  </div>
                </div>
              </div>
            )}

            {/* Save & Action Button */}
            <div className="flex items-center justify-end pt-2">
              <Button
                onClick={handleSaveCookie}
                disabled={isUpdating || isTesting}
                className="w-full sm:w-auto px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-900/30"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Сохранение и проверка...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-2" />
                    Сохранить и проверить связь
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick 10-second guide accordion */}
          <div className="rounded-xl border border-border/50 bg-cinema-900/30 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="w-full p-3.5 flex items-center justify-between font-semibold text-zinc-300 hover:text-white hover:bg-cinema-800/40 transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Инструкция: как скопировать куки из браузера за 10 секунд
              </span>
              {isGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isGuideOpen && (
              <div className="p-4 pt-1 border-t border-border/40 text-muted-foreground space-y-2.5 text-[11px] leading-relaxed">
                <div className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-cinema-800 border border-border flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">
                    1
                  </span>
                  <div>
                    Откройте сайт <a href="https://rutracker.org" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">rutracker.org <ExternalLink className="h-2.5 w-2.5" /></a> в вашем браузере (где вы уже авторизованы и прошли Cloudflare).
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-cinema-800 border border-border flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">
                    2
                  </span>
                  <div>
                    Нажмите клавишу <kbd className="px-1.5 py-0.5 rounded bg-cinema-800 border border-border font-mono text-zinc-200">F12</kbd> (или правый клик → <span className="text-zinc-200">Просмотреть код</span>), перейдите на вкладку <span className="text-zinc-200 font-semibold">Application</span> (в Safari: <span className="text-zinc-200 font-semibold">Хранилище</span>, в Firefox: <span className="text-zinc-200 font-semibold">Хранилище</span>) → слева раскройте <span className="text-zinc-200">Cookies</span> → выберите <span className="text-zinc-200">https://rutracker.org</span>.
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-cinema-800 border border-border flex items-center justify-center font-bold text-zinc-200 shrink-0 text-[10px]">
                    3
                  </span>
                  <div>
                    Скопируйте значения <span className="text-emerald-400 font-mono">cf_clearance</span> и <span className="text-emerald-400 font-mono">bb_session</span> (или перейдите во вкладку <span className="text-zinc-200 font-semibold">Network</span>, обновите страницу и скопируйте заголовок <span className="text-zinc-200 font-mono">Cookie</span> из любого запроса к rutracker.org), вставьте в поле выше и нажмите <span className="text-zinc-200 font-semibold">«Сохранить и проверить связь»</span>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
