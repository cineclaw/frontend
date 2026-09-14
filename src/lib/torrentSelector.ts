import type { TorrentResult } from "@/api/torrentsApi"

export type QualityTier = "4k" | "1080p" | "720p" | "sd"

export interface QualityOption {
  tier: QualityTier
  label: string
  shortLabel: string
  isAvailable: boolean
  isMounted: boolean
  bestTorrent: TorrentResult | null
  seeders: number
  sizeBytes: number
  audioLabel?: string
}

const QUALITY_TIERS: { tier: QualityTier; label: string; shortLabel: string }[] = [
  { tier: "4k", label: "4K Ultra HD", shortLabel: "4K UHD" },
  { tier: "1080p", label: "1080p Full HD", shortLabel: "1080p" },
  { tier: "720p", label: "720p HD", shortLabel: "720p" },
  { tier: "sd", label: "SD Качество", shortLabel: "SD" },
]

export function classifyResolution(torrent: TorrentResult): QualityTier {
  const res = (torrent.resolution || "").toLowerCase()
  const title = (torrent.title || "").toLowerCase()

  if (
    res === "4k" ||
    res === "2160p" ||
    title.includes("2160p") ||
    title.includes("4k uhd") ||
    title.includes("uhd")
  ) {
    return "4k"
  }
  if (
    res === "1080p" ||
    title.includes("1080p") ||
    title.includes("1080i") ||
    title.includes("fhd")
  ) {
    return "1080p"
  }
  if (res === "720p" || title.includes("720p") || title.includes("hd")) {
    return "720p"
  }
  return "sd"
}

export function extractAudioLabel(title: string): string {
  const lower = title.toLowerCase()
  if (
    lower.includes("дубляж") ||
    lower.includes("dub") ||
    lower.includes("лицензия") ||
    lower.includes("itunes") ||
    lower.includes("кинопоиск") ||
    lower.includes("red head sound") ||
    lower.includes("rhs")
  ) {
    return "Дубляж"
  }
  if (
    lower.includes("профессиональный") ||
    lower.includes("многоголосый") ||
    lower.includes("mvo") ||
    lower.includes("lostfilm") ||
    lower.includes("hdrezka") ||
    lower.includes("кубик в кубе") ||
    lower.includes("newstudio") ||
    lower.includes("tvshows")
  ) {
    return "Многоголосый"
  }
  if (lower.includes("двуголосый") || lower.includes("dvo")) {
    return "Двуголосый"
  }
  if (lower.includes("авторский") || lower.includes("avo")) {
    return "Авторский"
  }
  if (lower.includes("sub") || lower.includes("субтитры")) {
    return "Субтитры"
  }
  return "Русская озвучка"
}

