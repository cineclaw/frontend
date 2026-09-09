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
  refresh_cache?: boolean
  limit?: number
  season?: number
  resolution?: string
}

export const torrentsApi = createApi({
  reducerPath: 'torrentsApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Torrents', 'MountStatus'],
  endpoints: (builder) => ({
    getTorrents: builder.query<TorrentResult[], TorrentsQueryParams>({
      query: (params) => {
        const queryParams: Record<string, string> = {}
        if (params.q) queryParams.q = params.q
        if (params.imdb_id) queryParams.imdb_id = params.imdb_id
        if (params.refresh_cache) queryParams.refresh_cache = 'true'
        if (params.limit) queryParams.limit = params.limit.toString()

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
        if (params.limit) queryParams.limit = params.limit.toString()

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
      ],
    }),
    getTrackerHotlist: builder.query<FeedShelf, { type?: 'movie' | 'tv'; page?: number; limit?: number }>({
      query: (params) => {
        const queryParams: Record<string, string> = {}
        if (params.type) queryParams.type = params.type
        if (params.page) queryParams.page = params.page.toString()
        if (params.limit) queryParams.limit = params.limit.toString()
        return {
          url: 'torrents/hotlist',
          params: queryParams,
        }
      },
      keepUnusedDataFor: 600,
    }),
  }),
})

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
}

export interface MountTorrentResponse {
  success: boolean
  message: string
  jellyfin_url: string
  mounted_files: string[]
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
} = torrentsApi


