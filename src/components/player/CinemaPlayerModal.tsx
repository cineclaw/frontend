import React, { useState, useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Subtitles,
  Languages,
  ListVideo,
  X,
  Loader2,
  Check,
  PictureInPicture2,
  ChevronRight,
  Gauge,
} from 'lucide-react'
import {
  useGetPlayerInfoQuery,
  useReportPlayerStartMutation,
  useReportPlayerProgressMutation,
  useReportPlayerStopMutation,
  type AudioTrack,
  type SubtitleTrack,
  type EpisodeInfo,
} from '@/api/torrentsApi'

interface CinemaPlayerModalProps {
  tconst: string
  title: string
  ruTitle?: string
  initialSeason?: number
  initialEpisode?: number
  onClose: () => void
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const CinemaPlayerModal: React.FC<CinemaPlayerModalProps> = ({
  tconst,
  title,
  ruTitle,
  initialSeason,
  initialEpisode,
  onClose,
}) => {
  const [currentSeason, setCurrentSeason] = useState<number | undefined>(initialSeason)
  const [currentEpisode, setCurrentEpisode] = useState<number | undefined>(initialEpisode)

  // Fetch player info from backend
  const { data: playerInfo, isLoading, error } = useGetPlayerInfoQuery(
    { tconst, season: currentSeason, episode: currentEpisode },
    { refetchOnMountOrArgChange: true }
  )

  const [reportStart] = useReportPlayerStartMutation()
  const [reportProgress] = useReportPlayerProgressMutation()
  const [reportStop] = useReportPlayerStopMutation()

  // Player DOM and State
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [bufferedEnd, setBufferedEnd] = useState<number>(0)
  const [volume, setVolume] = useState<number>(1)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isBuffering, setIsBuffering] = useState<boolean>(true)
  const [showControls, setShowControls] = useState<boolean>(true)
  const [hasResumed, setHasResumed] = useState<boolean>(false)
  const [resumeToast, setResumeToast] = useState<{ show: boolean; time: number } | null>(null)

