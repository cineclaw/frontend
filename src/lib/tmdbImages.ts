/**
 * Utility for resolving TMDB image URLs (posters, backdrops, episode stills)
 * directly from Cloudflare / Fastly TMDB CDN (image.tmdb.org).
 */

export type TmdbPosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'
export type TmdbStillSize = 'w92' | 'w185' | 'w300' | 'w500' | 'original'
export type TmdbBackdropSize = 'w300' | 'w780' | 'w1280' | 'original'

/**
 * Returns direct TMDB CDN image URL.
 * Automatically ignores legacy /poster/ paths.
 */
export function getTmdbImageUrl(
  path?: string | null,
  size: TmdbPosterSize | TmdbStillSize | TmdbBackdropSize = 'w500'
): string | undefined {
  if (!path || !path.trim()) return undefined
  const clean = path.trim()
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean
  }
  if (clean.startsWith('/poster/') || clean.startsWith('poster/')) {
    return undefined
  }
  const normalizedPath = clean.startsWith('/') ? clean : `/${clean}`
  return `https://image.tmdb.org/t/p/${size}${normalizedPath}`
}

/**
 * Generates responsive srcset for direct TMDB CDN posters
 */
export function getTmdbImageSrcSet(path?: string | null): string | undefined {
  if (!path || !path.trim()) return undefined
  const clean = path.trim()
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return undefined
  }
  if (clean.startsWith('/poster/') || clean.startsWith('poster/')) {
    return undefined
  }
  const normalizedPath = clean.startsWith('/') ? clean : `/${clean}`
  return [
    `https://image.tmdb.org/t/p/w154${normalizedPath} 154w`,
    `https://image.tmdb.org/t/p/w185${normalizedPath} 185w`,
    `https://image.tmdb.org/t/p/w342${normalizedPath} 342w`,
    `https://image.tmdb.org/t/p/w500${normalizedPath} 500w`,
  ].join(', ')
}
