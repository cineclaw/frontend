/**
 * URL Routing & History Management for CineClaw Web.
 *
 * Provides bidirectional synchronization between the browser address bar and
 * application state. Every modal, shelf, search, and video player screen has its
 * own human-readable URL supporting bookmarks, sharing, and seamless browser
 * refresh (Cmd+R / F5) without losing position.
 */

import type { SearchFilters } from '../api/types'

export type AppRoute =
  | { type: 'home' }
  | { type: 'search'; query: string; filters?: Partial<SearchFilters> }
  | { type: 'movie'; tconst: string }
  | { type: 'person'; personId: number }
  | { type: 'shelf'; shelfId: string; mediaType?: 'movie' | 'tv' }
  | { type: 'diagnostic' }
  | {
      type: 'watch'
      tconst: string
      season?: number
      episode?: number
      autoResume?: boolean
    }

/**
 * Parses the browser location (pathname, search, hash) into a structured AppRoute.
 */
export function parseAppUrl(
  pathname: string = window.location.pathname,
  search: string = window.location.search,
  hash: string = window.location.hash
): AppRoute {
  // Normalize pathname: remove trailing slash except for root
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const searchParams = new URLSearchParams(search)

  // 1. Diagnostic screen: /diagnostic or #diagnostic
  if (cleanPath === '/diagnostic' || hash === '#diagnostic') {
    return { type: 'diagnostic' }
  }

  // 2. Watch / Video Player screen: /watch/:tconst or /player/:tconst
  const watchMatch = cleanPath.match(/^\/(?:watch|player)\/([^/]+)/i)
  if (watchMatch) {
    const tconst = watchMatch[1]
    const seasonStr = searchParams.get('season') || searchParams.get('s')
    const episodeStr = searchParams.get('episode') || searchParams.get('e')
    const season = seasonStr ? parseInt(seasonStr, 10) : undefined
    const episode = episodeStr ? parseInt(episodeStr, 10) : undefined
    return {
      type: 'watch',
      tconst,
      season: !isNaN(season as number) ? season : undefined,
      episode: !isNaN(episode as number) ? episode : undefined,
      autoResume: true,
    }
  }

  // 3. Movie details modal: /movie/:tconst or /title/:tconst
  const movieMatch = cleanPath.match(/^\/(?:movie|title)\/([^/]+)/i)
  if (movieMatch) {
    return {
      type: 'movie',
      tconst: movieMatch[1],
    }
  }

  // 4. Person details modal: /person/:id
  const personMatch = cleanPath.match(/^\/person\/(\d+)/i)
  if (personMatch) {
    const personId = parseInt(personMatch[1], 10)
    if (!isNaN(personId)) {
      return {
        type: 'person',
        personId,
      }
    }
  }

  // 5. Shelf / Hub details modal: /shelf/:shelfId or /hub/:shelfId
  const shelfMatch = cleanPath.match(/^\/(?:shelf|hub)\/([^/]+)/i)
  if (shelfMatch) {
    const shelfId = shelfMatch[1]
    const mediaType = searchParams.get('type')
    return {
      type: 'shelf',
      shelfId,
      mediaType: mediaType === 'tv' || mediaType === 'movie' ? mediaType : undefined,
    }
  }

  // 6. Search query on /search, /browse, or root /?q=...
  const queryParam = searchParams.get('q') || ''
  if (queryParam.trim() || cleanPath === '/search' || cleanPath === '/browse') {
    const filters: Partial<SearchFilters> = {}
    const filterType = searchParams.get('type')
    if (filterType) filters.type = filterType
    const yearFrom = searchParams.get('year_from')
    if (yearFrom && !isNaN(parseInt(yearFrom, 10))) filters.year_from = parseInt(yearFrom, 10)
    const yearTo = searchParams.get('year_to')
    if (yearTo && !isNaN(parseInt(yearTo, 10))) filters.year_to = parseInt(yearTo, 10)
    const minVotes = searchParams.get('min_votes')
    if (minVotes && !isNaN(parseInt(minVotes, 10))) filters.min_votes = parseInt(minVotes, 10)

    return {
      type: 'search',
      query: queryParam,
      filters,
    }
  }

  // Default: Home
  return { type: 'home' }
}

/**
 * Builds the canonical URL string for a given AppRoute.
 */
export function buildRouteUrl(route: AppRoute): string {
  switch (route.type) {
    case 'home':
      return '/'
    case 'search': {
      const sp = new URLSearchParams()
      if (route.query.trim()) {
        sp.set('q', route.query.trim())
      }
      if (route.filters?.type) sp.set('type', route.filters.type)
      if (route.filters?.year_from) sp.set('year_from', route.filters.year_from.toString())
      if (route.filters?.year_to) sp.set('year_to', route.filters.year_to.toString())
      if (route.filters?.min_votes) sp.set('min_votes', route.filters.min_votes.toString())
      const qs = sp.toString()
      return qs ? `/?${qs}` : '/'
    }
    case 'movie':
      return `/movie/${encodeURIComponent(route.tconst)}`
    case 'person':
      return `/person/${route.personId}`
    case 'shelf': {
      let url = `/shelf/${encodeURIComponent(route.shelfId)}`
      if (route.mediaType) {
        url += `?type=${route.mediaType}`
      }
      return url
    }
    case 'diagnostic':
      return '/diagnostic'
    case 'watch': {
      let url = `/watch/${encodeURIComponent(route.tconst)}`
      const params: string[] = []
      if (route.season !== undefined && route.season > 0) {
        params.push(`season=${route.season}`)
      }
      if (route.episode !== undefined && route.episode > 0) {
        params.push(`episode=${route.episode}`)
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`
      }
      return url
    }
  }
}

/**
 * Pushes a new route into browser history if different from current URL.
 */
export function pushRoute(route: AppRoute): void {
  if (typeof window === 'undefined') return
  const targetUrl = buildRouteUrl(route)
  const currentUrl = window.location.pathname + window.location.search

  if (targetUrl !== currentUrl) {
    window.history.pushState(
      { ...(window.history.state || {}), cineclawRoute: route.type, hasInAppHistory: true },
      '',
      targetUrl
    )
  }
}

/**
 * Replaces the current route in browser history.
 */
export function replaceRoute(route: AppRoute): void {
  if (typeof window === 'undefined') return
  const targetUrl = buildRouteUrl(route)
  const currentUrl = window.location.pathname + window.location.search

  if (targetUrl !== currentUrl) {
    window.history.replaceState(
      { ...(window.history.state || {}), cineclawRoute: route.type },
      '',
      targetUrl
    )
  }
}

/**
 * Gracefully navigates back in history, or falls back to a parent route if opened directly.
 */
export function navigateBack(fallbackRoute: AppRoute = { type: 'home' }): void {
  if (typeof window === 'undefined') return
  if (window.history.state?.hasInAppHistory) {
    window.history.back()
  } else {
    pushRoute(fallbackRoute)
  }
}