  // Audio / Subtitles / Speed / Drawer States
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null)
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false)
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false)
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState<boolean>(false)
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<boolean>(false)
  const [nextCountdown, setNextCountdown] = useState<number>(10)

  // Double tap animation indicators
  const [tapRipple, setTapRipple] = useState<'left' | 'right' | null>(null)

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReportedTimeRef = useRef<number>(0)
  const currentItemRef = useRef<{ id: string; mediaSourceId?: string; time: number }>({
    id: '',
    time: 0,
  })

  // Keep ref updated for unload/stop reporting
  useEffect(() => {
    if (playerInfo?.item_id) {
      currentItemRef.current = {
        id: playerInfo.item_id,
        mediaSourceId: playerInfo.media_source_id,
        time: currentTime,
      }
    }
  }, [playerInfo?.item_id, playerInfo?.media_source_id, currentTime])

  // Initialize Audio & Subtitle Defaults
  useEffect(() => {
    if (playerInfo?.audio_tracks && playerInfo.audio_tracks.length > 0 && selectedAudioIndex === null) {
      const defAudio = playerInfo.audio_tracks.find((a) => a.is_default) || playerInfo.audio_tracks[0]
      setSelectedAudioIndex(defAudio.index)
    }
  }, [playerInfo?.audio_tracks, selectedAudioIndex])

  // Reset controls hide timer on activity
  const handleUserActivity = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showAudioMenu && !showSubtitleMenu && !showSpeedMenu && !showEpisodesDrawer && isPlaying) {
        setShowControls(false)
      }
    }, 3200)
  }, [showAudioMenu, showSubtitleMenu, showSpeedMenu, showEpisodesDrawer, isPlaying])

  // HLS stream construction with selected audio track
  const getStreamUrl = useCallback(() => {
    if (!playerInfo?.stream_url) return ''
    let url = playerInfo.stream_url
    if (selectedAudioIndex !== null) {
      url += `&AudioStreamIndex=${selectedAudioIndex}`
    }
    return url
  }, [playerInfo?.stream_url, selectedAudioIndex])

  // Load and Attach HLS Stream
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playerInfo?.item_id || !playerInfo.success) return

    const streamUrl = getStreamUrl()
    if (!streamUrl) return

    setIsBuffering(true)

    // Save previous time if switching tracks
    const targetSeekTime = hasResumed
      ? video.currentTime
      : playerInfo.resume_seconds && playerInfo.resume_seconds > 10 && !playerInfo.is_played
      ? playerInfo.resume_seconds
      : 0

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
      })
      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false)
        if (targetSeekTime > 0) {
          video.currentTime = targetSeekTime
          if (!hasResumed && playerInfo.resume_seconds > 10) {
            setResumeToast({ show: true, time: playerInfo.resume_seconds })
            setHasResumed(true)
          }
        }
        video.play().catch(() => {
          setIsPlaying(false)
        })
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              hls.destroy()
              break
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS
      video.src = streamUrl
      const handleLoadedMetadata = () => {
        setIsBuffering(false)
        if (targetSeekTime > 0) {
          video.currentTime = targetSeekTime
          if (!hasResumed && playerInfo.resume_seconds > 10) {
            setResumeToast({ show: true, time: playerInfo.resume_seconds })
            setHasResumed(true)
          }
        }
        video.play().catch(() => {
          setIsPlaying(false)
        })
      }
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }

    // Report playback start
    reportStart({
      item_id: playerInfo.item_id,
      media_source_id: playerInfo.media_source_id,
      audio_stream_index: selectedAudioIndex ?? undefined,
      position_seconds: targetSeekTime,
    })

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [playerInfo?.item_id, getStreamUrl, reportStart])

  // Stop reporting on unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cur = currentItemRef.current
      if (cur.id) {
        reportStop({
          item_id: cur.id,
          media_source_id: cur.mediaSourceId,
          position_seconds: cur.time,
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const cur = currentItemRef.current
      if (cur.id) {
        reportStop({
          item_id: cur.id,
          media_source_id: cur.mediaSourceId,
          position_seconds: cur.time,
        })
      }
    }
  }, [reportStop])

  // Periodic Progress Heartbeat (Every 10 seconds while playing)
  useEffect(() => {
    if (!isPlaying || !playerInfo?.item_id) return

    const interval = setInterval(() => {
      const video = videoRef.current
      if (!video) return

      const time = video.currentTime
      if (Math.abs(time - lastReportedTimeRef.current) >= 5) {
        lastReportedTimeRef.current = time
        reportProgress({
          item_id: playerInfo.item_id!,
          media_source_id: playerInfo.media_source_id,
          position_seconds: time,
          is_paused: false,
          event: 'timeupdate',
        })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isPlaying, playerInfo?.item_id, playerInfo?.media_source_id, reportProgress])

  // Video Event Handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration)
    }

    // Buffered range
    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1))
    }

    // Next episode detection: prompt when remaining time < 45s
    if (playerInfo?.has_next_episode && video.duration > 60) {
      const remaining = video.duration - video.currentTime
      if (remaining <= 45 && !nextEpisodePrompt) {
        setNextEpisodePrompt(true)
      } else if (remaining > 45 && nextEpisodePrompt) {
        setNextEpisodePrompt(false)
      }
    }
  }

  // Next Episode Countdown
  useEffect(() => {
    if (!nextEpisodePrompt) return
    setNextCountdown(15)
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handlePlayNextEpisode()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [nextEpisodePrompt])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setIsPlaying(true)
      reportProgress({
        item_id: playerInfo?.item_id || '',
        media_source_id: playerInfo?.media_source_id,
        position_seconds: video.currentTime,
        is_paused: false,
        event: 'unpause',
      })
    } else {
      video.pause()
      setIsPlaying(false)
      reportProgress({
        item_id: playerInfo?.item_id || '',
        media_source_id: playerInfo?.media_source_id,
        position_seconds: video.currentTime,
        is_paused: true,
        event: 'pause',
      })
    }
  }

  const handleSeek = (newTime: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = newTime
    setCurrentTime(newTime)
    reportProgress({
      item_id: playerInfo?.item_id || '',
      media_source_id: playerInfo?.media_source_id,
      position_seconds: newTime,
      is_paused: video.paused,
      event: 'seek',
    })
  }

  const handleSkip = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const target = Math.max(0, Math.min(video.currentTime + seconds, duration || 999999))
    handleSeek(target)

    if (seconds < 0) {
      setTapRipple('left')
      setTimeout(() => setTapRipple(null), 600)
    } else {
      setTapRipple('right')
      setTimeout(() => setTapRipple(null), 600)
    }
  }

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current
    if (!video) return
    video.volume = newVol
    setVolume(newVol)
    setIsMuted(newVol === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    if (isMuted) {
      video.muted = false
      setIsMuted(false)
    } else {
      video.muted = true
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const togglePiP = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      }
    } catch (e) {
      console.error('PiP failed', e)
    }
  }

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  const handlePlayNextEpisode = () => {
    if (playerInfo?.next_episode) {
      // Save current stop
      if (playerInfo.item_id) {
        reportStop({
          item_id: playerInfo.item_id,
          media_source_id: playerInfo.media_source_id,
          position_seconds: currentTime,
        })
      }
      setNextEpisodePrompt(false)
      setHasResumed(false)
      setCurrentSeason(playerInfo.next_episode.season_number)
      setCurrentEpisode(playerInfo.next_episode.episode_number)
    }
  }

  const handleSelectEpisode = (ep: EpisodeInfo) => {
    if (playerInfo?.item_id) {
      reportStop({
        item_id: playerInfo.item_id,
        media_source_id: playerInfo.media_source_id,
        position_seconds: currentTime,
      })
    }
    setHasResumed(false)
    setShowEpisodesDrawer(false)
    setCurrentSeason(ep.season_number)
    setCurrentEpisode(ep.episode_number)
  }

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      handleUserActivity()

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
        case 'j':
          e.preventDefault()
          handleSkip(-10)
          break
        case 'ArrowRight':
        case 'l':
          e.preventDefault()
          handleSkip(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          handleVolumeChange(Math.min(1, volume + 0.1))
          break
        case 'ArrowDown':
          e.preventDefault()
          handleVolumeChange(Math.max(0, volume - 0.1))
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'Escape':
          e.preventDefault()
          if (showEpisodesDrawer) setShowEpisodesDrawer(false)
          else if (showAudioMenu) setShowAudioMenu(false)
          else if (showSubtitleMenu) setShowSubtitleMenu(false)
          else if (showSpeedMenu) setShowSpeedMenu(false)
          else onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, handleSkip, handleVolumeChange, toggleFullscreen, toggleMute, volume, showEpisodesDrawer, showAudioMenu, showSubtitleMenu, showSpeedMenu, onClose, handleUserActivity])

  // Progress Bar Scrubber Calculation
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none overflow-hidden"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      >
        {/* Render subtitle tracks if selected */}
        {selectedSubtitleIndex !== null && playerInfo?.subtitles && (
          <track
            kind="subtitles"
            src={playerInfo.subtitles.find((s) => s.index === selectedSubtitleIndex)?.delivery_url}
            default
          />
        )}
      </video>

      {/* Double Tap Seek Feedback Ripple */}
      {tapRipple === 'left' && (
        <div className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-5 rounded-full bg-white/10 backdrop-blur-md animate-ping pointer-events-none">
          <RotateCcw className="h-10 w-10 text-white" />
          <span className="text-xs font-bold text-white mt-1">-10s</span>
        </div>
      )}
      {tapRipple === 'right' && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-5 rounded-full bg-white/10 backdrop-blur-md animate-ping pointer-events-none">
          <RotateCw className="h-10 w-10 text-white" />
          <span className="text-xs font-bold text-white mt-1">+10s</span>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-black/30 backdrop-blur-[2px]">
          <Loader2 className="h-14 w-14 text-emerald-400 animate-spin" />
          <span className="text-xs text-zinc-300 font-medium tracking-wide mt-3">
            Буферизация потока...
          </span>
        </div>
      )}

      {/* Loading Player Info State */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-20">
          <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
          <p className="mt-4 text-sm text-zinc-300 font-medium">Подготовка кинозала...</p>
        </div>
      )}

      {/* Error State */}
      {(error || (playerInfo && !playerInfo.success)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 z-20 text-center">
          <div className="p-3 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-3">
            <X className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Не удалось запустить воспроизведение</h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            {playerInfo?.error || 'Ошибка связи с сервером Jellyfin. Проверьте монтирование тайтла.'}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold transition"
          >
            Вернуться назад
          </button>
        </div>
      )}

      {/* Floating Resume Notification Toast */}
      {resumeToast?.show && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-zinc-900/90 border border-emerald-500/40 backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in">
          <span className="text-xs text-zinc-200">
            Возобновлено с <span className="font-mono text-emerald-400 font-bold">{formatTime(resumeToast.time)}</span>
          </span>
          <button
            onClick={() => {
              handleSeek(0)
              setResumeToast(null)
            }}
            className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 underline decoration-dotted"
          >
            С начала
          </button>
          <button
            onClick={() => setResumeToast(null)}
            className="text-zinc-400 hover:text-white ml-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Next Episode Auto-Prompt Banner */}
      {nextEpisodePrompt && playerInfo?.next_episode && (
        <div className="absolute bottom-28 right-6 z-30 p-4 rounded-2xl bg-zinc-900/95 border border-emerald-500/50 backdrop-blur-xl shadow-2xl max-w-sm flex items-center gap-3.5 animate-slide-up">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <Play className="h-5 w-5 fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
              Следующая серия ({nextCountdown}с)
            </div>
            <div className="text-xs font-bold text-white truncate">
              {playerInfo.next_episode.name}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              Сезон {playerInfo.next_episode.season_number}, Эпизод {playerInfo.next_episode.episode_number}
            </div>
          </div>
          <button
            onClick={handlePlayNextEpisode}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shrink-0"
          >
            Включить
          </button>
        </div>
      )}

      {/* Cinema Controls Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-4 md:p-6 bg-gradient-to-t from-black/85 via-transparent to-black/70 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4 pointer-events-auto z-20">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-extrabold text-white truncate drop-shadow-md">
              {ruTitle || title}
            </h2>
            {playerInfo?.media_type === 'Episode' && playerInfo.title && (
              <p className="text-xs md:text-sm text-emerald-400 font-semibold truncate drop-shadow-sm">
                {playerInfo.title}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-white/10 backdrop-blur-md"
              title="Закрыть плеер (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Center Play Button Splash (on click/pause) */}
        {!isPlaying && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-6 rounded-full bg-black/60 border border-white/20 backdrop-blur-md shadow-2xl scale-110 animate-fade-in">
              <Play className="h-12 w-12 text-white fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="flex flex-col gap-2.5 pointer-events-auto z-20 max-w-5xl mx-auto w-full">
          {/* Interactive Scrub Bar */}
          <div
            className="group relative h-4 flex items-center cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              handleSeek(ratio * duration)
            }}
          >
            {/* Background track */}
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20 group-hover:h-2 transition-all">
              {/* Buffered progress */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                style={{ width: `${bufferPercent}%` }}
              />
              {/* Played progress */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Scrubber thumb */}
            <div
              className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-md border border-emerald-400 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-white">
            {/* Left Controls */}
            <div className="flex items-center gap-1.5 md:gap-3">
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl hover:bg-white/15 transition text-white"
                title={isPlaying ? 'Пауза (Space)' : 'Воспроизведение (Space)'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 md:h-6 md:w-6 fill-current" />
                ) : (
                  <Play className="h-5 w-5 md:h-6 md:w-6 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => handleSkip(-10)}
                className="p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                title="Назад на 10 секунд (←)"
              >
                <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
              </button>

              <button
                onClick={() => handleSkip(10)}
                className="p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                title="Вперед на 10 секунд (→)"
              >
                <RotateCw className="h-4 w-4 md:h-5 md:w-5" />
              </button>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-1 group/vol relative">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                  title="Звук (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5 text-rose-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 md:w-20 h-1.5 accent-emerald-400 rounded-lg cursor-pointer bg-white/20"
                />
              </div>

              {/* Timers */}
              <div className="text-[11px] md:text-xs font-mono text-zinc-300 ml-1">
                <span>{formatTime(currentTime)}</span>
                <span className="text-zinc-500 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 md:gap-2 relative">
              {/* Episodes Drawer Toggle (For TV Series) */}
              {playerInfo?.episodes && playerInfo.episodes.length > 1 && (
                <button
                  onClick={() => setShowEpisodesDrawer(!showEpisodesDrawer)}
                  className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                    showEpisodesDrawer ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                  }`}
                  title="Список серий"
                >
                  <ListVideo className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden md:inline">Серии</span>
                </button>
              )}

              {/* Audio Tracks Dropdown */}
              {playerInfo?.audio_tracks && playerInfo.audio_tracks.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowAudioMenu(!showAudioMenu)
                      setShowSubtitleMenu(false)
                      setShowSpeedMenu(false)
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                      showAudioMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Выбор аудиодорожки"
                  >
                    <Languages className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="hidden lg:inline">Звук</span>
                  </button>

                  {showAudioMenu && (
                    <div className="absolute bottom-12 right-0 w-64 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5">
                        Аудиодорожки
                      </div>
                      <div className="max-h-56 overflow-y-auto mt-1 space-y-1">
                        {playerInfo.audio_tracks.map((a: AudioTrack) => (
                          <button
                            key={a.index}
                            onClick={() => {
                              setSelectedAudioIndex(a.index)
                              setShowAudioMenu(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                              selectedAudioIndex === a.index
                                ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                : 'hover:bg-white/10 text-zinc-300'
                            }`}
                          >
                            <span className="truncate mr-2">{a.title}</span>
                            {selectedAudioIndex === a.index && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitles Dropdown */}
              {playerInfo?.subtitles && playerInfo.subtitles.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSubtitleMenu(!showSubtitleMenu)
                      setShowAudioMenu(false)
                      setShowSpeedMenu(false)
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                      showSubtitleMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Субтитры"
                  >
                    <Subtitles className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="hidden lg:inline">Субтитры</span>
                  </button>

                  {showSubtitleMenu && (
                    <div className="absolute bottom-12 right-0 w-56 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5">
                        Субтитры
                      </div>
                      <div className="max-h-56 overflow-y-auto mt-1 space-y-1">
                        <button
                          onClick={() => {
                            setSelectedSubtitleIndex(null)
                            setShowSubtitleMenu(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                            selectedSubtitleIndex === null
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                              : 'hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <span>Отключены</span>
                          {selectedSubtitleIndex === null && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                        {playerInfo.subtitles.map((s: SubtitleTrack) => (
                          <button
                            key={s.index}
                            onClick={() => {
                              setSelectedSubtitleIndex(s.index)
                              setShowSubtitleMenu(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                              selectedSubtitleIndex === s.index
                                ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                : 'hover:bg-white/10 text-zinc-300'
                            }`}
                          >
                            <span className="truncate mr-2">{s.title}</span>
                            {selectedSubtitleIndex === s.index && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Playback Speed Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu)
                    setShowAudioMenu(false)
                    setShowSubtitleMenu(false)
                  }}
                  className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                    showSpeedMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                  }`}
                  title="Скорость воспроизведения"
                >
                  <Gauge className="h-4 w-4 md:h-5 md:w-5" />
                  <span>{playbackSpeed}x</span>
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-12 right-0 w-36 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5">
                      Скорость
                    </div>
                    <div className="mt-1 space-y-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                            playbackSpeed === speed
                              ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                              : 'hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          <span>{speed}x</span>
                          {playbackSpeed === speed && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Picture-in-Picture */}
              <button
                onClick={togglePiP}
                className="hidden md:flex p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                title="Картинка в картинке"
              >
                <PictureInPicture2 className="h-4 w-4 md:h-5 md:w-5" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                title="Полноэкранный режим (F)"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" />
                ) : (
                  <Maximize className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Series Episodes Drawer (Slide-out panel) */}
      {showEpisodesDrawer && playerInfo?.episodes && (
        <div className="absolute top-0 right-0 bottom-0 w-80 max-w-full bg-zinc-950/95 border-l border-white/10 backdrop-blur-2xl z-40 p-4 flex flex-col shadow-2xl animate-slide-left">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ListVideo className="h-4 w-4 text-emerald-400" />
              <span>Список серий</span>
            </h3>
            <button
              onClick={() => setShowEpisodesDrawer(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
            {playerInfo.episodes.map((ep: EpisodeInfo) => {
              const isCurrent = ep.id === playerInfo.item_id
              return (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300'
                      : 'bg-zinc-900/60 border-white/5 hover:bg-zinc-800/80 text-zinc-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono text-zinc-400">
                      S{ep.season_number.toString().padStart(2, '0')}E{ep.episode_number.toString().padStart(2, '0')}
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      {ep.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-1">
                      {formatTime(ep.duration_seconds)}
                      {ep.resume_seconds > 0 && !ep.is_played && (
                        <span className="text-emerald-400 ml-2">
                          Ост. на {formatTime(ep.resume_seconds)}
                        </span>
                      )}
                      {ep.is_played && (
                        <span className="text-emerald-500 ml-2 font-bold">Просмотрено</span>
                      )}
                    </div>
                  </div>
                  {isCurrent ? (
                    <Play className="h-4 w-4 text-emerald-400 fill-current shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
