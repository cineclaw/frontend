import * as React from "react"
import { Film } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface MoviePosterProps {
  src: string
  srcSet?: string
  sizes?: string
  alt: string
  className?: string
  aspectRatio?: "poster" | "square"
  priority?: boolean
}

export function MoviePoster({
  src,
  srcSet,
  sizes,
  alt,
  className = "",
  aspectRatio = "poster",
  priority = false,
}: MoviePosterProps) {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)

  // Reset states when src or srcSet changes
  React.useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
    setRetryCount(0)
  }, [src, srcSet])

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

  // Helper to append cache-buster v=2 and retry counter to bypass stale SVG placeholders from old browser cache
  const formatUrl = (url: string) => {
    if (!url) return url
    const withV = url.includes("v=")
      ? url
      : url.includes("?")
      ? `${url}&v=2`
      : `${url}?v=2`
    return retryCount > 0 ? `${withV}&r=${retryCount}` : withV
  }

  const effectiveSrc = formatUrl(src)

  const effectiveSrcSet = React.useMemo(() => {
    if (!srcSet) return undefined
    return srcSet
      .split(",")
      .map((entry) => {
        const trimmed = entry.trim()
        if (!trimmed) return ""
        const parts = trimmed.split(/\s+/)
        if (parts.length === 0 || !parts[0]) return trimmed
        const url = formatUrl(parts[0])
        const descriptor = parts[1] ? ` ${parts[1]}` : ""
        return `${url}${descriptor}`
      })
      .filter(Boolean)
      .join(", ")
  }, [srcSet, retryCount])

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
        srcSet={effectiveSrcSet}
        sizes={sizes}
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
        className={`h-full w-full object-cover transition-opacity duration-300 transform-gpu ${
          isLoaded && !hasError
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
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
