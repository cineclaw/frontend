export interface FilterState {
  country?: string
  genre?: string
  yearRange?: { from?: number; to?: number; label: string }
  minRating?: number
  sort?: string
}

interface CatalogFilterBarProps {
  mediaType: 'movie' | 'tv'
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const COUNTRIES = [
  { id: '', label: 'Все страны' },
  { id: 'US', label: '🇺🇸 США' },
  { id: 'KR', label: '🇰🇷 Юж. Корея' },
  { id: 'JP', label: '🇯🇵 Япония' },
  { id: 'GB', label: '🇬🇧 Британия' },
  { id: 'FR', label: '🇫🇷 Франция' },
  { id: 'RU', label: '🇷🇺 Россия' },
]

const YEAR_RANGES = [
  { label: 'Все годы', from: undefined, to: undefined },
  { label: '2025–2026', from: 2025, to: 2026 },
  { label: '2020–2024', from: 2020, to: 2024 },
  { label: '2010–2019', from: 2010, to: 2019 },
  { label: '2000–2009', from: 2000, to: 2009 },
  { label: '90-е', from: 1990, to: 1999 },
]

export function CatalogFilterBar({ mediaType, filters, onChange }: CatalogFilterBarProps) {
  const isTv = mediaType === 'tv'

  const GENRES = [
    { id: '', label: 'Все жанры' },
    { id: isTv ? '10759' : '28', label: 'Боевик' },
    { id: isTv ? '10765' : '878', label: 'Фантастика' },
    { id: isTv ? '9648' : '53', label: 'Триллер' },
    { id: '35', label: 'Комедия' },
    { id: '18', label: 'Драма' },
    { id: '80', label: 'Криминал' },
    { id: '16', label: 'Аниме / Мультфильм' },
    { id: '27', label: 'Ужасы' },
  ]

  const RATINGS = [
    { value: undefined, label: 'Любой рейтинг' },
    { value: 7.0, label: '★ 7.0+' },
    { value: 7.5, label: '★ 7.5+' },
    { value: 8.0, label: '★ 8.0+' },
  ]

  return (
    <div className="space-y-2.5 py-2 w-full border-b border-white/5 mb-4">
      {/* Countries scroll row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 pl-4 sm:-mx-6 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 shrink-0 mr-1">
          Страна:
        </span>
        {COUNTRIES.map((c) => {
          const active = (filters.country || '') === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange({ ...filters, country: c.id || undefined })}
              className={`px-2.5 py-1 rounded-lg text-xs shrink-0 transition-all font-medium ${
                active
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-cinema-850/80 text-muted-foreground hover:text-foreground hover:bg-cinema-800'
              }`}
            >
              {c.label}
            </button>
          )
        })}
        <div className="shrink-0 w-3 sm:w-4 pointer-events-none" aria-hidden="true" />
      </div>

      {/* Genres scroll row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 pl-4 sm:-mx-6 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 shrink-0 mr-1">
          Жанр:
        </span>
        {GENRES.map((g) => {
          const active = (filters.genre || '') === g.id
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange({ ...filters, genre: g.id || undefined })}
              className={`px-2.5 py-1 rounded-lg text-xs shrink-0 transition-all font-medium ${
                active
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-cinema-850/80 text-muted-foreground hover:text-foreground hover:bg-cinema-800'
              }`}
            >
              {g.label}
            </button>
          )
        })}
        <div className="shrink-0 w-3 sm:w-4 pointer-events-none" aria-hidden="true" />
      </div>

      {/* Years & Ratings row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-4 pl-4 sm:-mx-6 sm:pl-6 pr-0 scroll-pl-4 sm:scroll-pl-6">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 shrink-0 mr-1">
            Год:
          </span>
          {YEAR_RANGES.map((y) => {
            const active =
              filters.yearRange?.from === y.from && filters.yearRange?.to === y.to
            return (
              <button
                key={y.label}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    yearRange: y.from ? { from: y.from, to: y.to, label: y.label } : undefined,
                  })
                }
                className={`px-2 py-0.5 rounded-md text-[11px] shrink-0 transition-all font-medium ${
                  active
                    ? 'bg-foreground text-background font-bold shadow-sm'
                    : 'bg-cinema-900 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-cinema-850'
                }`}
              >
                {y.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {RATINGS.map((r) => {
            const active = filters.minRating === r.value
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => onChange({ ...filters, minRating: r.value })}
                className={`px-2 py-0.5 rounded-md text-[11px] shrink-0 transition-all font-medium ${
                  active
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'bg-cinema-900 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-cinema-850'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <div className="shrink-0 w-3 sm:w-4 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  )
}
