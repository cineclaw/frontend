import { useState, useRef, useEffect } from 'react'
import { Bell, BellRing, BellOff, Check, Loader2, Sparkles, Send, Share, AlertTriangle } from 'lucide-react'
import { useWebPush } from '@/hooks/useWebPush'
import { cn } from '@/lib/utils'

export function NotificationBellButton() {
  const {
    needsHomeScreenInstall,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  } = useWebPush()

  const [isOpen, setIsOpen] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSubscribe = async () => {
    const ok = await subscribe()
    if (ok) {
      // Auto-send a test welcome push so the user immediately sees it works!
      setTimeout(() => {
        sendTest()
      }, 500)
    }
  }

  const handleSendTest = async () => {
    setIsSendingTest(true)
    const ok = await sendTest()
    setIsSendingTest(false)
    if (ok) {
      setTestSent(true)
      setTimeout(() => setTestSent(false), 3000)
    } else {
      alert('Не удалось отправить тестовое уведомление. Проверьте разрешения устройства.')
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Уведомления о новых сериях"
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer focus:outline-none shadow-sm',
          isSubscribed && permission === 'granted'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : permission === 'denied'
            ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
            : 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 animate-pulse'
        )}
      >
        {isSubscribed ? (
          <Bell className="w-3.5 h-3.5" />
        ) : permission === 'denied' ? (
          <BellOff className="w-3.5 h-3.5" />
        ) : (
          <BellRing className="w-3.5 h-3.5" />
        )}

        {/* Status dot */}
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-cinema-950',
            isSubscribed && permission === 'granted'
              ? 'bg-emerald-500'
              : permission === 'denied'
              ? 'bg-red-500'
              : 'bg-amber-400 animate-ping'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-cinema-900/98 border border-border/80 p-3.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 text-xs text-zinc-300 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-white text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Push-уведомления</span>
            </div>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                isSubscribed && permission === 'granted'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : permission === 'denied'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-300'
              )}
            >
              {isSubscribed && permission === 'granted'
                ? 'Активны'
                : permission === 'denied'
                ? 'Заблокированы'
                : 'Не подключены'}
            </span>
          </div>

          {needsHomeScreenInstall ? (
            <div className="space-y-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                <Share className="w-4 h-4" />
                <span>Требуется установка на iOS</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-300">
                Apple разрешает Web Push на iPhone/iPad только для приложений с экрана «Домой»:
              </p>
              <ol className="text-[11px] list-decimal list-inside space-y-1 text-zinc-300 pl-1">
                <li>Нажмите иконку <strong>«Поделиться»</strong> в Safari (квадрат со стрелкой).</li>
                <li>Выберите <strong>«На экран «Домой»»</strong>.</li>
                <li>Откройте CineClaw с иконки и включите уведомления.</li>
              </ol>
            </div>
          ) : permission === 'denied' ? (
            <div className="space-y-1.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-[11px]">
              <div className="flex items-center gap-1 font-semibold text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Уведомления запрещены в браузере</span>
              </div>
              <p>
                Вы заблокировали отправку уведомлений для этого сайта. Чтобы получать оповещения, откройте настройки сайта в адресной строке и включите «Уведомления».
              </p>
            </div>
          ) : !isSubscribed ? (
            <div className="space-y-2.5">
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Получайте мгновенные оповещения при выходе новых серий и озвучек (даже когда приложение закрыто).
              </p>
              {error && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px]">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={isLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
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
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Это устройство успешно зарегистрировано и готово принимать пуши.</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-border/80 bg-cinema-800 hover:bg-cinema-750 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  ) : testSent ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Send className="w-3 h-3 text-primary" />
                  )}
                  <span>{testSent ? 'Отправлено!' : 'Отправить тест'}</span>
                </button>

                <button
                  type="button"
                  onClick={unsubscribe}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg text-zinc-500 hover:text-red-400 text-[11px] transition-colors cursor-pointer"
                >
                  Отключить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
