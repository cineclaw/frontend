import { useState, useEffect } from 'react'
import { BellRing, X, Sparkles, Share, Loader2 } from 'lucide-react'
import { useWebPush } from '@/hooks/useWebPush'

const STORAGE_KEY = 'cineclaw_push_banner_dismissed'

export function NotificationPromptBanner() {
  const {
    needsHomeScreenInstall,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    sendTest,
  } = useWebPush()

  const [isDismissed, setIsDismissed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissedUntil = localStorage.getItem(STORAGE_KEY)
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsDismissed(true)
    } else {
      setIsDismissed(false)
    }
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)
    // Dismiss for 7 days
    localStorage.setItem(STORAGE_KEY, (Date.now() + 7 * 86400 * 1000).toString())
  }

  const handleEnable = async () => {
    const ok = await subscribe()
    if (ok) {
      setIsDismissed(true)
      setTimeout(() => {
        sendTest()
      }, 500)
    }
  }

  // Don't show if already subscribed or permissions denied or dismissed
  if (isSubscribed || permission === 'denied' || isDismissed) {
    return null
  }

  return (
    <div className="w-full px-4 sm:px-6 pt-3 pb-1">
      <div className="mx-auto max-w-4xl relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-cinema-900 via-primary/10 to-cinema-900 p-3 sm:p-4 shadow-xl backdrop-blur-xl animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/20 border border-primary/30 text-primary shrink-0 mt-0.5 sm:mt-0">
              {needsHomeScreenInstall ? (
                <Share className="w-5 h-5 text-amber-400" />
              ) : (
                <BellRing className="w-5 h-5 animate-pulse" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                <span>
                  {needsHomeScreenInstall
                    ? 'Уведомления на iPhone / iPad'
                    : 'Включите уведомления о новых сериях'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {needsHomeScreenInstall
                  ? 'Чтобы получать пуши на iOS, сохраните CineClaw на экран «Домой»: нажмите «Поделиться» (иконка квадрата со стрелкой) ➔ «На экран «Домой»».'
                  : 'CineClaw пришлет пуш сразу, как только на трекерах появится новая серия в вашей любимой озвучке.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {!needsHomeScreenInstall ? (
              <button
                type="button"
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 sm:flex-initial py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Подключение...</span>
                  </>
                ) : (
                  <>
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Включить уведомления</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDismiss}
                className="py-1.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Понятно
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
