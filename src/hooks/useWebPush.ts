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

export function useWebPush() {
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

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
      // Check existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(Boolean(sub))
        })
      }).catch(() => {})
    } else {
      setPermission('unsupported')
    }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Web Push не поддерживается в этом браузере')
      return false
    }

    if (!vapidData?.public_key) {
      setError('VAPID ключ не получен от сервера')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      let currentPerm = Notification.permission
      if (currentPerm === 'default') {
        currentPerm = await Notification.requestPermission()
        setPermission(currentPerm)
      }

      if (currentPerm !== 'granted') {
        setError('Уведомления заблокированы пользователем')
        setIsLoading(false)
        return false
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(vapidData.public_key)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource,
        })
      }

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
      setError(err?.message || 'Не удалось подписаться на уведомления')
      setIsLoading(false)
      return false
    }
  }, [isSupported, vapidData, subscribeMutation, activeProfile])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
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
      await sendTestMutation({
        title: 'CineClaw Cinema',
        body: 'Тестовое уведомление успешно доставлено!',
        profile: activeProfile || 'default',
      }).unwrap()
      return true
    } catch (err) {
      console.error('[WebPush] Test notification error:', err)
      return false
    }
  }, [sendTestMutation, activeProfile])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  }
}
