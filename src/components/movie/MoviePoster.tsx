import * as React from "react"
import { Film } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface MoviePosterProps {
  src: string
  alt: string
  className?: string
  aspectRatio?: "poster" | "square"
  priority?: boolean
}

export function MoviePoster({
  src,
  alt,
  className = "",
  aspectRatio = "poster",
  priority = false,
}: MoviePosterProps) {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)

  // Reset states when src changes
  React.useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
    setRetryCount(0)
  }, [src])

  // Safety watchdog: If image takes > 12s (e.g. network stall / rate-limit), display fallback card without killing the underlying image load
  React.useEffect(() => {
    if (isLoaded || hasError) return
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setHasError(true)
      }
    }, 12000)
    return () => clearTimeout(timer)
  }, [src, isLoaded, hasError, retryCount])

  const aspectClass =
    aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-square"

  // Append cache-buster v=2 and retry counter to bypass stale SVG placeholders from old browser cache
  const baseSrc = src.includes('v=')
    ? src
    : src.includes('?')
    ? `${src}&v=2`
    : `${src}?v=2`

  const effectiveSrc = retryCount > 0 ? `${baseSrc}&r=${retryCount}` : baseSrc

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-cinema-900 border border-border/60 ${aspectClass} ${className}`}
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}

      {/* Actual Image */}
      <img
        src={effectiveSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => {
          setIsLoaded(true)
          setHasError(false)
        }}
        onError={() => {
          if (retryCount < 2) {
            // Auto-retry after 2s: by then, backend may have finished writing poster to disk
            setTimeout(() => {
              setRetryCount((c) => c + 1)
            }, 2000)
          } else {
            setHasError(true)
            setIsLoaded(true)
          }
        }}
        className={`h-full w-full object-cover transition-all duration-300 ${
          isLoaded && !hasError
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95"
        }`}
      />

      {/* Fallback Icon if failed or while waiting */}
      {hasError && !isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-cinema-950 text-muted-foreground z-10">
          <Film className="h-7 w-7 mb-1.5 opacity-40 text-primary" />
          <span className="text-[11px] font-medium line-clamp-2 leading-tight">{alt}</span>
        </div>
      )}
    </div>
  )
}
