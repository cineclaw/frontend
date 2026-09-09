import * as React from "react"
import { Search, X, Loader2 } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { setQuery, setDebouncedQuery, setImmediateQuery } from "@/store/searchSlice"

interface SearchBarProps {
  isLoading?: boolean
  onFilterClick?: () => void
  activeFiltersCount?: number
  isFiltersOpen?: boolean
}

export function SearchBar({
  isLoading,
  onFilterClick,
  activeFiltersCount = 0,
  isFiltersOpen,
}: SearchBarProps) {
  const dispatch = useAppDispatch()
  const reduxQuery = useAppSelector((state) => state.search.query)
  const debouncedQuery = useAppSelector((state) => state.search.debouncedQuery)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local state for smooth unthrottled typing
  const [inputValue, setInputValue] = React.useState(reduxQuery)

  // Sync with external updates to Redux query (e.g. from suggestion chips or clear)
  React.useEffect(() => {
    setInputValue(reduxQuery)
  }, [reduxQuery])

  // Clear debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!val.trim()) {
      // Empty input: clear results immediately without waiting!
      dispatch(setImmediateQuery(""))
    } else {
      // Typing non-empty text: debounce 400ms
      timerRef.current = setTimeout(() => {
        dispatch(setQuery(val))
        dispatch(setDebouncedQuery(val))
        timerRef.current = null
      }, 400)
    }
  }

  // Global hotkey '/' to focus search bar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Immediate search on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      dispatch(setImmediateQuery(inputValue))
      inputRef.current?.blur()
    }
  }

  const handleClear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setInputValue("")
    dispatch(setImmediateQuery(""))
    inputRef.current?.focus()
  }

  const isTypingPending = inputValue.trim() !== debouncedQuery.trim()

  return (
    <div className="relative w-full max-w-3xl mx-auto flex items-center gap-2">
      <div className="relative flex-1 flex items-center group">
        {/* Search Icon */}
        <div className="absolute left-3.5 sm:left-4.5 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          {isLoading || isTypingPending ? (
            <Loader2 className="h-4.5 w-4.5 sm:h-5 sm:w-5 animate-spin text-primary" />
          ) : (
            <Search className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          )}
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Поиск фильма, сериала (напр. Сопрано)..."
          className="w-full h-12 sm:h-14 pl-10 sm:pl-13 pr-10 sm:pr-20 rounded-2xl border border-border/90 sm:border-2 bg-cinema-900/95 text-foreground text-sm sm:text-base shadow-lg sm:shadow-2xl backdrop-blur-xl placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/80 focus:ring-2 sm:focus:ring-4 focus:ring-primary/10 transition-all"
        />

        {/* Clear Button */}
        {inputValue && (
          <div className="absolute right-2 sm:right-3.5 flex items-center">
            <button
              onClick={handleClear}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-cinema-800 transition-all"
              title="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Desktop Hotkey Badge */}
        {!inputValue && (
          <div className="hidden sm:flex absolute right-3.5 items-center space-x-1 px-2 py-1 rounded-lg border border-border/60 bg-cinema-850/90 text-[11px] font-mono text-muted-foreground">
            <span>/</span>
          </div>
        )}
      </div>

      {/* Filter Button (Dock Mobile/Desktop) */}
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className={`relative flex items-center justify-center h-12 sm:h-14 px-3 sm:px-4 rounded-2xl border transition-all ${
            isFiltersOpen
              ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
              : activeFiltersCount > 0
              ? "bg-cinema-850 border-primary/50 text-primary"
              : "bg-cinema-900/95 border-border/80 text-muted-foreground hover:text-foreground"
          }`}
          title="Фильтры"
        >
          <span className="sr-only">Фильтры</span>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" x2="20" y1="21" y2="21" />
            <line x1="4" x2="20" y1="14" y2="14" />
            <line x1="4" x2="20" y1="7" y2="7" />
            <circle cx="14" cy="21" r="2" />
            <circle cx="8" cy="14" r="2" />
            <circle cx="16" cy="7" r="2" />
          </svg>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-md">
              {activeFiltersCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
