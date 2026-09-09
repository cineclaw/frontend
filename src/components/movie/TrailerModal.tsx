import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import type { VideoItem } from "@/api/types"

interface TrailerModalProps {
  video: VideoItem | null
  onClose: () => void
}

export function TrailerModal({ video, onClose }: TrailerModalProps) {
  if (!video) return null

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[60] w-[95vw] max-w-3xl p-0 bg-black border-border/80 rounded-2xl overflow-hidden shadow-2xl [&>button]:hidden">
        <div className="relative aspect-video w-full bg-black">
          {/* Header Bar */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-auto">
            <DialogTitle className="text-xs sm:text-sm font-bold text-white truncate max-w-[80%] drop-shadow">
              {video.name}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/70 text-white/90 hover:text-white hover:bg-black/90 transition-colors backdrop-blur-md active:scale-95"
              title="Закрыть трейлер"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* YouTube Embed Player */}
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
            title={video.name}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
