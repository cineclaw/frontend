import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithAuth } from './baseQuery'
import type { FeedShelf } from './types'

export interface TorrentSource {
  tracker: 'rutor' | 'nnmclub' | 'rutracker' | string
  id: string
  title: string
  size: number
  size_human: string
  seeds: number
  leeches: number
  magnet?: string
  download_url?: string
  details_url: string
}

export interface TorrentResult {
  tracker: 'rutor' | 'nnmclub' | 'rutracker' | string
  trackers?: string[]
  sources?: TorrentSource[]
  id: string
  title: string
  size: number
  size_human: string
  seeds: number
  leeches: number
  magnet?: string
  download_url?: string
  details_url: string
  publish_date: string
  category?: string
  info_hash?: string
  seasons?: number[]
  is_complete?: boolean
  resolution?: '4k' | '1080p' | 'lq' | string
}

export interface TorrentsQueryParams {
  q?: string
  imdb_id?: string
  type?: string
  refresh_cache?: boolean
  limit?: number
  season?: number
  year?: number
  resolution?: string
}

export const torrentsApi = createApi({
  reducerPath: 'torrentsApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Torrents', 'MountStatus', 'Watchlist'],
  endpoints: (builder) => ({
    getTorrents: builder.query<TorrentResult[], TorrentsQueryParams>({
      query: (params) => {
        const queryParams: Record<string, string> = {}
        if (params.q) queryParams.q = params.q
        if (params.imdb_id) queryParams.imdb_id = params.imdb_id
        if (params.type) queryParams.type = params.type
        if (params.year) queryParams.year = params.year.toString()
        if (params.refresh_cache) queryParams.refresh_cache = 'true'
        if (params.limit) queryParams.limit = params.limit.toString()
        if (params.season !== undefined && params.season !== null && params.season > 0) {
          queryParams.season = params.season.toString()
        }

        return {
          url: 'torrents',
          params: queryParams,
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Torrents', id: arg.imdb_id || arg.q || 'all' },
      ],
      keepUnusedDataFor: 300, // keep in RTK Query memory cache for 5 min
    }),
    forceRefreshTorrents: builder.mutation<TorrentResult[], TorrentsQueryParams>({
      query: (params) => {
        const queryParams: Record<string, string> = {
          refresh_cache: 'true',
        }
        if (params.q) queryParams.q = params.q
        if (params.imdb_id) queryParams.imdb_id = params.imdb_id
        if (params.type) queryParams.type = params.type
        if (params.year) queryParams.year = params.year.toString()
        if (params.limit) queryParams.limit = params.limit.toString()
        if (params.season !== undefined && params.season !== null && params.season > 0) {
          queryParams.season = params.season.toString()
        }

        return {
          url: 'torrents',
          params: queryParams,
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Torrents', id: arg.imdb_id || arg.q || 'all' },
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          // Immediately update getTorrents cache entry in RTK Query
          dispatch(
            torrentsApi.util.updateQueryData(
              'getTorrents',
              { q: arg.q, imdb_id: arg.imdb_id, limit: 100 },
              () => data
            )
          )
        } catch {}
      },
    }),
    getMountedStatus: builder.query<MountedStatusResponse, string>({
      query: (tconst) => ({
        url: 'torrents/status',
        params: { tconst },
      }),
      providesTags: (_result, _error, tconst) => [
        { type: 'MountStatus', id: tconst },
      ],
    }),
    mountTorrent: builder.mutation<MountTorrentResponse, MountTorrentRequest>({
      query: (body) => ({
        url: 'torrents/mount',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'MountStatus', id: arg.tconst },
        { type: 'MountStatus', id: `player-${arg.tconst}` },
      ],
    }),
    unmountTorrent: builder.mutation<UnmountTorrentResponse, UnmountTorrentRequest>({
      query: (body) => ({
        url: 'torrents/unmount',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'MountStatus', id: arg.tconst || 'all' },
        { type: 'MountStatus', id: `player-${arg.tconst || 'all'}` },
      ],
    }),
    getTrackerHotlist: builder.query<FeedShelf, { type?: string; quality?: string; page?: number; limit?: number }>({
      query: (params) => {
        const queryParams: Record<string, string> = {}
        if (params.type) queryParams.type = params.type
        if (params.quality) queryParams.quality = params.quality
        if (params.page) queryParams.page = params.page.toString()
        if (params.limit) queryParams.limit = params.limit.toString()
        return {
          url: 'torrents/hotlist',
          params: queryParams,
        }
      },
      keepUnusedDataFor: 600,
    }),
    getPlayerInfo: builder.query<PlayerInfoResponse, { tconst: string; season?: number; episode?: number }>({
      query: (params) => {
        const queryParams: Record<string, string> = { tconst: params.tconst }
        if (params.season) queryParams.season = params.season.toString()
        if (params.episode) queryParams.episode = params.episode.toString()
        return {
          url: 'api/stream/player/info',
          params: queryParams,
        }
      },
      providesTags: (_result, _error, arg) => [{ type: 'MountStatus', id: `player-${arg.tconst}` }],
    }),
    reportPlayerStart: builder.mutation<PlaybackActionResponse, PlaybackStartRequest>({
      query: (body) => ({
        url: 'api/stream/player/start',
        method: 'POST',
        body,
      }),
    }),
    reportPlayerProgress: builder.mutation<PlaybackActionResponse, PlaybackProgressRequest>({
      query: (body) => ({
        url: 'api/stream/player/progress',
        method: 'POST',
        body,
      }),
    }),
    reportPlayerStop: builder.mutation<PlaybackActionResponse, PlaybackStopRequest>({
      query: (body) => ({
        url: 'api/stream/player/stop',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'MountStatus', id: `player-${arg.item_id}` },
        { type: 'MountStatus', id: 'ResumeList' },
      ],
    }),
    getResumeItems: builder.query<ResumeItem[], void>({
      query: () => 'api/stream/resume',
      providesTags: () => [{ type: 'MountStatus', id: 'ResumeList' }],
      keepUnusedDataFor: 30,
    }),
    deleteResumeItem: builder.mutation<PlaybackActionResponse, DeleteResumeRequest>({
      query: (body) => ({
        url: 'api/stream/resume',
        method: 'DELETE',
        body,
      }),
      invalidatesTags: () => [{ type: 'MountStatus', id: 'ResumeList' }],
    }),
    getWatchlist: builder.query<WatchlistItem[], void>({
      query: () => 'api/watchlist',
      providesTags: () => [{ type: 'Watchlist', id: 'LIST' }],
      keepUnusedDataFor: 30,
    }),
    addToWatchlist: builder.mutation<{ success: boolean }, Partial<WatchlistItem>>({
      query: (body) => ({
        url: 'api/watchlist',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Watchlist', id: 'LIST' },
        { type: 'Watchlist', id: arg.imdb_id },
      ],
    }),
    removeFromWatchlist: builder.mutation<{ success: boolean }, string>({
      query: (imdbId) => ({
        url: `api/watchlist?imdb_id=${encodeURIComponent(imdbId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Watchlist', id: 'LIST' },
        { type: 'Watchlist', id: arg },
      ],
    }),
    checkWatchlist: builder.query<{ in_watchlist: boolean }, string>({
      query: (imdbId) => `api/watchlist/check?imdb_id=${encodeURIComponent(imdbId)}`,
      providesTags: (_res, _err, id) => [{ type: 'Watchlist', id }],
    }),
    getTranscodeProfiles: builder.query<TranscodeProfile[], void>({
      query: () => 'api/stream/transcode/profiles',
      keepUnusedDataFor: 3600,
    }),
    stopTranscoding: builder.mutation<{ success: boolean }, { session?: string; hash?: string }>({
      query: (body) => ({
        url: 'api/stream/transcode/stop',
        method: 'POST',
        body,
      }),
    }),
    setAudioPreference: builder.mutation<{ success: boolean }, { imdb_id: string; audio_title: string; audio_index: number }>({
      query: (body) => ({
        url: 'api/playback/audio',
        method: 'POST',
        body,
      }),
    }),
    getSeriesProgress: builder.query<SeriesProgressResponse, string>({
      query: (imdbId) => `api/playback/series-progress?imdb_id=${encodeURIComponent(imdbId)}`,
      providesTags: (_res, _err, id) => [
        { type: 'MountStatus', id: `series-progress-${id}` },
        { type: 'MountStatus', id: 'ResumeList' },
      ],
      keepUnusedDataFor: 60,
    }),
    markWatched: builder.mutation<{ success: boolean }, MarkWatchedRequest>({
      query: (body) => ({
        url: 'api/playback/mark-watched',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'MountStatus', id: `series-progress-${arg.imdb_id}` },
        { type: 'MountStatus', id: 'ResumeList' },
        { type: 'MountStatus', id: 'LIST' },
      ],
    }),
    getStreamStats: builder.query<StreamStatsResponse, { hash?: string; tconst?: string; file_idx?: number; season?: number; episode?: number; duration?: number }>({
      query: (params) => ({
        url: 'api/stream/stats',
        params,
      }),
      keepUnusedDataFor: 0,
    }),
  }),
})

export interface StreamStatsResponse {
  success: boolean
  hash: string
  download_speed: number
  upload_speed: number
  download_speed_fmt: string
  upload_speed_fmt: string
  connected_seeders: number
  active_peers: number
  total_peers: number
  half_open_peers: number
  loaded_size: number
  torrent_size: number
  preloaded_bytes: number
  video_bitrate: number
  video_bitrate_fmt: string
  speed_ratio: number
  signal_level: number // 0..4
  signal_status: string
  stat: number
  stat_string: string
}

export interface SeasonProgressSummary {
  season_number: number
  total_episodes: number
  watched_episodes: number
  is_completed: boolean
}

export interface EpisodeProgressStatus {
  season_number: number
  episode_number: number
  position_seconds: number
  duration_seconds: number
  playback_percent: number
  is_completed: boolean
}

export interface SeriesProgressResponse {
  imdb_id: string
  total_episodes: number
  total_watched: number
  is_completed: boolean
  has_unwatched_prior: boolean
  latest_watched_season?: number
  latest_watched_episode?: number
  seasons: Record<string, SeasonProgressSummary>
  episodes: Record<string, EpisodeProgressStatus>
}

export interface MarkWatchedRequest {
  imdb_id: string
  mode: 'episode' | 'season' | 'up_to' | 'series'
  title?: string
  season?: number
  episode?: number
  up_to_season?: number
  up_to_episode?: number
  completed?: boolean
}

export interface MountedStatusResponse {
  mounted: boolean
  tconst?: string
  type?: string
  folder_name?: string
  library_path?: string
  source_path?: string
  file_count: number
  mounted_files?: string[]
  seasons?: number[]
  versions?: string[]
}

export interface UnmountTorrentRequest {
  tconst?: string
  type?: string
  folder_name?: string
}

export interface UnmountTorrentResponse {
  success: boolean
  message: string
  removed_files?: string[]
  removed_swarms?: string[]
}

export interface MountTorrentRequest {
  tconst: string
  title: string
  ru_title?: string
  year?: string
  type?: string
  season?: number
  magnet?: string
  tracker?: string
  torrent_id?: string
  details_url?: string
  mode?: 'add' | 'replace' | 'add_version'
  version_name?: string
  resolution?: string
  folder_name?: string
  position_seconds?: number
  episode?: number
}

export interface MountTorrentResponse {
  success: boolean
  message: string
  stream_url?: string
  jellyfin_url?: string
  mounted_files: string[]
}

export interface AudioTrack {
  index: number
  title: string
  language: string
  codec: string
  channels: number
  is_default: boolean
}

export interface SubtitleTrack {
  index: number
  title: string
  language: string
  codec: string
  is_default: boolean
  delivery_url?: string
}

export interface EpisodeInfo {
  id: string
  name: string
  season_number: number
  episode_number: number
  duration_seconds: number
  resume_seconds: number
  is_played: boolean
}

export interface TranscodeProfile {
  id: string
  label: string
  description: string
  max_height: number
  bitrate_kbps: number
  maxrate_kbps: number
  bufsize_kbps: number
  audio_kbps: number
  is_direct: boolean
}

export interface PlayerInfoResponse {
  success: boolean
  error?: string
  item_id?: string
  title?: string
  ru_title?: string
  media_type?: 'Movie' | 'Episode'
  duration_seconds: number
  resume_seconds: number
  is_played: boolean
  stream_url?: string
  direct_stream_url?: string
  media_source_id?: string
  audio_tracks?: AudioTrack[]
  subtitles?: SubtitleTrack[]
  episodes?: EpisodeInfo[]
  current_season?: number
  current_episode?: number
  has_next_episode?: boolean
  next_episode?: EpisodeInfo
  width?: number
  height?: number
  bitrate?: number
  video_codec?: string
  target_file_idx?: number
  transcode_profiles?: TranscodeProfile[]
}

export interface PlaybackStartRequest {
  item_id: string
  media_source_id?: string
  audio_stream_index?: number
  subtitle_stream_index?: number
  position_seconds?: number
}

export interface PlaybackProgressRequest {
  item_id: string
  media_source_id?: string
  position_seconds: number
  duration_seconds?: number
  is_paused: boolean
  event?: string
}

export interface PlaybackStopRequest {
  item_id: string
  media_source_id?: string
  position_seconds: number
  duration_seconds?: number
  close_player?: boolean
  is_played?: boolean
}

export interface PlaybackActionResponse {
  success: boolean
  message?: string
}

export interface ResumeItem {
  item_id: string
  tconst?: string
  title: string
  series_name?: string
  episode_title?: string
  media_type: 'Movie' | 'Episode'
  season_number?: number
  episode_number?: number
  duration_seconds: number
  resume_seconds: number
  played_percentage: number
  image_url: string
  is_next_up?: boolean
}

export interface DeleteResumeRequest {
  item_id: string
  tconst?: string
  season?: number
  episode?: number
  is_next_up?: boolean
  all?: boolean
}

export interface WatchlistItem {
  imdb_id: string
  media_type: 'movie' | 'tv' | string
  title: string
  original_title?: string
  year?: number
  rating?: number
  poster_path?: string
  backdrop_path?: string
  added_at: string
}

export const {
  useGetTorrentsQuery,
  useLazyGetTorrentsQuery,
  useForceRefreshTorrentsMutation,
  useGetMountedStatusQuery,
  useMountTorrentMutation,
  useUnmountTorrentMutation,
  useGetTrackerHotlistQuery,
  useLazyGetTrackerHotlistQuery,
  useGetPlayerInfoQuery,
  useLazyGetPlayerInfoQuery,
  useReportPlayerStartMutation,
  useReportPlayerProgressMutation,
  useReportPlayerStopMutation,
  useGetResumeItemsQuery,
  useLazyGetResumeItemsQuery,
  useDeleteResumeItemMutation,
  useGetWatchlistQuery,
  useAddToWatchlistMutation,
  useRemoveFromWatchlistMutation,
  useCheckWatchlistQuery,
  useGetTranscodeProfilesQuery,
  useStopTranscodingMutation,
  useSetAudioPreferenceMutation,
  useGetSeriesProgressQuery,
  useMarkWatchedMutation,
  useGetStreamStatsQuery,
  useLazyGetStreamStatsQuery,
} = torrentsApi




