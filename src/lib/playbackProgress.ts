/**
 * Local Playback Progress Management for CineClaw Web.
 *
 * Provides high-frequency client-side watch progress persistence in localStorage
 * alongside backend SQLite tracking, guaranteeing zero lost seconds on sudden
 * page reloads, tab crashes, or browser navigations.
 */

export interface LocalPlaybackRecord {
  itemId: string // e.g. "tt0133093" for movies, or "tt0903747_s1_e2" for series episodes
  tconst: string
  season?: number
  episode?: number
  positionSeconds: number
  durationSeconds: number
  isPlayed: boolean
  title?: string
  ruTitle?: string
  updatedAt: number // epoch ms
}

export interface SavePlaybackInput {
  itemId?: string
  tconst?: string
  season?: number
  episode?: number
  positionSeconds: number
  durationSeconds: number
  isPlayed: boolean
  title?: string
  ruTitle?: string
}

const STORAGE_KEY = 'cineclaw_playback_progress'
const MAX_LOCAL_RECORDS = 200

// High-performance in-memory cache to eliminate repeated JSON.parse and disk deserialization
let memoryCache: Record<string, LocalPlaybackRecord> | null = null

// Helper for test environments or cache reset
export function clearMemoryCache(): void {
  memoryCache = null
}

if (typeof window !== 'undefined') {
  // Sync memory cache across browser tabs if updated elsewhere
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      if (event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue)
          memoryCache = typeof parsed === 'object' && parsed !== null ? parsed : {}
        } catch {
          memoryCache = null
        }
      } else {
        memoryCache = {}
      }
    }
  })
}

/**
 * Normalizes an item key so movies and episodes can be reliably indexed.
 */
export function buildPlaybackItemId(
  tconst?: string,
  season?: number,
  episode?: number,
  explicitItemId?: string
): string {
  if (explicitItemId && explicitItemId.trim()) {
    return explicitItemId.trim()
  }
  const cleanTconst = (tconst || '').trim()
  if (season !== undefined && episode !== undefined && (season > 0 || episode > 0)) {
    return `${cleanTconst}_s${season}_e${episode}`
  }
  return cleanTconst
}

/**
 * Loads all playback records from memory cache or localStorage safely.
 */
export function getAllLocalPlayback(): Record<string, LocalPlaybackRecord> {
  if (memoryCache !== null) {
    return memoryCache
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memoryCache = {}
      return memoryCache
    }
    const parsed = JSON.parse(raw)
    const safeCache: Record<string, LocalPlaybackRecord> =
      typeof parsed === 'object' && parsed !== null ? parsed : {}
    memoryCache = safeCache
    return safeCache
  } catch (err) {
    console.warn('[PlaybackProgress] Failed to read from localStorage:', err)
    memoryCache = {}
    return memoryCache
  }
}

/**
 * Retrieves a specific playback record by tconst and optional season/episode, or itemId.
 */
export function getLocalPlayback(
  tconst?: string,
  season?: number,
  episode?: number,
  itemId?: string
): LocalPlaybackRecord | null {
  if (!tconst && !itemId) return null
  const all = getAllLocalPlayback()
  const key = buildPlaybackItemId(tconst, season, episode, itemId)

  if (all[key]) {
    return all[key]
  }

  // Fallback check if keyed by pure tconst for movies
  if (tconst && all[tconst]) {
    return all[tconst]
  }

  // Fallback check with _s0_e0
  if (tconst) {
    const zeroKey = `${tconst}_s0_e0`
    if (all[zeroKey]) {
      return all[zeroKey]
    }
  }

  return null
}

/**
 * Saves a playback record to localStorage.
 * Automatically manages storage quota by keeping only the most recent records.
 */
export function saveLocalPlayback(record: SavePlaybackInput): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (!record.tconst && !record.itemId) return

  try {
    const all = getAllLocalPlayback()
    const key = buildPlaybackItemId(
      record.tconst,
      record.season,
      record.episode,
      record.itemId
    )

    const fullRecord: LocalPlaybackRecord = {
      ...record,
      tconst: record.tconst || '',
      itemId: key,
      updatedAt: Date.now(),
    }

    all[key] = fullRecord

    // Also sync secondary movie key if season/episode are 0
    if (record.tconst && (!record.season || record.season === 0) && (!record.episode || record.episode === 0)) {
      all[record.tconst] = fullRecord
    }

    // Prune oldest records if exceeding maximum capacity
    const keys = Object.keys(all)
    if (keys.length > MAX_LOCAL_RECORDS) {
      const sorted = keys
        .map((k) => ({ key: k, updatedAt: all[k]?.updatedAt || 0 }))
        .sort((a, b) => b.updatedAt - a.updatedAt)

      const pruned: Record<string, LocalPlaybackRecord> = {}
      for (let i = 0; i < MAX_LOCAL_RECORDS && i < sorted.length; i++) {
        const k = sorted[i].key
        pruned[k] = all[k]
      }
      memoryCache = pruned
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
      return
    }

    memoryCache = all
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (err) {
    console.warn('[PlaybackProgress] Failed to save to localStorage:', err)
  }
}

/**
 * Removes a playback record from localStorage (e.g. when user deletes a Continue Watching item).
 */
export function removeLocalPlayback(
  tconst?: string,
  season?: number,
  episode?: number,
  itemId?: string
): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const all = getAllLocalPlayback()
    const key = buildPlaybackItemId(tconst, season, episode, itemId)

    delete all[key]
    if (tconst) {
      delete all[tconst]
      delete all[`${tconst}_s0_e0`]
    }

    memoryCache = all
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (err) {
    console.warn('[PlaybackProgress] Failed to remove from localStorage:', err)
  }
}

/**
 * Resolves the effective playback resume time adhering to the strict invariant:
 * "у локального прогресса приоритет над удаленным если он ушел дальше чем удаленный"
 */
export function resolveEffectiveResumeTime(
  remoteResumeSeconds: number | undefined | null,
  localRecord: LocalPlaybackRecord | null
): {
  effectiveResumeSeconds: number
  source: 'local' | 'remote'
  isPlayed: boolean
} {
  const remote = Math.max(0, remoteResumeSeconds || 0)
  const local = Math.max(0, localRecord?.positionSeconds || 0)

  // If locally marked as played and completed, honor isPlayed
  if (localRecord?.isPlayed) {
    return {
      effectiveResumeSeconds: 0,
      source: 'local',
      isPlayed: true,
    }
  }

  // Priority rule: if local progress is strictly further ahead than remote, local wins!
  if (local > remote) {
    return {
      effectiveResumeSeconds: local,
      source: 'local',
      isPlayed: false,
    }
  }

  return {
    effectiveResumeSeconds: remote,
    source: 'remote',
    isPlayed: false,
  }
}
