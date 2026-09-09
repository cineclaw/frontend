import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithAuth } from './baseQuery'
import type {
  SearchQueryParams,
  SearchResponse,
  StatusResponse,
  SeriesSeasonsResponse,
  MovieMetadataResponse,
  PersonDetailsResponse,
  MovieDoc,
  FeedShelf,
  DiscoverCatalogParams,
} from './types'

export const moviesApi = createApi({
  reducerPath: 'moviesApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Movies', 'Status', 'Series', 'Person', 'Feeds'],
  endpoints: (builder) => ({
    searchMovies: builder.query<SearchResponse, SearchQueryParams>({
      query: (params) => {
        const queryParams: Record<string, string> = {
          q: params.q,
        }
        if (params.limit) queryParams.limit = params.limit.toString()
        if (params.type) queryParams.type = params.type
        if (params.year_from) queryParams.year_from = params.year_from.toString()
        if (params.year_to) queryParams.year_to = params.year_to.toString()
        if (params.min_votes) queryParams.min_votes = params.min_votes.toString()

        return {
          url: 'search',
          params: queryParams,
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Movies', id: `${arg.q}-${arg.type}-${arg.year_from}-${arg.year_to}` },
      ],
      keepUnusedDataFor: 300, // 5 min cache
    }),
    getStatus: builder.query<StatusResponse, void>({
      query: () => 'status',
      providesTags: ['Status'],
      keepUnusedDataFor: 30,
    }),
    getSeriesSeasons: builder.query<SeriesSeasonsResponse, string>({
      query: (tconst) => `api/series/${tconst}/seasons`,
      providesTags: (_result, _error, tconst) => [{ type: 'Series', id: tconst }],
      keepUnusedDataFor: 600, // 10 min cache
    }),
    getMovieMetadata: builder.query<MovieMetadataResponse, string>({
      query: (tconst) => `api/movie/${tconst}/metadata`,
      providesTags: (_result, _error, tconst) => [{ type: 'Movies', id: `meta-${tconst}` }],
      keepUnusedDataFor: 600, // 10 min cache
    }),
    getPersonDetails: builder.query<PersonDetailsResponse, number>({
      query: (personId) => `api/person/${personId}`,
      providesTags: (_result, _error, personId) => [{ type: 'Person', id: personId }],
      keepUnusedDataFor: 600, // 10 min cache
    }),
    resolveTmdbMovie: builder.query<MovieDoc, { mediaType: string; tmdbId: number }>({
      query: ({ mediaType, tmdbId }) => `api/tmdb/${mediaType}/${tmdbId}/movie`,
      keepUnusedDataFor: 600,
    }),
    getHomeFeeds: builder.query<FeedShelf[], void>({
      query: () => 'api/feeds',
      providesTags: ['Feeds'],
      keepUnusedDataFor: 1800, // 30 min cache
    }),
    getShelfPage: builder.query<FeedShelf, { shelfId: string; type?: 'movie' | 'tv'; page: number }>({
      query: ({ shelfId, type, page }) => {
        let url = `api/feeds/${shelfId}?page=${page}`
        if (type) url += `&type=${type}`
        return url
      },
      keepUnusedDataFor: 1800,
    }),
    discoverCatalog: builder.query<FeedShelf, DiscoverCatalogParams>({
      query: (params) => {
        const queryParams: Record<string, string> = {}
        if (params.type) queryParams.type = params.type
        if (params.network) queryParams.network = params.network
        if (params.genres) queryParams.genres = params.genres
        if (params.countries) queryParams.countries = params.countries
        if (params.year_from) queryParams.year_from = params.year_from.toString()
        if (params.year_to) queryParams.year_to = params.year_to.toString()
        if (params.min_rating) queryParams.min_rating = params.min_rating.toString()
        if (params.sort_by) queryParams.sort_by = params.sort_by
        if (params.page) queryParams.page = params.page.toString()
        return {
          url: 'api/catalog/discover',
          params: queryParams,
        }
      },
      keepUnusedDataFor: 1800,
    }),
  }),
})

export const {
  useSearchMoviesQuery,
  useGetStatusQuery,
  useGetSeriesSeasonsQuery,
  useGetMovieMetadataQuery,
  useGetPersonDetailsQuery,
  useResolveTmdbMovieQuery,
  useLazyResolveTmdbMovieQuery,
  useGetHomeFeedsQuery,
  useGetShelfPageQuery,
  useLazyGetShelfPageQuery,
  useDiscoverCatalogQuery,
  useLazyDiscoverCatalogQuery,
} = moviesApi

