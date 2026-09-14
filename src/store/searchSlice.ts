import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { MovieDoc, SearchFilters } from '../api/types'

export interface ActiveCinemaPlayer {
  tconst: string
  title: string
  ruTitle?: string
  initialSeason?: number
  initialEpisode?: number
  autoResume?: boolean
}

interface SearchState {
  query: string
  debouncedQuery: string
  filters: SearchFilters
  viewMode: 'grid' | 'list'
  selectedMovie: MovieDoc | null
  selectedMovieTconst: string | null
  selectedPersonId: number | null
  selectedShelfId: string | null
  selectedMediaType: 'movie' | 'tv'
  isFiltersOpen: boolean
  isDiagnosticOpen: boolean
  activePlayer: ActiveCinemaPlayer | null
}

const initialFilters: SearchFilters = {
  type: undefined,
  year_from: undefined,
  year_to: undefined,
  min_votes: undefined,
  limit: 24,
}

const initialState: SearchState = {
  query: '',
  debouncedQuery: '',
  filters: initialFilters,
  viewMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'grid',
  selectedMovie: null,
  selectedMovieTconst: null,
  selectedPersonId: null,
  selectedShelfId: null,
  selectedMediaType: 'movie',
  isFiltersOpen: false,
  isDiagnosticOpen: false,
  activePlayer: null,
}

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
    },
    setDebouncedQuery: (state, action: PayloadAction<string>) => {
      state.debouncedQuery = action.payload
    },
    setImmediateQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
      state.debouncedQuery = action.payload
    },
    setTypeFilter: (state, action: PayloadAction<string | undefined>) => {
      state.filters.type = action.payload
    },
    setYearRange: (
      state,
      action: PayloadAction<{ from?: number; to?: number }>
    ) => {
      state.filters.year_from = action.payload.from
      state.filters.year_to = action.payload.to
    },
    setMinVotes: (state, action: PayloadAction<number | undefined>) => {
      state.filters.min_votes = action.payload
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.filters.limit = action.payload
    },
    resetFilters: (state) => {
      state.filters = initialFilters
    },
    setViewMode: (state, action: PayloadAction<'grid' | 'list'>) => {
      state.viewMode = action.payload
    },
    setSelectedMovie: (state, action: PayloadAction<MovieDoc | null>) => {
      state.selectedMovie = action.payload
      state.selectedMovieTconst = action.payload ? action.payload.tconst : null
    },
    setSelectedMovieTconst: (state, action: PayloadAction<string | null>) => {
      state.selectedMovieTconst = action.payload
      if (!action.payload) {
        state.selectedMovie = null
      } else if (state.selectedMovie && state.selectedMovie.tconst !== action.payload) {
        state.selectedMovie = null
      }
    },
    setSelectedPersonId: (state, action: PayloadAction<number | null>) => {
      state.selectedPersonId = action.payload
    },
    setSelectedShelfId: (state, action: PayloadAction<string | null>) => {
      state.selectedShelfId = action.payload
    },
    setSelectedMediaType: (state, action: PayloadAction<'movie' | 'tv'>) => {
      state.selectedMediaType = action.payload
    },
    toggleFiltersOpen: (state) => {
      state.isFiltersOpen = !state.isFiltersOpen
    },
    setFiltersOpen: (state, action: PayloadAction<boolean>) => {
      state.isFiltersOpen = action.payload
    },
    setDiagnosticOpen: (state, action: PayloadAction<boolean>) => {
      state.isDiagnosticOpen = action.payload
    },
    openCinemaPlayer: (state, action: PayloadAction<ActiveCinemaPlayer>) => {
      state.activePlayer = action.payload
    },
    closeCinemaPlayer: (state) => {
      state.activePlayer = null
    },
  },
})

export const {
  setQuery,
  setDebouncedQuery,
  setImmediateQuery,
  setTypeFilter,
  setYearRange,
  setMinVotes,
  setLimit,
  resetFilters,
  setViewMode,
  setSelectedMovie,
  setSelectedMovieTconst,
  setSelectedPersonId,
  setSelectedShelfId,
  setSelectedMediaType,
  toggleFiltersOpen,
  setFiltersOpen,
  setDiagnosticOpen,
  openCinemaPlayer,
  closeCinemaPlayer,
} = searchSlice.actions

export default searchSlice.reducer

