import { Film, Tv, Sparkles, Flame, Clapperboard } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setTypeFilter, setMinVotes } from "@/store/searchSlice"
import { Button } from "@/components/ui/button"

export function QuickChips() {
  const dispatch = useAppDispatch()
  const currentType = useAppSelector((state) => state.search.filters.type)
  const currentMinVotes = useAppSelector((state) => state.search.filters.min_votes)

  const chips = [
    {
      id: "all",
      label: "Все тайтлы",
      icon: Sparkles,
      isActive: currentType === undefined && currentMinVotes === undefined,
      onClick: () => {
        dispatch(setTypeFilter(undefined))
        dispatch(setMinVotes(undefined))
      },
    },
    {
      id: "movie",
      label: "Фильмы",
      icon: Film,
      isActive: currentType === "movie",
      onClick: () => {
        dispatch(setTypeFilter(currentType === "movie" ? undefined : "movie"))
      },
    },
    {
      id: "tvSeries",
      label: "Сериалы",
      icon: Tv,
      isActive: currentType === "tvSeries",
      onClick: () => {
        dispatch(setTypeFilter(currentType === "tvSeries" ? undefined : "tvSeries"))
      },
    },
    {
      id: "tvMiniSeries",
      label: "Мини-сериалы",
      icon: Clapperboard,
      isActive: currentType === "tvMiniSeries",
      onClick: () => {
        dispatch(setTypeFilter(currentType === "tvMiniSeries" ? undefined : "tvMiniSeries"))
      },
    },
    {
      id: "hits",
      label: "Хиты (>100K голосов)",
      icon: Flame,
      isActive: currentMinVotes === 100_000,
      onClick: () => {
        dispatch(setMinVotes(currentMinVotes === 100_000 ? undefined : 100_000))
      },
    },
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar justify-start sm:justify-center py-1.5 -mx-3 pl-3 pr-0 sm:mx-0 sm:px-0 scroll-pl-3">
      {chips.map((chip) => {
        const Icon = chip.icon
        return (
          <Button
            key={chip.id}
            variant="chip"
            size="sm"
            data-active={chip.isActive}
            onClick={chip.onClick}
            className="flex-shrink-0 gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{chip.label}</span>
          </Button>
        )
      })}
      {/* Trailing spacer for comfortable right padding when scrolled to end on mobile */}
      <div className="shrink-0 w-3 sm:hidden pointer-events-none" aria-hidden="true" />
    </div>
  )
}
