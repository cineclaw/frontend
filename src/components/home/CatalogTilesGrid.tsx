import type { ElementType } from 'react'
import {
  Zap,
  Flame,
  Film,
  Sparkles,
  Tv,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { setSelectedShelfId, setSelectedMediaType } from '@/store/searchSlice'
import { Badge } from '@/components/ui/badge'

interface CatalogTile {
  id: string
  title: string
  subtitle: string
  badge: string
  icon: ElementType
  iconColor: string
  gradient: string
  borderHover: string
}

const TILES: CatalogTile[] = [
  {
    id: 'tracker_hotlist',
    title: 'Популярно на трекерах',
    subtitle: 'Самый активный рой сидов RuTracker и RuTor прямо сейчас',
    badge: 'RuTor & RuTracker',
    icon: Zap,
    iconColor: 'text-emerald-400',
    gradient: 'from-emerald-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-950/40',
  },
  {
    id: 'uhd_4k',
    title: '4K UHD Кинозал',
    subtitle: 'Релизы в ультравысоком разрешении 2160p HDR & Dolby Vision',
    badge: '4K HDR / DV',
    icon: Sparkles,
    iconColor: 'text-amber-300',
    gradient: 'from-amber-950/40 via-yellow-950/20 to-cinema-950',
    borderHover: 'hover:border-amber-500/50 hover:shadow-amber-950/40',
  },
  {
    id: 'anime_hub',
    title: 'Аниме & Мультипликация',
    subtitle: 'Свежие онгоинги, анимационные шедевры и культовые франшизы',
    badge: 'Онгоинги & Хиты',
    icon: Tv,
    iconColor: 'text-pink-400',
    gradient: 'from-pink-950/35 via-purple-950/20 to-cinema-950',
    borderHover: 'hover:border-pink-500/50 hover:shadow-pink-950/40',
  },
  {
    id: 'doc_hub',
    title: 'Документальное кино',
    subtitle: 'Природа, наука, космос и история от BBC, Discovery и NatGeo',
    badge: 'Наука & Природа',
    icon: Film,
    iconColor: 'text-emerald-300',
    gradient: 'from-emerald-950/35 via-teal-950/20 to-cinema-950',
    borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-950/40',
  },
  {
    id: 'apple_tv',
    title: 'Apple TV+ Originals',
    subtitle: 'Silo, Severance, Ted Lasso, Slow Horses, Foundation',
    badge: 'Высокий рейтинг',
    icon: Sparkles,
    iconColor: 'text-zinc-200',
    gradient: 'from-zinc-800/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-zinc-400/50 hover:shadow-zinc-900/40',
  },
  {
    id: 'hbo_max',
    title: 'HBO / Max Originals',
    subtitle: 'The Penguin, House of the Dragon, The Sopranos, Succession',
    badge: 'Культовое',
    icon: Tv,
    iconColor: 'text-purple-400',
    gradient: 'from-purple-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-purple-500/50 hover:shadow-purple-950/40',
  },
  {
    id: 'netflix',
    title: 'Netflix Hits',
    subtitle: 'Stranger Things, The Gentlemen, Black Mirror, Squid Game',
    badge: 'Мировые хиты',
    icon: Film,
    iconColor: 'text-red-400',
    gradient: 'from-red-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-red-500/50 hover:shadow-red-950/40',
  },
  {
    id: 'amazon_prime',
    title: 'Amazon Prime Video',
    subtitle: 'The Boys, Reacher, Fallout, Invincible, The Rings of Power',
    badge: 'Блокбастеры',
    icon: Film,
    iconColor: 'text-sky-400',
    gradient: 'from-sky-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-sky-500/50 hover:shadow-sky-950/40',
  },
  {
    id: 'trending',
    title: 'В тренде недели',
    subtitle: 'Главные зрительские премьеры и хиты по версии TMDB',
    badge: 'Тренды',
    icon: Flame,
    iconColor: 'text-amber-400',
    gradient: 'from-amber-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-amber-500/50 hover:shadow-amber-950/40',
  },
  {
    id: 'digital',
    title: 'Цифровые новинки',
    subtitle: 'Свежие релизы в высоком качестве WEB-DL и Blu-ray',
    badge: 'WEB-DL',
    icon: Film,
    iconColor: 'text-cyan-400',
    gradient: 'from-cyan-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-cyan-500/50 hover:shadow-cyan-950/40',
  },
  {
    id: 'top_rated',
    title: 'Шедевры всех времён',
    subtitle: 'Золотой фонд мирового кинематографа (IMDb Top 250)',
    badge: 'Top 250',
    icon: Sparkles,
    iconColor: 'text-yellow-400',
    gradient: 'from-yellow-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-yellow-500/50 hover:shadow-yellow-950/40',
  },
  {
    id: 'catalog_filter',
    title: 'Умный каталог & Фильтр',
    subtitle: 'Точный подбор по странам (Корея, США, Франция...), жанрам и годам',
    badge: 'Поиск с фильтром',
    icon: SlidersHorizontal,
    iconColor: 'text-fuchsia-400',
    gradient: 'from-fuchsia-950/30 via-cinema-900/60 to-cinema-950',
    borderHover: 'hover:border-fuchsia-500/50 hover:shadow-fuchsia-950/40',
  },
]

export function CatalogTilesGrid() {

  const dispatch = useAppDispatch()
  const selectedMediaType = useAppSelector((state) => state.search.selectedMediaType)

  return (
    <div className="w-full max-w-4xl mx-auto px-1 sm:px-2 pt-2 pb-8">
      {/* Media Type Switcher: Movies vs Series */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-cinema-900/90 border border-border/80 rounded-xl shadow-inner backdrop-blur-md">
          <button
            type="button"
            onClick={() => dispatch(setSelectedMediaType('movie'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
              selectedMediaType === 'movie'
                ? 'bg-gradient-to-r from-red-600/90 to-amber-600/90 text-white shadow-md shadow-red-950/50 font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-cinema-800/50'
            }`}
          >
            <span>🎬</span>
            <span>Фильмы</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch(setSelectedMediaType('tv'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
              selectedMediaType === 'tv'
                ? 'bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white shadow-md shadow-purple-950/50 font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-cinema-800/50'
            }`}
          >
            <span>📺</span>
            <span>Сериалы</span>
          </button>
        </div>

        <span className="text-[11px] sm:text-xs text-muted-foreground/70 hidden sm:inline-block">
          Каталоги обновляются в реальном времени
        </span>
      </div>

      {/* Grid of Catalog Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
        {TILES.map((tile, idx) => {
          const Icon = tile.icon
          return (
            <motion.button
              key={tile.id}
              type="button"
              onClick={() => dispatch(setSelectedShelfId(tile.id))}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              whileHover={{ scale: 1.015, y: -2 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative text-left w-full p-4 rounded-2xl border border-border/70 bg-gradient-to-br ${tile.gradient} ${tile.borderHover} transition-all duration-300 shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden cursor-pointer`}
            >
              {/* Top Row: Icon + Badge */}
              <div className="flex items-start justify-between w-full mb-3">
                <div className="p-2.5 rounded-xl bg-cinema-900/90 border border-white/5 shadow-md flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${tile.iconColor}`} />
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-[11px] font-medium tracking-wide border-white/10 bg-black/40 text-muted-foreground group-hover:text-foreground group-hover:border-white/20 transition-colors"
                >
                  {tile.badge}
                </Badge>
              </div>

              {/* Middle: Title & Subtitle */}
              <div className="space-y-1 mb-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-white transition-colors flex items-center justify-between">
                  <span>{tile.title}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {tile.subtitle}
                </p>
              </div>

              {/* Bottom active media indicator */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground/60">
                <span>{selectedMediaType === 'tv' ? 'Сериалы платформы' : 'Фильмы платформы'}</span>
                <span className="font-semibold text-foreground/80 group-hover:underline">
                  Открыть →
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
