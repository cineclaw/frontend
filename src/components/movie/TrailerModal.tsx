import { useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { X, Loader2, AlertCircle } from "lucide-react"
import Hls from "hls.js"
import type { VideoItem } from "@/api/types"
import { useGetTrailerStreamQuery } from "@/api/moviesApi"

interface TrailerModalProps {
  video: VideoItem | null
  onClose: () => void
}

export function TrailerModal({ video, onClose }: TrailerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const isKinopoisk = video?.site?.toLowerCase() === "kinopoisk"
  const isYouTube = video?.site?.toLowerCase() === "youtube"

  // Only query Kinopoisk stream if video is Kinopoisk and stream_url is not already present
  const { data: streamData, isLoading: isStreamLoading, isError: isStreamError } = useGetTrailerStreamQuery(
    video?.key ?? "",
    { skip: !video || !isKinopoisk || Boolean(video.stream_url) }
  )

  const streamUrl = video?.stream_url || streamData?.stream_url

  useEffect(() => {
    if (!isKinopoisk || !streamUrl) return

    const videoEl = videoRef.current
    if (!videoEl) return

    let hls: Hls | null = null

    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari / iOS HLS support
      videoEl.src = streamUrl
      videoEl.play().catch(() => {
        // Autoplay may be blocked by browser policy until user interaction
      })
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      })
      hls.loadSource(streamUrl)
      hls.attachMedia(videoEl)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data)
        }
      })
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [isKinopoisk, streamUrl])

  if (!video) return null

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="z-[89]"
        className="z-[90] w-[95vw] max-w-3xl p-0 bg-black border-border/80 rounded-2xl overflow-hidden shadow-2xl [&>button]:hidden"
      >
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {/* Header Bar */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-auto">
            <div className="flex items-center gap-2 max-w-[80%]">
              {isKinopoisk && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ff5500]/20 text-[#ff7733] border border-[#ff5500]/40">
                  Кинопоиск
                </span>
              )}
              <DialogTitle className="text-xs sm:text-sm font-bold text-white truncate drop-shadow">
                {video.name}
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/70 text-white/90 hover:text-white hover:bg-black/90 transition-colors backdrop-blur-md active:scale-95"
              title="Закрыть трейлер"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Kinopoisk HLS Player */}
          {isKinopoisk ? (
            <>
              {isStreamLoading && (
                <div className="flex flex-col items-center gap-2 text-white/70">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="text-xs">Загрузка трейлера Кинопоиск...</span>
                </div>
              )}
              {isStreamError && !streamUrl && (
                <div className="flex flex-col items-center gap-2 text-red-400 p-4 text-center">
                  <AlertCircle className="w-8 h-8" />
                  <span className="text-sm">Не удалось загрузить видеопоток трейлера</span>
                </div>
              )}
              {streamUrl && (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </>
          ) : isYouTube ? (
            /* YouTube Embed Player */
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
              title={video.name}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            /* Generic / Fallback Iframe */
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
              title={video.name}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

