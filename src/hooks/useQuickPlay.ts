import { useState, useCallback } from "react"
import { useAppDispatch } from "@/store/store"
import { openCinemaPlayer } from "@/store/searchSlice"
import {
  useLazyGetTorrentsQuery,
  useMountTorrentMutation,
  useGetResumeItemsQuery,
} from "@/api/torrentsApi"
import {
  useLazyResolveTmdbMovieQuery,
  useLazySearchMoviesQuery,
} from "@/api/moviesApi"
import { selectPreferredTorrent, getDefaultQuality } from "@/lib/userSettings"

interface QuickPlayParams {
  tconst?: string
  tmdbId?: number
  title: string
  ruTitle?: string
  isSeries?: boolean
  year?: number | null
}

export function useQuickPlay() {
  const dispatch = useAppDispatch()
  const [triggerGetTorrents] = useLazyGetTorrentsQuery()
  const [mountTorrent] = useMountTorrentMutation()
  const [triggerResolve] = useLazyResolveTmdbMovieQuery()
  const [triggerSearch] = useLazySearchMoviesQuery()
  const { data: resumeItems } = useGetResumeItemsQuery()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const quickPlay = useCallback(
    async ({ tconst, tmdbId, title, ruTitle, isSeries = false, year }: QuickPlayParams) => {
      const activeId = tconst || (tmdbId ? `tmdb-${tmdbId}` : `title-${encodeURIComponent(title)}`)
      if (!activeId) return
      setLoadingId(activeId)

      try {
        let effectiveTconst = tconst
        let effectiveRuTitle = ruTitle

        // 1. If a genuine tmdbId is present, resolve via TMDB first (100% deterministic external_ids lookup)
        if (!effectiveTconst && tmdbId && tmdbId > 0) {
          try {
            const resolved = await triggerResolve({
              mediaType: isSeries ? "tv" : "movie",
              tmdbId,
            }).unwrap()
            if (resolved?.tconst) {
              effectiveTconst = resolved.tconst
              if (!effectiveRuTitle && resolved.title_ru) {
                effectiveRuTitle = resolved.title_ru
              }
            }
          } catch {
            // ignore
          }
        }

        // 2. Fallback to Tantivy title search (constrained by year when available to prevent wrong matches)
        if (!effectiveTconst) {
          const query = effectiveRuTitle || title
          if (query) {
            try {
              const searchRes = await triggerSearch({
                q: query,
                type: isSeries ? "tvSeries" : "movie",
                year_from: year ? year : undefined,
                year_to: year ? year : undefined,
              }).unwrap()
              if (searchRes?.hits && searchRes.hits.length > 0) {
                effectiveTconst = searchRes.hits[0].movie.tconst
                if (!effectiveRuTitle && searchRes.hits[0].movie.title_ru) {
                  effectiveRuTitle = searchRes.hits[0].movie.title_ru
                }
              }
            } catch {
              // ignore
            }
          }
        }

        const preferredQuality = getDefaultQuality()
        const mainQuery = effectiveRuTitle || title

        if (isSeries) {
          // 1. Determine next episode for TV Series
          let targetSeason = 1
          let targetEpisode = 1

          if (resumeItems && resumeItems.length > 0 && effectiveTconst) {
            const foundResume = resumeItems.find(
              (item) => item.tconst === effectiveTconst || item.item_id === effectiveTconst
            )
            if (foundResume && foundResume.season_number && foundResume.episode_number) {
              targetSeason = foundResume.season_number
              targetEpisode = foundResume.episode_number
            }
          }

          // 2. Fetch torrents for this series & season
          const torrentsRes = await triggerGetTorrents({
            q: mainQuery,
            imdb_id: effectiveTconst || undefined,
            type: "tv",
            season: targetSeason,
            year: year || undefined,
            limit: 50,
          }).unwrap()

          const bestTorrent = selectPreferredTorrent(
            torrentsRes,
            preferredQuality,
            targetSeason,
            true,
            year
          )

          if (effectiveTconst && bestTorrent && (bestTorrent.magnet || bestTorrent.id)) {
            try {
              await mountTorrent({
                tconst: effectiveTconst,
                title,
                ru_title: effectiveRuTitle,
                year: year ? year.toString() : undefined,
                type: "tvSeries",
                season: targetSeason,
                magnet: bestTorrent.magnet,
                tracker: bestTorrent.tracker || (bestTorrent.trackers && bestTorrent.trackers[0]),
                torrent_id: bestTorrent.id,
                details_url: bestTorrent.details_url,
                mode: "add_version",
                version_name: preferredQuality.toUpperCase(),
                resolution: bestTorrent.resolution,
              }).unwrap()
            } catch (mountErr) {
              console.warn("Quick-play TV series mount notice:", mountErr)
            }
          }

          // 3. Launch player with determined season & episode
          if (effectiveTconst) {
            dispatch(
              openCinemaPlayer({
                tconst: effectiveTconst,
                title,
                ruTitle: effectiveRuTitle,
                initialSeason: targetSeason,
                initialEpisode: targetEpisode,
                autoResume: true,
              })
            )
          }
        } else {
          // Movie Quick Play
          const torrentsRes = await triggerGetTorrents({
            q: mainQuery,
            imdb_id: effectiveTconst || undefined,
            type: "movie",
            year: year || undefined,
            limit: 50,
          }).unwrap()

          const bestTorrent = selectPreferredTorrent(
            torrentsRes,
            preferredQuality,
            null,
            false,
            year
          )

          if (effectiveTconst && bestTorrent && (bestTorrent.magnet || bestTorrent.id)) {
            try {
              await mountTorrent({
                tconst: effectiveTconst,
                title,
                ru_title: effectiveRuTitle,
                year: year ? year.toString() : undefined,
                type: "movie",
                magnet: bestTorrent.magnet,
                tracker: bestTorrent.tracker || (bestTorrent.trackers && bestTorrent.trackers[0]),
                torrent_id: bestTorrent.id,
                details_url: bestTorrent.details_url,
                mode: "add_version",
                version_name: preferredQuality.toUpperCase(),
                resolution: bestTorrent.resolution,
              }).unwrap()
            } catch (mountErr) {
              console.warn("Quick-play movie mount notice:", mountErr)
            }
          }

          // Launch player
          if (effectiveTconst) {
            dispatch(
              openCinemaPlayer({
                tconst: effectiveTconst,
                title,
                ruTitle: effectiveRuTitle,
                autoResume: true,
              })
            )
          }
        }
      } catch (err) {
        console.error("Quick play failed:", err)
      } finally {
        setLoadingId(null)
      }
    },
    [dispatch, triggerGetTorrents, mountTorrent, triggerResolve, resumeItems]
  )

  return {
    quickPlay,
    loadingId,
    isQuickPlaying: (id?: string | number) => {
      if (!id) return false
      return loadingId === id.toString() || loadingId === `tmdb-${id}`
    },
  }
}
