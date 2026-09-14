import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/store'
import {
  parseAppUrl,
  buildRouteUrl,
  pushRoute,
  replaceRoute,
  type AppRoute,
} from '@/lib/router'
import {
  setSelectedMovieTconst,
  setSelectedPersonId,
  setSelectedShelfId,
  setSelectedMediaType,
  openCinemaPlayer,
  closeCinemaPlayer,
  setDiagnosticOpen,
  setImmediateQuery,
  setTypeFilter,
  setYearRange,
  setMinVotes,
} from '@/store/searchSlice'

/**
 * Hook to synchronize browser URL and application navigation state.
 *
 * Ensures every page, modal, and player has a distinct, bookmarkable,
 * and reloadable URL, with seamless browser Back/Forward integration.
 */
export function useAppRouting() {
  const dispatch = useAppDispatch()

  const {
    debouncedQuery,
    filters,
    selectedMovieTconst,
    selectedPersonId,
    selectedShelfId,
    selectedMediaType,
    isDiagnosticOpen,
    activePlayer,
  } = useAppSelector((state) => state.search)

  const isInitialMountRef = useRef(true)
  const isPopstateHandlingRef = useRef(false)

  // 1. Initial page load / Browser reload handler
  useEffect(() => {
    const route = parseAppUrl()

    switch (route.type) {
      case 'diagnostic':
        dispatch(setDiagnosticOpen(true))
        break

      case 'watch':
        dispatch(
          openCinemaPlayer({
            tconst: route.tconst,
            title: '',
            initialSeason: route.season,
            initialEpisode: route.episode,
            autoResume: true,
          })
        )
        break

      case 'movie':
        dispatch(setSelectedMovieTconst(route.tconst))
        break

      case 'person':
        dispatch(setSelectedPersonId(route.personId))
        break

      case 'shelf':
        dispatch(setSelectedShelfId(route.shelfId))
        if (route.mediaType) {
          dispatch(setSelectedMediaType(route.mediaType))
        }
        break

      case 'search':
        dispatch(setImmediateQuery(route.query))
        if (route.filters?.type) dispatch(setTypeFilter(route.filters.type))
        if (route.filters?.year_from !== undefined || route.filters?.year_to !== undefined) {
          dispatch(setYearRange({ from: route.filters?.year_from, to: route.filters?.year_to }))
        }
        if (route.filters?.min_votes !== undefined) {
          dispatch(setMinVotes(route.filters.min_votes))
        }
        break

      case 'home':
        // Default home state
        break
    }

    isInitialMountRef.current = false
  }, [dispatch])

  // 2. Browser Back / Forward handler (popstate)
  useEffect(() => {
    const handlePopState = () => {
      isPopstateHandlingRef.current = true
      const route = parseAppUrl()

      // Diagnostic
      dispatch(setDiagnosticOpen(route.type === 'diagnostic'))

      // Watch player
      if (route.type === 'watch') {
        dispatch(
          openCinemaPlayer({
            tconst: route.tconst,
            title: '',
            initialSeason: route.season,
            initialEpisode: route.episode,
            autoResume: true,
          })
        )
      } else {
        dispatch(closeCinemaPlayer())
      }

      // Movie modal
      if (route.type === 'movie') {
        dispatch(setSelectedMovieTconst(route.tconst))
      } else {
        dispatch(setSelectedMovieTconst(null))
      }

      // Person modal
      if (route.type === 'person') {
        dispatch(setSelectedPersonId(route.personId))
      } else {
        dispatch(setSelectedPersonId(null))
      }

      // Shelf modal
      if (route.type === 'shelf') {
        dispatch(setSelectedShelfId(route.shelfId))
        if (route.mediaType) {
          dispatch(setSelectedMediaType(route.mediaType))
        }
      } else {
        dispatch(setSelectedShelfId(null))
      }

      // Search query
      if (route.type === 'search') {
        dispatch(setImmediateQuery(route.query))
      } else if (route.type === 'home') {
        dispatch(setImmediateQuery(''))
      }

      setTimeout(() => {
        isPopstateHandlingRef.current = false
      }, 50)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [dispatch])

  // 3. Keep URL synchronized when Redux state changes from user UI actions
  useEffect(() => {
    if (isInitialMountRef.current || isPopstateHandlingRef.current) {
      return
    }

    let targetRoute: AppRoute

    if (activePlayer) {
      targetRoute = {
        type: 'watch',
        tconst: activePlayer.tconst,
        season: activePlayer.initialSeason,
        episode: activePlayer.initialEpisode,
        autoResume: activePlayer.autoResume,
      }
    } else if (selectedMovieTconst) {
      targetRoute = {
        type: 'movie',
        tconst: selectedMovieTconst,
      }
    } else if (selectedPersonId) {
      targetRoute = {
        type: 'person',
        personId: selectedPersonId,
      }
    } else if (selectedShelfId) {
      targetRoute = {
        type: 'shelf',
        shelfId: selectedShelfId,
        mediaType: selectedMediaType,
      }
    } else if (isDiagnosticOpen) {
      targetRoute = {
        type: 'diagnostic',
      }
    } else if (debouncedQuery.trim()) {
      targetRoute = {
        type: 'search',
        query: debouncedQuery.trim(),
        filters,
      }
    } else {
      targetRoute = {
        type: 'home',
      }
    }

    const targetUrl = buildRouteUrl(targetRoute)
    const currentUrl = window.location.pathname + window.location.search

    if (targetUrl !== currentUrl) {
      // Use replaceState for search query typing to avoid polluting history with every letter
      if (targetRoute.type === 'search' || (targetRoute.type === 'home' && currentUrl.startsWith('/?q='))) {
        replaceRoute(targetRoute)
      } else {
        pushRoute(targetRoute)
      }
    }
  }, [
    activePlayer,
    selectedMovieTconst,
    selectedPersonId,
    selectedShelfId,
    selectedMediaType,
    isDiagnosticOpen,
    debouncedQuery,
    filters,
  ])
}
