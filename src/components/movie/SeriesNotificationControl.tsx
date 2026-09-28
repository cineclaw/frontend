import { useState, useEffect } from 'react'
import { BellRing, BellOff, Check, Loader2, Sparkles } from 'lucide-react'
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

  const { isSupported, permission, isSubscribed, subscribe } = useWebPush()

  const [isActive, setIsActive] = useState<boolean>(true)
  const [selectedStudio, setSelectedStudio] = useState<string>('')
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false)

  useEffect(() => {
    if (sub) {
      setIsActive(sub.is_active)
      if (sub.preferred_studio) {
        setSelectedStudio(sub.preferred_studio)
      }
    }
  }, [sub])

  const handleToggleActive = async () => {
    // If enabling and push is not subscribed or permission default, request permission first
    if (!isActive && isSupported && (!isSubscribed || permission !== 'granted')) {
      const ok = await subscribe()
      if (!ok && permission === 'denied') {
        alert('Пожалуйста, разрешите уведомления в настройках браузера для получения оповещений о новых сериях.')
        return
      }
    }

    const nextActive = !isActive
    setIsActive(nextActive)

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
        'rounded-xl border border-border/80 bg-cinema-900/60 p-2.5 transition-all text-xs space-y-2',
        isActive ? 'border-primary/40 bg-primary/5' : 'opacity-85',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isLoadingSub || isUpdating}
          className={cn(
            'flex items-center gap-2 font-medium transition-colors cursor-pointer select-none text-left',
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
            <span className="font-semibold block">
              {isActive ? (title ? `«${title}»: уведомления включены` : 'Уведомления о новых сериях включены') : 'Уведомлять о выходе новых серий'}
            </span>
            <span className="text-[10px] text-zinc-400 block font-normal">
              {isActive
                ? selectedStudio && selectedStudio !== 'любая'
                  ? `Сразу при релизе + в озвучке ${selectedStudio}`
                  : 'Сразу при появлении первой русской озвучки'
                : 'Нажмите, чтобы включить PWA Push'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
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
            title={isActive ? 'Отключить уведомления' : 'Включить уведомления'}
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

      {isActive && (
        <div className="pt-1 border-t border-border/40 flex flex-wrap items-center gap-2">
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
      )}
    </div>
  )
}
