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

export function scoreTorrent(
  torrent: TorrentResult,
  targetSeason?: number | null,
  isSeries?: boolean
): number {
  let score = 0
  const title = (torrent.title || "").toLowerCase()

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
  isSeries?: boolean
): TorrentResult | null {
  if (!torrents || torrents.length === 0) return null

  const candidates = torrents.filter((t) => classifyResolution(t) === quality)
  if (candidates.length === 0) return null

  let best: TorrentResult | null = null
  let bestScore = -Infinity

  for (const t of candidates) {
    const s = scoreTorrent(t, targetSeason, isSeries)
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
  mountedSeasons: number[] = []
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

    const bestTorrent = pickBestTorrentForQuality(torrents, tier, targetSeason, isSeries)
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
