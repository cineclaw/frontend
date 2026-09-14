import * as React from "react"
import { Film } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface MoviePosterProps {
  src?: string
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

  // Reset states when src or srcSet changes
  React.useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src, srcSet])

  const aspectClass =
    aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-square"

  // If no source is provided, immediately show elegant cinema placeholder
  if (!src) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-cinema-950 border border-border/60 ${aspectClass} ${className} flex flex-col items-center justify-center p-3 text-center text-muted-foreground`}
      >
        <Film className="h-7 w-7 mb-1.5 opacity-40 text-primary" />
        <span className="text-[11px] font-medium line-clamp-2 leading-tight">{alt}</span>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-cinema-900 border border-border/60 ${aspectClass} ${className}`}
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}

      {/* Actual Image from TMDB CDN */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => {
          setIsLoaded(true)
          setHasError(false)
        }}
        onError={() => {
          setHasError(true)
          setIsLoaded(true)
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 transform-gpu ${
          isLoaded && !hasError
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Fallback Icon if failed */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-cinema-950 text-muted-foreground z-10">
          <Film className="h-7 w-7 mb-1.5 opacity-40 text-primary" />
          <span className="text-[11px] font-medium line-clamp-2 leading-tight">{alt}</span>
        </div>
      )}
    </div>
  )
}
