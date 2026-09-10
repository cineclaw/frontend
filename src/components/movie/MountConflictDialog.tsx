import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Layers, Replace, Loader2, ArrowUp } from "lucide-react"

interface MountConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  torrent: any
  isSeries?: boolean
  targetSeason?: number | null
  existingVersions?: string[]
  onConfirm: (mode: "replace" | "add_version", versionName?: string) => Promise<void>
  isMounting: boolean
}

export function MountConflictDialog({
  open,
  onOpenChange,
  torrent,
  isSeries,
  targetSeason,
  existingVersions,
  onConfirm,
  isMounting,
}: MountConflictDialogProps) {
  const [versionName, setVersionName] = useState("")

  // Compute sensible default version name when modal opens or torrent changes
  useEffect(() => {
    if (!torrent) return

    let label = "1080p"
    const titleLower = (torrent.title || "").toLowerCase()
    const isRemux = titleLower.includes("remux")

    if (torrent.resolution === "4k") {
      label = isRemux ? "4K Remux" : "4K UHD"
    } else if (torrent.resolution === "1080p") {
      label = isRemux ? "1080p Remux" : "1080p"
    } else if (torrent.resolution === "lq") {
      label = "SD"
    } else if (isRemux) {
      label = "Remux"
    }

    setVersionName(label)
  }, [torrent])

  if (!torrent) return null

  const handleAddVersion = () => {
    onConfirm("add_version", versionName.trim() || "Дополнительная версия")
  }

  const handleReplace = () => {
    onConfirm("replace")
  }

  const effectiveTrackers =
    torrent.trackers && torrent.trackers.length > 0
      ? torrent.trackers
      : [torrent.tracker]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[99]"
        className="z-[100] w-[92vw] max-w-lg bg-cinema-900 border-border/80 p-4 sm:p-6 rounded-2xl shadow-2xl max-h-[85dvh] overflow-y-auto custom-scrollbar"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Layers className="h-5 w-5 text-primary" />
            <span>Медиа уже есть в библиотеке</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {isSeries && targetSeason ? (
              <>Сезон {targetSeason} уже присутствует в вашей медиатеке.</>
            ) : isSeries ? (
              <>Сериал уже добавлен в вашу медиатеку.</>
            ) : (
              <>Этот фильм уже добавлен в вашу медиатеку.</>
            )}{" "}
            Выберите, как поступить с новым релизом:
          </DialogDescription>
        </DialogHeader>

        {/* Incoming release info summary */}
        <div className="p-3 rounded-xl bg-cinema-850/80 border border-border/60 text-left space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {effectiveTrackers.map((tr: string) => (
              <span
                key={tr}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-zinc-800 text-zinc-300 border border-zinc-700/60"
              >
                {tr}
              </span>
            ))}
            {torrent.resolution === "4k" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                4K UHD
              </span>
            )}
            {torrent.resolution === "1080p" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/15 text-sky-300 border border-sky-500/30">
                1080p
              </span>
            )}
            <span className="text-xs font-mono font-semibold text-zinc-300">
              {torrent.size_human}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-mono font-bold text-emerald-400">
              <ArrowUp className="h-3 w-3" />
              {torrent.seeds}
            </span>
          </div>
          <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed font-medium">
            {torrent.title}
          </p>
          {existingVersions && existingVersions.length > 0 && (
            <div className="pt-1 border-t border-border/40 text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-zinc-300">Текущие версии:</span>
              {existingVersions.map((v) => (
                <span
                  key={v}
                  className="px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300 font-mono text-[10px]"
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Choice 1: Add as Version */}
        <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 space-y-3 text-left">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0 mt-0.5">
              <Layers className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Добавить как дополнительную версию
                <span className="text-[10px] uppercase font-bold text-primary px-1.5 py-0.5 bg-primary/20 rounded">
                  Рекомендуется
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                В плеере появится удобный переключатель версий для фильма или эпизодов. Предыдущие файлы сохранятся.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-medium text-zinc-300">
              Название версии (для меню в плеере):
            </label>
            <Input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Например: 4K UHD, Remux, Дублированный"
              className="h-10 text-[16px] sm:text-xs bg-cinema-950 border-border/80"
              disabled={isMounting}
            />
          </div>

          <Button
            type="button"
            className="w-full h-9 text-xs font-semibold gap-1.5"
            onClick={handleAddVersion}
            disabled={isMounting || !versionName.trim()}
          >
            {isMounting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            <span>Добавить версию «{versionName.trim() || "Новая"}»</span>
          </Button>
        </div>

        {/* Choice 2: Replace */}
        <div className="p-4 rounded-xl border border-border/70 bg-cinema-850/50 space-y-2.5 text-left">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <Replace className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">
                Заменить существующий релиз
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isSeries && targetSeason
                  ? `Старый релиз сезона ${targetSeason} будет заменен на этот релиз.`
                  : `Текущий релиз будет заменен в TorrServer на новую раздачу.`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-9 text-xs font-medium border-amber-500/40 text-amber-400 hover:bg-amber-500/15 hover:text-amber-300 gap-1.5 transition-colors"
            onClick={handleReplace}
            disabled={isMounting}
          >
            {isMounting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Replace className="h-3.5 w-3.5" />
            )}
            <span>Заменить текущий релиз</span>
          </Button>
        </div>

        {/* Cancel button */}
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isMounting}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
