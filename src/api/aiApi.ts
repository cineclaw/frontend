import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithAuth } from './baseQuery'

export interface CriticScores {
  rotten_tomatoes?: number
  metacritic?: number
  imdb?: number
  imdb_votes?: string
  awards?: string
}

export interface CriticSummaryResponse {
  tconst: string
  verdict: string
  tone: 'strongly_positive' | 'positive' | 'mixed' | 'negative'
  scores: CriticScores
  pros: string[]
  cons: string[]
  target_audience: string
  generated_at: string
  model: string
  cached?: boolean
}

export const aiApi = createApi({
  reducerPath: 'aiApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Critics'],
  endpoints: (builder) => ({
    getCriticSummary: builder.query<CriticSummaryResponse, string>({
      query: (tconst) => `api/ai/critics/${tconst}`,
      providesTags: (_result, _error, tconst) => [{ type: 'Critics', id: tconst }],
      keepUnusedDataFor: 3600, // 1 hour client cache
    }),
  }),
})

export const { useGetCriticSummaryQuery, useLazyGetCriticSummaryQuery } = aiApi