export function extractReleaseYear(title: string): number | null {
  const m = title.match(/[\(\[]\s*(19\d{2}|20\d{2})/)
  if (m) {
    const y = parseInt(m[1], 10)
    if (y >= 1900 && y <= 2035) return y
  }
  const standalone = title.match(/\b(19\d{2}|20\d{2})\b/)
  if (standalone) {
    const y = parseInt(standalone[1], 10)
    if (y >= 1900 && y <= 2035) return y
  }
  return null
}

export function scoreTorrent(
  torrent: TorrentResult,
  targetSeason?: number | null,
  isSeries?: boolean,
  targetYear?: number | null
): number {
  let score = 0
  const title = (torrent.title || "").toLowerCase()

  // 0. Year Matching (Critical for avoiding completely wrong films)
  if (targetYear && targetYear > 0) {
    const releaseYear = extractReleaseYear(torrent.title || "")
    if (releaseYear) {
      if (!isSeries) {
        const diff = Math.abs(releaseYear - targetYear)
        if (diff === 0) {
          score += 400 // exact year match
        } else if (diff === 1) {
          score += 200 // boundary year (festival vs digital upload)
        } else {
          score -= 3000 // completely wrong movie from another decade/year!
        }
      } else {
        // TV Series
        if (releaseYear < targetYear - 1) {
          score -= 3000 // release predates series
        } else {
          score += 150 // release within series timeline
        }
      }
    }
  }

  // 1. Seeders score: Primary metric for streaming reliability
  const seeders = torrent.seeds || 0
  score += Math.min(seeders, 50) * 3 + Math.log1p(seeders) * 25

  // Heavy penalties for dead or low-seed torrents
  if (seeders === 0) {
    score -= 250
  } else if (seeders < 3) {
    score -= 100
  } else if (seeders < 6) {
    score -= 40
  }

  // 2. Audio Dub score: Minor tie-breaker (seeds are primary)
  if (
    title.includes("дубляж") ||
    title.includes("dub") ||
    title.includes("лицензия") ||
    title.includes("itunes") ||
    title.includes("кинопоиск") ||
    title.includes("red head sound") ||
    title.includes("rhs")
  ) {
    score += 10
  } else if (
    title.includes("профессиональный") ||
    title.includes("многоголосый") ||
    title.includes("mvo") ||
    title.includes("lostfilm") ||
    title.includes("hdrezka") ||
    title.includes("кубик в кубе") ||
    title.includes("newstudio")
  ) {
    score += 8
  } else if (title.includes("двуголосый") || title.includes("dvo")) {
    score += 4
  } else if (title.includes("авторский") || title.includes("avo")) {
    score += 2
  }

  // 3. Encode quality bonus
  if (
    title.includes("remux") ||
    title.includes("bdremux") ||
    title.includes("blu-ray") ||
    title.includes("bluray")
  ) {
    score += 15
  } else if (title.includes("web-dl") || title.includes("webdl") || title.includes("bdrip")) {
    score += 12
  } else if (title.includes("webrip") || title.includes("hdtv")) {
    score += 6
  }

  // Severe penalty for CAMRip / TS
  if (
    title.includes("camrip") ||
    title.includes("ts") ||
    title.includes("telesync") ||
    title.includes("экранка")
  ) {
    score -= 500
  }

  // 4. Series Season Matching
  if (isSeries && targetSeason != null) {
    const seasons = torrent.seasons || []
    if (seasons.includes(targetSeason)) {
      score += 120
      // Complete season pack bonus
      if (torrent.is_complete || seasons.length === 1) {
        score += 30
      }
    } else if (seasons.length > 0) {
      // Release is explicitly for another season
      score -= 500
    }
  }

  // 5. Size sanity check
  if (!isSeries && torrent.size && torrent.size < 500 * 1024 * 1024) {
    score -= 150
  }

  return score
}

export function pickBestTorrentForQuality(
  torrents: TorrentResult[] | undefined,
  quality: QualityTier,
  targetSeason?: number | null,
  isSeries?: boolean,
  targetYear?: number | null
): TorrentResult | null {
  if (!torrents || torrents.length === 0) return null

  const candidates = torrents.filter((t) => classifyResolution(t) === quality)
  if (candidates.length === 0) return null

  let best: TorrentResult | null = null
  let bestScore = -Infinity

  for (const t of candidates) {
    const s = scoreTorrent(t, targetSeason, isSeries, targetYear)
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }

  return best
}

export function getQualityOptions(
  torrents: TorrentResult[] | undefined,
  mountedVersions: string[] = [],
  targetSeason?: number | null,
  isSeries?: boolean,
  mountedSeasons: number[] = [],
  targetYear?: number | null
): QualityOption[] {
  const versionsUpper = mountedVersions.map((v) => v.toUpperCase())
  const isSeasonActuallyMounted =
    isSeries && targetSeason != null ? mountedSeasons.includes(targetSeason) : true

  return QUALITY_TIERS.map(({ tier, label, shortLabel }) => {
    let isMounted = false
    if (isSeasonActuallyMounted) {
      isMounted = versionsUpper.some((v) => {
        if (tier === "4k") return v.includes("4K") || v.includes("2160") || v.includes("UHD")
        if (tier === "1080p") return v.includes("1080") || v.includes("FHD")
        if (tier === "720p") return v.includes("720") || v.includes("HD")
        if (tier === "sd") return v.includes("SD") || v.includes("480")
        return false
      })
      if (!isMounted && mountedVersions.length === 0 && isSeries && isSeasonActuallyMounted) {
        if (tier === "1080p") isMounted = true
      }
    }

    const bestTorrent = pickBestTorrentForQuality(torrents, tier, targetSeason, isSeries, targetYear)
    const isAvailable = bestTorrent !== null || isMounted

    return {
      tier,
      label,
      shortLabel,
      isAvailable,
      isMounted,
      bestTorrent,
      seeders: bestTorrent?.seeds || 0,
      sizeBytes: bestTorrent?.size || 0,
      audioLabel: bestTorrent ? extractAudioLabel(bestTorrent.title) : undefined,
    }
  })
}

export function getTorrentSizeBytes(torrent: TorrentResult): number {
  if (torrent.size && torrent.size > 0) return torrent.size
  if (torrent.size_human) {
    const clean = torrent.size_human.trim()
    const match = clean.match(/([\d.,]+)\s*([a-zA-Zа-яА-Я]+)/)
    if (match) {
      const val = parseFloat(match[1].replace(',', '.'))
      const unit = match[2].toLowerCase()
      if (unit.startsWith('т') || unit.startsWith('t')) return val * 1024 * 1024 * 1024 * 1024
      if (unit.startsWith('г') || unit.startsWith('g')) return val * 1024 * 1024 * 1024
      if (unit.startsWith('м') || unit.startsWith('m')) return val * 1024 * 1024
      if (unit.startsWith('к') || unit.startsWith('k')) return val * 1024
    }
  }
  return 0
}

export function getTorrentHash(torrent: TorrentResult): string {
  if (torrent.info_hash) return torrent.info_hash.toLowerCase()
  if (torrent.magnet) {
    const match = torrent.magnet.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i)
    if (match) return match[1].toLowerCase()
  }
  if (torrent.id && /^[a-fA-F0-9]{40}$/.test(torrent.id)) {
    return torrent.id.toLowerCase()
  }
  return ''
}

export function computeBitrateMbps(
  torrentSizeBytes: number,
  durationSeconds: number,
  isSeries: boolean = false,
  episodesCount: number = 1,
  torrentTitle: string = ''
): number {
  if (torrentSizeBytes <= 0 || durationSeconds <= 0) return 0

  let effectiveBytes = torrentSizeBytes

  // If this is a TV series and the torrent appears to be a season pack or multi-episode
  if (isSeries && episodesCount > 1) {
    const titleLower = torrentTitle.toLowerCase()
    const isPack =
      torrentSizeBytes > 6 * 1024 * 1024 * 1024 ||
      titleLower.includes('сезон') ||
      titleLower.includes('season') ||
      /s\d+/i.test(titleLower) ||
      /сери[йи]/i.test(titleLower) ||
      /episodes?\s*\d+/i.test(titleLower)

    if (isPack) {
      effectiveBytes = torrentSizeBytes / episodesCount
    }
  }

  // Bitrate: bits per second / 1e6
  const bps = (effectiveBytes * 8) / durationSeconds
  return bps / 1_000_000
}

export function formatBitrate(mbps: number): string {
  if (!mbps || mbps <= 0 || !isFinite(mbps)) return ''
  if (mbps >= 10) {
    return `${mbps.toFixed(1)} Мбит/с`
  }
  if (mbps >= 1) {
    return `${mbps.toFixed(1)} Мбит/с`
  }
  return `${Math.round(mbps * 1000)} Кбит/с`
}

export interface TorrentQualityOption {
  id: string
  torrent: TorrentResult
  tier: QualityTier
  resolutionLabel: string
  resolutionBadge: string
  sizeFormatted: string
  sizeBytes: number
  bitrateMbps: number
  bitrateLabel: string
  seeds: number
  audioLabel: string
  tracker: string
  isActive: boolean
}

export function buildTorrentQualityOptions(
  torrents: TorrentResult[] | undefined,
  activeHash: string = '',
  durationSeconds: number = 0,
  isSeries: boolean = false,
  episodesCount: number = 1
): TorrentQualityOption[] {
  if (!torrents || torrents.length === 0) return []

  const effectiveDuration = durationSeconds > 0 ? durationSeconds : isSeries ? 2700 : 6300
  const normalizedActiveHash = (activeHash || '').toLowerCase()

  const tierMap: Record<QualityTier, { label: string; badge: string; rank: number }> = {
    '4k': { label: '4K Ultra HD', badge: '4K', rank: 4 },
    '1080p': { label: '1080p Full HD', badge: '1080p', rank: 3 },
    '720p': { label: '720p HD', badge: '720p', rank: 2 },
    'sd': { label: 'SD Качество', badge: 'SD', rank: 1 },
  }

  const seenHashes = new Set<string>()
  const options: TorrentQualityOption[] = []

  for (const t of torrents) {
    const hash = getTorrentHash(t)
    const key = hash || t.id || t.magnet || t.title
    if (seenHashes.has(key)) continue
    seenHashes.add(key)

    const tier = classifyResolution(t)
    const tierMeta = tierMap[tier] || tierMap['1080p']
    const sizeBytes = getTorrentSizeBytes(t)
    const bitrateMbps = computeBitrateMbps(sizeBytes, effectiveDuration, isSeries, episodesCount, t.title || '')
    const bitrateLabel = formatBitrate(bitrateMbps)
    const isActive = Boolean(normalizedActiveHash && hash && normalizedActiveHash === hash)

    options.push({
      id: hash || t.id,
      torrent: t,
      tier,
      resolutionLabel: tierMeta.label,
      resolutionBadge: tierMeta.badge,
      sizeFormatted: t.size_human || (sizeBytes > 0 ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ` : ''),
      sizeBytes,
      bitrateMbps,
      bitrateLabel,
      seeds: t.seeds || 0,
      audioLabel: extractAudioLabel(t.title || ''),
      tracker: t.tracker || (t.trackers && t.trackers[0]) || '',
      isActive,
    })
  }

  // Sort by Quality Tier descending (4K -> 1080p -> 720p -> SD),
  // then by Seeds descending (strictly prioritized inside each quality group),
  // then by Bitrate descending (as tiebreaker)
  return options.sort((a, b) => {
    const rankDiff = tierMap[b.tier].rank - tierMap[a.tier].rank
    if (rankDiff !== 0) return rankDiff

    if (b.seeds !== a.seeds) {
      return b.seeds - a.seeds
    }
    return b.bitrateMbps - a.bitrateMbps
  })
}

