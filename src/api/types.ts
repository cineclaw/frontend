export interface PosterUrls {
  thumbnail: string
  small: string
  medium: string
  large: string
  xl?: string
}

export interface MovieDoc {
  tconst: string
  title_ru?: string | null
  title_orig: string
  title_primary: string
  russian_titles: string[]
  year?: number | null
  title_type: string
  rating?: number | null
  num_votes: number
  genres: string[]
  runtime_minutes?: number | null
}

export interface SearchHit {
  movie: MovieDoc
  score: number
  bm25_score: number
  popularity_multiplier: number
  poster_path?: string
  backdrop_path?: string
  poster_url: string
  posters: PosterUrls
}

export interface SearchResponse {
  query: string
  total_hits: number
  took_ms: number
  hits: SearchHit[]
}

export interface DownloaderState {
  dumps: Record<string, {
    filename: string
    etag?: string
    last_modified?: string
    content_length?: number
    downloaded_at?: string
  }>
  last_checked_at?: string
  last_indexed_at?: string
}

export interface StatusResponse {
  status: string
  is_indexing: boolean
  total_documents: number
  downloader_state: DownloaderState
}

export interface SearchFilters {
  type?: string
  year_from?: number
  year_to?: number
  min_votes?: number
  limit?: number
}

export interface SearchQueryParams extends SearchFilters {
  q: string
}

export interface SeriesSeasonItem {
  season_number: number
  name: string
  episode_count: number
  air_date?: string | null
  poster_path?: string | null
  overview?: string | null
  vote_average?: number | null
}

export interface SeriesSeasonsResponse {
  tconst: string
  tmdb_id: number
  name: string
  original_name: string
  overview?: string | null
  premiered?: string | null
  rating?: number | null
  genres?: string[]
  studio?: string | null
  status?: string | null
  poster_path?: string | null
  backdrop_path?: string | null
  logo_path?: string | null
  number_of_seasons: number
  number_of_episodes: number
  seasons: SeriesSeasonItem[]
}

export interface SeriesEpisodeItem {
  season_number: number
  episode_number: number
  name: string
  overview: string
  air_date?: string
  still_path?: string
  vote_average?: number | null
  vote_count?: number | null
  runtime?: number | null
  episode_type?: string | null
}

export interface CastMember {
  id: number
  name: string
  character?: string | null
  profile_path?: string | null
  order?: number | null
}

export interface CrewMember {
  id: number
  name: string
  job: string
  department?: string | null
  profile_path?: string | null
}

export interface VideoItem {
  id: string
  name: string
  key: string
  site: string
  type: string
  official: boolean
  published_at?: string | null
}

export interface MovieMetadataResponse {
  tconst: string
  tmdb_id: number
  title: string
  original_title: string
  overview?: string | null
  premiered?: string | null
  year?: number | null
  rating?: number | null
  genres: string[]
  poster_path?: string | null
  backdrop_path?: string | null
  logo_path?: string | null
  cast: CastMember[]
  crew: CrewMember[]
  videos: VideoItem[]
  runtime_minutes?: number | null
  backdrops?: string[]
}

export interface PersonCreditItem {
  id: number
  media_type: 'movie' | 'tv' | string
  title: string
  original_title?: string | null
  character?: string | null
  job?: string | null
  department?: string | null
  release_date?: string | null
  year?: number | null
  vote_average?: number | null
  vote_count: number
  poster_path?: string | null
  backdrop_path?: string | null
}

export interface PersonDetailsResponse {
  id: number
  name: string
  biography?: string | null
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  known_for_department?: string | null
  profile_path?: string | null
  imdb_id?: string | null
  cast: PersonCreditItem[]
  crew: PersonCreditItem[]
}

export interface FeedItem {
  id: number
  tconst?: string
  media_type: 'movie' | 'tv' | string
  title: string
  original_title?: string | null
  year?: number | null
  rating?: number | null
  vote_count: number
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string | null
  // Tracker Hotlist specific fields
  seeds?: number
  leeches?: number
  tracker?: string
  quality?: string
  torrent_count?: number
}

export interface FeedShelf {
  id: string
  title: string
  icon: 'flame' | 'film' | 'tv' | 'star' | 'zap' | string
  media_type?: 'movie' | 'tv' | string
  items: FeedItem[]
  page?: number
  total_pages?: number
  total_results?: number
}

export interface DiscoverCatalogParams {
  type?: 'movie' | 'tv'
  network?: 'apple' | 'hbo' | 'netflix' | 'amazon' | 'disney'
  genres?: string
  countries?: string
  year_from?: number
  year_to?: number
  min_rating?: number
  sort_by?: string
  page?: number
}

export interface TrackerStatusItem {
  name: string
  enabled: boolean
  base_url: string
  username?: string
  status: 'online' | 'challenge_required' | 'disabled' | 'error' | string
  has_cookie?: boolean
  has_cf_clearance?: boolean
  has_session?: boolean
  user_agent?: string
  masked_cookie?: string
}

export interface TrackersStatusResponse {
  rutor: TrackerStatusItem
  nnmclub: TrackerStatusItem
  rutracker: TrackerStatusItem
}

export interface UpdateRuTrackerCookiePayload {
  cookie: string
  user_agent?: string
}

export interface RuTrackerTestResponse {
  ok: boolean
  status_code: number
  message: string
  status?: TrackerStatusItem
}




