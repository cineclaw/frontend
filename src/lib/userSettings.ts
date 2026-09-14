import { useState, useEffect, useCallback } from "react"
import type { QualityTier } from "./torrentSelector"
import { pickBestTorrentForQuality, scoreTorrent } from "./torrentSelector"
import type { TorrentResult } from "@/api/torrentsApi"

export type QualityPreference = QualityTier

const QUALITY_STORAGE_KEY = "cineclaw_default_quality"
const QUALITY_EVENT_NAME = "cineclaw_quality_changed"

export const QUALITY_OPTIONS: {
  tier: QualityPreference
  label: string
  shortLabel: string
  resolution: string
}[] = [
  { tier: "1080p", label: "1080p Full HD (Рекомендуется)", shortLabel: "1080p", resolution: "1080p" },
  { tier: "4k", label: "4K Ultra HD", shortLabel: "4K UHD", resolution: "2160p" },
  { tier: "720p", label: "720p HD", shortLabel: "720p", resolution: "720p" },
  { tier: "sd", label: "SD Качество", shortLabel: "SD", resolution: "480p" },
]

export function getDefaultQuality(): QualityPreference {
  if (typeof window === "undefined") return "1080p"
  const stored = localStorage.getItem(QUALITY_STORAGE_KEY)
  if (stored === "4k" || stored === "1080p" || stored === "720p" || stored === "sd") {
    return stored
  }
  return "1080p"
}

export function setDefaultQuality(quality: QualityPreference): void {
  if (typeof window === "undefined") return
  localStorage.setItem(QUALITY_STORAGE_KEY, quality)
  window.dispatchEvent(
    new CustomEvent(QUALITY_EVENT_NAME, { detail: quality })
  )
}

export function useDefaultQuality(): [QualityPreference, (q: QualityPreference) => void] {
  const [quality, setQualityState] = useState<QualityPreference>(getDefaultQuality)

  useEffect(() => {
    const handleQualityChange = (e: Event) => {
      const customEvent = e as CustomEvent<QualityPreference>
      if (customEvent.detail) {
        setQualityState(customEvent.detail)
      } else {
        setQualityState(getDefaultQuality())
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === QUALITY_STORAGE_KEY) {
        setQualityState(getDefaultQuality())
      }
    }

    window.addEventListener(QUALITY_EVENT_NAME, handleQualityChange)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener(QUALITY_EVENT_NAME, handleQualityChange)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const setQuality = useCallback((newQuality: QualityPreference) => {
    setDefaultQuality(newQuality)
    setQualityState(newQuality)
  }, [])

  return [quality, setQuality]
}

/**
 * Select the best torrent matching the user's preferred quality,
 * falling back gracefully to adjacent tiers if preferred tier has no releases.
 */
export function selectPreferredTorrent(
  torrents: TorrentResult[] | undefined,
  preferred: QualityPreference = "1080p",
  targetSeason?: number | null,
  isSeries?: boolean
): TorrentResult | null {
  if (!torrents || torrents.length === 0) return null

  // Fallback preference hierarchy
  const tierPriorities: Record<QualityPreference, QualityTier[]> = {
    "1080p": ["1080p", "4k", "720p", "sd"],
    "4k": ["4k", "1080p", "720p", "sd"],
    "720p": ["720p", "1080p", "4k", "sd"],
    "sd": ["sd", "720p", "1080p", "4k"],
  }

  const searchOrder = tierPriorities[preferred] || tierPriorities["1080p"]

  for (const tier of searchOrder) {
    const candidate = pickBestTorrentForQuality(torrents, tier, targetSeason, isSeries)
    if (candidate) {
      return candidate
    }
  }

  // If no tier match, pick the overall highest scored torrent
  let best: TorrentResult | null = null
  let bestScore = -Infinity
  for (const t of torrents) {
    const s = scoreTorrent(t, targetSeason, isSeries)
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }

  return best || torrents[0] || null
}
