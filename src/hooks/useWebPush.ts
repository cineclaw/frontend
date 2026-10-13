import { useState, useEffect, useCallback } from 'react'
import {
  useGetVapidKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useSendTestNotificationMutation,
} from '@/api/torrentsApi'
import { useActiveProfile } from '@/lib/userSettings'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function checkIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker не поддерживается')
  }

  // 1. Check existing registration
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing && existing.active) {
    return existing
  }

  // 2. Ensure /sw.js is registered
  if (!existing) {
    await navigator.serviceWorker.register('/sw.js')
  }

  // 3. Await ready state
  return await navigator.serviceWorker.ready
}

export function useWebPush() {
  const isIOS = checkIsIOS()
  const isStandalone = checkIsStandalone()
  const needsHomeScreenInstall = isIOS && !isStandalone

  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: vapidData } = useGetVapidKeyQuery()
  const [subscribeMutation] = useSubscribePushMutation()
  const [unsubscribeMutation] = useUnsubscribePushMutation()
  const [sendTestMutation] = useSendTestNotificationMutation()
  const [activeProfile] = useActiveProfile()

  const refreshSubscriptionStatus = useCallback(async () => {
    if (typeof window === 'undefined') return
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      try {
        const reg = await getServiceWorkerRegistration()
        const sub = await reg.pushManager.getSubscription()
        setIsSubscribed(Boolean(sub))
      } catch (err) {
        setIsSubscribed(false)
      }
    } else {
      setPermission('unsupported')
    }
  }, [])

  useEffect(() => {
    refreshSubscriptionStatus()
  }, [refreshSubscriptionStatus])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (needsHomeScreenInstall) {
      setError('На iOS для получения push-уведомлений добавьте приложение на экран «Домой» (Поделиться ➔ На экран «Домой»)')
      return false
    }

    if (!isSupported) {
      setError('Web Push не поддерживается в этом браузере')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Resolve VAPID Public Key (cache or direct fetch fallback)
      let pubKey = vapidData?.public_key
      if (!pubKey) {
        try {
          const res = await fetch('/api/notifications/vapid-key', { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            pubKey = data.public_key
          }
        } catch {}
      }

      if (!pubKey) {
        setError('Не удалось получить VAPID ключ с сервера')
        setIsLoading(false)
        return false
      }

      // 2. Request Notification Permission
      let currentPerm = Notification.permission
      if (currentPerm === 'default') {
        currentPerm = await Notification.requestPermission()
        setPermission(currentPerm)
      }

      if (currentPerm !== 'granted') {
        setError(currentPerm === 'denied' ? 'Уведомления заблокированы пользователем в браузере' : 'Разрешение на уведомления не получено')
        setIsLoading(false)
        return false
      }

      // 3. Register SW & Subscribe via PushManager
      const reg = await getServiceWorkerRegistration()
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(pubKey)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource,
        })
      }

      // 4. Send subscription keys to backend
      const subJson = sub.toJSON()
      const p256dh = subJson.keys?.p256dh || ''
      const auth = subJson.keys?.auth || ''

      await subscribeMutation({
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        profile: activeProfile || 'default',
      }).unwrap()

      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (err: any) {
      console.error('[WebPush] Subscription error:', err)
      setError(err?.message || 'Не удалось подписаться на push-уведомления')
      setIsLoading(false)
      return false
    }
  }, [needsHomeScreenInstall, isSupported, vapidData, subscribeMutation, activeProfile])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)
    try {
      const reg = await getServiceWorkerRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribeMutation({ endpoint: sub.endpoint }).unwrap()
        await sub.unsubscribe()
      }
      setIsSubscribed(false)
      setIsLoading(false)
      return true
    } catch (err: any) {
      console.error('[WebPush] Unsubscribe error:', err)
      setError(err?.message || 'Ошибка отписки')
      setIsLoading(false)
      return false
    }
  }, [isSupported, unsubscribeMutation])

  const sendTest = useCallback(async () => {
    try {
      const res = await sendTestMutation({
        title: 'CineClaw Cinema',
        body: 'Тестовое уведомление успешно получено!',
        profile: activeProfile || 'default',
      }).unwrap()
      return res.success && res.sent_count > 0
    } catch (err) {
      console.error('[WebPush] Test notification error:', err)
      return false
    }
  }, [sendTestMutation, activeProfile])

  return {
    isSupported,
    isIOS,
    isStandalone,
    needsHomeScreenInstall,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
    refreshSubscriptionStatus,
  }
}
