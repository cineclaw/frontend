import { useState, useEffect } from 'react'
import { BellRing, BellOff, Check, Loader2, Sparkles, Send, Share, AlertTriangle } from 'lucide-react'
import {
  useGetSeriesSubscriptionQuery,
  useSetSeriesSubscriptionMutation,
  useGetSeriesStudiosQuery,
} from '@/api/torrentsApi'
import { useWebPush } from '@/hooks/useWebPush'
import { useActiveProfile } from '@/lib/userSettings'
import { cn } from '@/lib/utils'

interface SeriesNotificationControlProps {
  imdbId: string
  title?: string
  className?: string
}

export function SeriesNotificationControl({
  imdbId,
  title,
  className,
}: SeriesNotificationControlProps) {
  const [activeProfile] = useActiveProfile()
  const profileName = activeProfile || 'default'

  const { data: sub, isLoading: isLoadingSub } = useGetSeriesSubscriptionQuery({
    imdb_id: imdbId,
    profile: profileName,
  })
  const { data: studiosData } = useGetSeriesStudiosQuery()
  const [setSubscription, { isLoading: isUpdating }] = useSetSeriesSubscriptionMutation()

  const {
    needsHomeScreenInstall,
    permission,
    isSubscribed,
    isLoading: isLoadingPush,
    subscribe,
    sendTest,
  } = useWebPush()

  const [isActive, setIsActive] = useState<boolean>(true)
  const [selectedStudio, setSelectedStudio] = useState<string>('')
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false)
  const [testSent, setTestSent] = useState<boolean>(false)
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false)

  useEffect(() => {
    if (sub) {
      setIsActive(sub.is_active)
      if (sub.preferred_studio) {
        setSelectedStudio(sub.preferred_studio)
      }
    }
  }, [sub])

  const handleToggleActive = async () => {
    const nextActive = !isActive
    setIsActive(nextActive)

    // If user is turning notifications ON and device is not yet subscribed, prompt to subscribe device!
    if (nextActive && (!isSubscribed || permission !== 'granted') && !needsHomeScreenInstall) {
      await subscribe()
    }

    try {
      await setSubscription({
        imdb_id: imdbId,
        profile: profileName,
        preferred_studio: selectedStudio,
        is_active: nextActive,
      }).unwrap()

      setShowSavedFeedback(true)
      setTimeout(() => setShowSavedFeedback(false), 2000)
    } catch (err) {
      console.error('Failed to toggle series subscription:', err)
      setIsActive(!nextActive)
    }
  }

  const handleStudioChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStudio = e.target.value
    setSelectedStudio(nextStudio)

    try {
      await setSubscription({
        imdb_id: imdbId,
        profile: profileName,
        preferred_studio: nextStudio,
        is_active: isActive,
      }).unwrap()

      setShowSavedFeedback(true)
      setTimeout(() => setShowSavedFeedback(false), 2000)
    } catch (err) {
      console.error('Failed to update preferred studio:', err)
    }
  }

  const handleSubscribeDevice = async () => {
    const ok = await subscribe()
    if (ok) {
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
    }
  }

  const studios = studiosData?.studios || [
    'Red Head Sound',
    'Кубик в Кубе',
    'LostFilm',
    'HDRezka Studio',
    'TVShows',
    'NewStudio',
    'ViruseProject',
    'Кураж-Бамбей',
    'Дубляж',
  ]

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-cinema-900/60 p-3 transition-all text-xs space-y-2.5 shadow-sm',
        isActive ? 'border-primary/40 bg-primary/5' : 'opacity-85',
        className
      )}
    >
      {/* 1. Main Series Tracking Toggle */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isLoadingSub || isUpdating}
          className={cn(
            'flex items-center gap-2.5 font-medium transition-colors cursor-pointer select-none text-left',
            isActive ? 'text-primary hover:text-primary/80' : 'text-zinc-400 hover:text-zinc-300'
          )}
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          ) : isActive ? (
            <BellRing className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          ) : (
            <BellOff className="w-4 h-4 text-zinc-500 shrink-0" />
          )}

          <div className="leading-tight">
            <span className="font-semibold text-xs block text-white">
              {isActive
                ? title
                  ? `«${title}»: отслеживание включено`
                  : 'Отслеживание сериала включено'
                : 'Отслеживать выход новых серий'}
            </span>
            <span className="text-[10px] text-zinc-400 block font-normal mt-0.5">
              {isActive
                ? selectedStudio && selectedStudio !== 'любая'
                  ? `Сразу при релизе + повторно в озвучке ${selectedStudio}`
                  : 'Сразу при появлении первой русской озвучки'
                : 'Нажмите для включения мониторинга новых серий'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {showSavedFeedback && (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5 animate-fade-in">
              <Check className="w-3 h-3" /> Сохранено
            </span>
          )}

          <button
            type="button"
            onClick={handleToggleActive}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              isActive ? 'bg-primary' : 'bg-cinema-700'
            )}
            title={isActive ? 'Отключить отслеживание' : 'Включить отслеживание'}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out',
                isActive ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* 2. Device Push Status Callout (CRITICAL: alerts user if device hasn't allowed push yet!) */}
      {isActive && (
        <>
          {needsHomeScreenInstall ? (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                <Share className="w-3.5 h-3.5" />
                <span>Для пушей на iOS: добавьте на экран «Домой»</span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-tight">
                Нажмите «Поделиться» внизу экрана ➔ «На экран «Домой»», чтобы получать пуши при закрытом приложении.
              </p>
            </div>
          ) : permission === 'denied' ? (
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="leading-tight text-[10px]">
                <span className="font-semibold block text-red-300">Уведомления заблокированы</span>
                <span>Разрешите уведомления в настройках браузера для этого сайта.</span>
              </div>
            </div>
          ) : !isSubscribed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 animate-in fade-in">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <div className="leading-tight">
                  <span className="font-semibold block text-xs text-amber-300">
                    Устройство не подключено к пушам
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    Разрешите браузеру отправку уведомлений
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSubscribeDevice}
                disabled={isLoadingPush}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black font-extrabold text-[11px] shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isLoadingPush ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Включить'
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 pt-0.5">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Это устройство подключено к Web Push</span>
              </span>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1 font-medium"
              >
                {isSendingTest ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : testSent ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                <span>{testSent ? 'Доставлено!' : 'Тест'}</span>
              </button>
            </div>
          )}

          {/* 3. Preferred Studio Voiceover Selector */}
          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-zinc-400 flex items-center gap-1 shrink-0 font-medium">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Приоритетная озвучка:</span>
            </label>

            <select
              value={selectedStudio}
              onChange={handleStudioChange}
              disabled={isUpdating}
              className="flex-1 min-w-[130px] h-7 px-2 rounded-lg bg-cinema-800 border border-border/70 text-zinc-200 text-xs focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="">Любая (первая вышедшая)</option>
              {studios.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
