import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
  Zap,
  SlidersHorizontal,
  ExternalLink,
  Copy,
} from 'lucide-react'
import {
  useGetPlayerInfoQuery,
  useReportPlayerStartMutation,
  useReportPlayerProgressMutation,
  useReportPlayerStopMutation,
  useGetTorrentsQuery,
  useMountTorrentMutation,
  type AudioTrack,
  type SubtitleTrack,
  type EpisodeInfo,
  type PlayerInfoResponse,
  type TorrentResult,
} from '@/api/torrentsApi'
import { classifyResolution, extractAudioLabel } from '@/lib/torrentSelector'
import { formatBytes } from '@/lib/utils'

export interface QualityPreset {
  id: string
  label: string
  shortLabel: string
  description: string
  width?: number
  height?: number
  videoBitrate?: number
  audioBitrate?: number
  isOriginal?: boolean
}

export function buildQualityLadder(info: PlayerInfoResponse): QualityPreset[] {
  const w = info.width || 0
  const h = info.height || 0
  const is4K = w >= 2500 || h >= 1400
  const is1080p = !is4K && (w >= 1300 || h >= 750 || (w === 0 && h === 0))
  const is720p = !is4K && !is1080p && (w >= 900 || h >= 500)

  const ladder: QualityPreset[] = []

  // 1. Original (Direct Stream copy for native codecs, highest bitrate transcode otherwise)
  ladder.push({
    id: 'original',
    label: `Оригинал (${is4K ? '4K UHD' : is1080p ? '1080p FHD' : is720p ? '720p HD' : 'SD'})`,
    shortLabel: is4K ? '4K' : is1080p ? '1080p' : is720p ? '720p' : 'SD',
    description: 'Без сжатия • Direct Stream',
    isOriginal: true,
    videoBitrate: is4K ? 45000000 : is1080p ? 25000000 : is720p ? 15000000 : 8000000,
    audioBitrate: 384000,
  })

  // 2. 1080p High (6 Mbps)
  if (is4K || is1080p) {
    ladder.push({
      id: '1080p_high',
      label: '1080p FHD (Высокое • 6 Мбит/с)',
      shortLabel: '1080p HQ',
      description: 'Высокая чёткость для ТВ и ПК',
      width: 1920,
      height: 1080,
      videoBitrate: 6000000,
      audioBitrate: 256000,
    })
  }

  // 3. 1080p Standard / Web (3.5 Mbps)
  if (is4K || is1080p) {
    ladder.push({
      id: '1080p_std',
      label: '1080p FHD (Веб • 3.5 Мбит/с)',
      shortLabel: '1080p',
      description: 'Оптимально для веба и плавного потока',
      width: 1920,
      height: 1080,
      videoBitrate: 3500000,
      audioBitrate: 192000,
    })
  }

  // 4. 720p HD (2.2 Mbps)
  if (is4K || is1080p || is720p) {
    ladder.push({
      id: '720p',
      label: '720p HD (Эконом • 2.2 Мбит/с)',
      shortLabel: '720p',
      description: 'Для мобильных сетей и слабого интернета',
      width: 1280,
      height: 720,
      videoBitrate: 2200000,
      audioBitrate: 192000,
    })
  }

  // 5. 480p SD (1.2 Mbps)
  ladder.push({
    id: '480p',
    label: '480p SD (Низкий трафик • 1.2 Мбит/с)',
    shortLabel: '480p',
    description: 'Минимальный расход трафика',
    width: 854,
    height: 480,
    videoBitrate: 1200000,
    audioBitrate: 128000,
  })

  return ladder
}

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

  useEffect(() => {
    if (initialSeason !== undefined) setCurrentSeason(initialSeason)
    if (initialEpisode !== undefined) setCurrentEpisode(initialEpisode)
  }, [initialSeason, initialEpisode])

  // Fetch player info from backend
  const { data: playerInfo, isLoading, error, refetch } = useGetPlayerInfoQuery(
    { tconst, season: currentSeason, episode: currentEpisode },
    { refetchOnMountOrArgChange: true }
  )

  // Auto-retry polling if Jellyfin is still scanning the newly mounted library folder
  const [syncRetryCount, setSyncRetryCount] = useState<number>(0)
  const isSyncingWithJellyfin = Boolean(
    !isLoading &&
    playerInfo &&
    !playerInfo.success &&
    (playerInfo.error?.includes('метадан') ||
     playerInfo.error?.includes('подключен') ||
     playerInfo.error?.includes('сканирует') ||
     playerInfo.error?.includes('серий') ||
     playerInfo.error?.includes('Сезон') ||
     playerInfo.error?.includes('смонтирован')) &&
    syncRetryCount < 10
  )
  const isErrorState = Boolean(!isSyncingWithJellyfin && (error || (playerInfo && !playerInfo.success)))

  useEffect(() => {
    if (isSyncingWithJellyfin) {
      const timer = setTimeout(() => {
        setSyncRetryCount((prev) => prev + 1)
        refetch()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isSyncingWithJellyfin, refetch])

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

  // Audio / Subtitles / Speed / Drawer States
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | null>(null)
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false)
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false)
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState<boolean>(false)
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false)
  const [showExternalMenu, setShowExternalMenu] = useState<boolean>(false)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)
  const [qualityToast, setQualityToast] = useState<string | null>(null)
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<boolean>(false)
  const [nextCountdown, setNextCountdown] = useState<number>(10)

  // Quality presets & ladder
  const [selectedQualityId, setSelectedQualityId] = useState<string>(() => {
    try {
      return localStorage.getItem('cineclaw_player_quality') || 'original'
    } catch {
      return 'original'
    }
  })

  const qualityOptions = useMemo(() => {
    return playerInfo ? buildQualityLadder(playerInfo) : []
  }, [playerInfo])

  const activeQuality = useMemo(() => {
    return qualityOptions.find((q) => q.id === selectedQualityId) || qualityOptions[0] || null
  }, [qualityOptions, selectedQualityId])

  const prevQualityIdRef = useRef<string>(selectedQualityId)
  useEffect(() => {
    if (prevQualityIdRef.current !== selectedQualityId) {
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      prevQualityIdRef.current = selectedQualityId
    }
  }, [selectedQualityId])

  const handleQualityChange = useCallback((preset: QualityPreset) => {
    setSelectedQualityId(preset.id)
    setShowQualityMenu(false)
    try {
      localStorage.setItem('cineclaw_player_quality', preset.id)
    } catch {}
    setQualityToast(`Качество: ${preset.shortLabel}`)
    setTimeout(() => setQualityToast(null), 2500)
  }, [])

  // Double tap animation indicators
  const [tapRipple, setTapRipple] = useState<'left' | 'right' | null>(null)

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReportedTimeRef = useRef<number>(0)
  const currentItemRef = useRef<{ id: string; mediaSourceId?: string; time: number }>({
    id: '',
    time: 0,
  })
  const prevItemIdRef = useRef<string>('')

  // 30-Second Buffering Stall Detection & Alternate Torrent Selector
  const [showStallPrompt, setShowStallPrompt] = useState<boolean>(false)
  const [showAlternateModal, setShowAlternateModal] = useState<boolean>(false)
  const [isMountingAlternate, setIsMountingAlternate] = useState<boolean>(false)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resume Playback Prompt Dialog
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(false)
  const resumeDecisionMadeRef = useRef<boolean>(false)

  // Fetch available torrents for this title and current season
  const { data: rawTorrents, isLoading: isLoadingTorrents } = useGetTorrentsQuery(
    { imdb_id: tconst, season: currentSeason },
    { skip: !tconst }
  )
  const [mountTorrent] = useMountTorrentMutation()

  // Strict sorting by seeds descending for alternate torrent picker
  const sortedTorrentsBySeeds = useMemo(() => {
    if (!rawTorrents || rawTorrents.length === 0) return []
    let list = [...rawTorrents]

    if (currentSeason !== undefined && currentSeason > 0) {
      const seasonMatches = list.filter((t) => {
        const seasons = t.seasons || []
        return seasons.includes(currentSeason) || seasons.length === 0 || t.is_complete
      })
      if (seasonMatches.length > 0) {
        list = seasonMatches
      }
    }

    return list.sort((a, b) => (b.seeds || 0) - (a.seeds || 0))
  }, [rawTorrents, currentSeason])

  // Track continuous buffering / waiting time (trigger prompt after 30s)
  useEffect(() => {
    // If playing smoothly and not buffering, reset timer & prompt
    if (isPlaying && !isBuffering && !isSyncingWithJellyfin) {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      setShowStallPrompt(false)
      return
    }

    // If waiting/buffering/syncing, start 30s countdown
    if ((isBuffering || isSyncingWithJellyfin) && !showStallPrompt) {
      if (!stallTimerRef.current) {
        stallTimerRef.current = setTimeout(() => {
          setShowStallPrompt(true)
        }, 30000)
      }
    }

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
  }, [isPlaying, isBuffering, isSyncingWithJellyfin, showStallPrompt])

  const handleSelectAlternateTorrent = async (torrent: TorrentResult) => {
    setIsMountingAlternate(true)
    setShowStallPrompt(false)
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    try {
      await mountTorrent({
        tconst,
        title,
        ru_title: ruTitle,
        type: currentSeason !== undefined ? 'tvSeries' : 'movie',
        season: currentSeason,
        magnet: torrent.magnet,
        tracker: torrent.tracker || (torrent.trackers && torrent.trackers[0]),
        torrent_id: torrent.id,
        details_url: torrent.details_url,
        mode: 'add_version',
        version_name: classifyResolution(torrent).toUpperCase(),
        resolution: torrent.resolution,
      }).unwrap()

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }
      setIsBuffering(true)
      setIsPlaying(false)
      setShowAlternateModal(false)
      setSyncRetryCount(0)
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      await refetch()
    } catch (err) {
      console.error('Failed to mount alternate torrent:', err)
    } finally {
      setIsMountingAlternate(false)
    }
  }

  const handleClosePlayer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    const cur = currentItemRef.current
    const video = videoRef.current
    let liveTime = video && !isNaN(video.currentTime) && video.currentTime > 0 ? video.currentTime : (cur.time || currentTime)
    if (!resumeDecisionMadeRef.current && (playerInfo?.resume_seconds ?? 0) > 15 && liveTime <= 5) {
      liveTime = playerInfo!.resume_seconds!
    }
    const isFinished = duration > 0 && liveTime >= (duration - 30)
    if (cur.id) {
      reportStop({
        item_id: cur.id,
        media_source_id: cur.mediaSourceId,
        position_seconds: liveTime,
        close_player: true,
        is_played: isFinished,
      })
    }
    onClose()
  }, [reportStop, onClose, currentTime, duration, playerInfo?.resume_seconds])

  // Keep ref updated for unload/stop reporting
  useEffect(() => {
    if (playerInfo?.item_id) {
      currentItemRef.current = {
        id: playerInfo.item_id,
        mediaSourceId: playerInfo.media_source_id,
        time: currentTime > 0 ? currentTime : (!resumeDecisionMadeRef.current && (playerInfo.resume_seconds ?? 0) > 15 ? playerInfo.resume_seconds! : 0),
      }
    }
  }, [playerInfo?.item_id, playerInfo?.media_source_id, playerInfo?.resume_seconds, currentTime])

  // Initialize Audio & Subtitle Defaults
  useEffect(() => {
    if (playerInfo?.audio_tracks && playerInfo.audio_tracks.length > 0 && selectedAudioIndex === null) {
      const defAudio = playerInfo.audio_tracks.find((a) => a.is_default) || playerInfo.audio_tracks[0]
      setSelectedAudioIndex(defAudio.index)
    }
  }, [playerInfo?.audio_tracks, selectedAudioIndex])

  // Unique playSessionId for Jellyfin transcoding worker coordination
  const playSessionIdRef = useRef<string>(
    Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
  )
  const prevAudioIndexRef = useRef<number | null>(selectedAudioIndex)
  useEffect(() => {
    if (prevAudioIndexRef.current !== null && prevAudioIndexRef.current !== selectedAudioIndex) {
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
    }
    prevAudioIndexRef.current = selectedAudioIndex
  }, [selectedAudioIndex])

  // Reset controls hide timer on activity
  const handleUserActivity = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (
        !showAudioMenu &&
        !showSubtitleMenu &&
        !showSpeedMenu &&
        !showQualityMenu &&
        !showEpisodesDrawer &&
        !showExternalMenu &&
        isPlaying
      ) {
        setShowControls(false)
      }
    }, 3200)
  }, [
    showAudioMenu,
    showSubtitleMenu,
    showSpeedMenu,
    showQualityMenu,
    showEpisodesDrawer,
    showExternalMenu,
    isPlaying,
  ])

  // Resolve direct stream URL for external players (VLC, IINA, Infuse)
  const getDirectStreamUrl = useCallback(() => {
    if (!playerInfo?.media_source_id) return ''
    const host = window.location.hostname || 'localhost'
    const match = playerInfo.stream_url?.match(/index=(\d+)/)
    const index = match ? match[1] : '0'
    return `http://${host}:8092/stream?link=${playerInfo.media_source_id}&index=${index}&play`
  }, [playerInfo])

  // External player launcher and link copier
  const handleOpenExternal = useCallback(
    (player: 'vlc' | 'iina' | 'infuse' | 'copy') => {
      const directUrl = getDirectStreamUrl()
      if (!directUrl) return

      if (player === 'vlc') {
        window.location.href = `vlc://${directUrl}`
      } else if (player === 'iina') {
        window.location.href = `iina://weblink?url=${encodeURIComponent(directUrl)}`
      } else if (player === 'infuse') {
        window.location.href = `infuse://x-callback-url/play?url=${encodeURIComponent(directUrl)}`
      } else if (player === 'copy') {
        navigator.clipboard.writeText(directUrl)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      }
      setShowExternalMenu(false)
    },
    [getDirectStreamUrl]
  )

  // HLS stream construction helper with selected audio track, quality preset & session binding
  const buildStreamUrl = useCallback(
    (info: PlayerInfoResponse, audioIdx: number | null, sessionId: string, quality: QualityPreset | null) => {
      if (!info.stream_url) return ''
      let url = info.stream_url

      // TorrServer GStreamer HLS stream (/torr/gst/...)
      if (url.includes('/torr/gst/') || url.includes('/gst/')) {
        if (audioIdx !== null) {
          if (url.includes('audio=')) {
            url = url.replace(/audio=\d+/, `audio=${audioIdx}`)
          } else {
            url += (url.includes('?') ? '&' : '?') + `audio=${audioIdx}`
          }
        }
        return url
      }

      // Direct stream / non-HLS stream
      if (url.includes('/torr/') || !url.includes('.m3u8')) {
        return url
      }

      // Strip existing parameters to apply user choice cleanly (Legacy Jellyfin fallback)
      url = url.replace(/&?EnableAutoStreamCopy=[^&]*/g, '')
      url = url.replace(/&?VideoBitRate=[^&]*/g, '')
      url = url.replace(/&?AudioBitRate=[^&]*/g, '')
      url = url.replace(/&?MaxWidth=[^&]*/g, '')
      url = url.replace(/&?MaxHeight=[^&]*/g, '')

      if (quality) {
        if (quality.isOriginal) {
          // Direct Stream copy for native formats (H.264/AAC), high-bitrate transcode otherwise
          url += `&EnableAutoStreamCopy=true`
          if (quality.videoBitrate) {
            url += `&VideoBitRate=${quality.videoBitrate}`
          }
          if (quality.audioBitrate) {
            url += `&AudioBitRate=${quality.audioBitrate}`
          }
        } else {
          // Explicit bitrate preset / resolution ladder downscale
          url += `&EnableAutoStreamCopy=false`
          if (quality.videoBitrate) {
            url += `&VideoBitRate=${quality.videoBitrate}`
          }
          if (quality.audioBitrate) {
            url += `&AudioBitRate=${quality.audioBitrate}`
          }
          if (quality.width) {
            url += `&MaxWidth=${quality.width}`
          }
          if (quality.height) {
            url += `&MaxHeight=${quality.height}`
          }
        }
      } else {
        url += `&EnableAutoStreamCopy=true&VideoBitRate=35000000&AudioBitRate=384000`
      }

      if (!url.includes('VideoCodec=')) {
        url += '&VideoCodec=h264'
      }
      if (!url.includes('AudioCodec=')) {
        url += '&AudioCodec=aac'
      }
      if (!url.includes('TranscodingMaxAudioChannels=')) {
        url += '&TranscodingMaxAudioChannels=2'
      }
      if (!url.includes('SegmentContainer=')) {
        url += '&SegmentContainer=mp4'
      }
      if (!url.includes('MinSegments=')) {
        url += '&MinSegments=2'
      }
      if (!url.includes('BreakOnNonKeyFrames=')) {
        url += '&BreakOnNonKeyFrames=True'
      }
      if (!url.includes('PlaySessionId=')) {
        url += `&PlaySessionId=${sessionId}`
      }
      if (audioIdx !== null && !url.includes('AudioStreamIndex=')) {
        url += `&AudioStreamIndex=${audioIdx}`
      }
      return url
    },
    []
  )

  // Load and Attach HLS Stream
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playerInfo?.item_id || !playerInfo.success) return

    const isNewEpisode = prevItemIdRef.current !== playerInfo.item_id
    if (isNewEpisode) {
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      prevItemIdRef.current = playerInfo.item_id
    }

    const streamUrl = buildStreamUrl(playerInfo, selectedAudioIndex, playSessionIdRef.current, activeQuality)
    if (!streamUrl) return

    setIsBuffering(true)

    const hasResume = !!(
      isNewEpisode &&
      playerInfo.resume_seconds &&
      playerInfo.resume_seconds > 15 &&
      !playerInfo.is_played &&
      playerInfo.resume_seconds < ((playerInfo.duration_seconds || 999999) - 30)
    )

    if (hasResume && !resumeDecisionMadeRef.current) {
      setShowResumePrompt(true)
    }

    // Determine seek time: if it's a newly switched episode and resume decision hasn't been made,
    // wait for user choice. If decision already made or no resume point, start as normal.
    const targetSeekTime = isNewEpisode
      ? (resumeDecisionMadeRef.current && playerInfo.resume_seconds && !playerInfo.is_played ? playerInfo.resume_seconds : 0)
      : (video.currentTime || 0)

    const isHls = streamUrl.includes('.m3u8')

    if (!isHls) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      video.pause()
      video.src = streamUrl
      video.load()

      const handleLoadedMetadata = () => {
        setIsBuffering(false)
        if (hasResume && !resumeDecisionMadeRef.current) {
          video.pause()
          setIsPlaying(false)
        } else {
          if (targetSeekTime > 0) {
            video.currentTime = targetSeekTime
          }
          video.play().then(() => {
            setIsPlaying(true)
          }).catch(() => {
            setIsPlaying(false)
          })
        }
      }
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    } else if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      video.pause()

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
        if (hasResume && !resumeDecisionMadeRef.current) {
          video.pause()
          setIsPlaying(false)
        } else {
          if (targetSeekTime > 0) {
            video.currentTime = targetSeekTime
          }
          video.play().then(() => {
            setIsPlaying(true)
          }).catch(() => {
            setIsPlaying(false)
          })
        }
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
      video.pause()
      video.src = streamUrl
      video.load()
      const handleLoadedMetadata = () => {
        setIsBuffering(false)
        if (hasResume && !resumeDecisionMadeRef.current) {
          video.pause()
          setIsPlaying(false)
        } else {
          if (targetSeekTime > 0) {
            video.currentTime = targetSeekTime
          }
          video.play().then(() => {
            setIsPlaying(true)
          }).catch(() => {
            setIsPlaying(false)
          })
        }
      }
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }

    // Report playback start if not waiting for resume prompt
    if (!hasResume || resumeDecisionMadeRef.current) {
      reportStart({
        item_id: playerInfo.item_id,
        media_source_id: playerInfo.media_source_id,
        audio_stream_index: selectedAudioIndex ?? undefined,
        position_seconds: targetSeekTime,
      })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [playerInfo?.item_id, selectedAudioIndex, activeQuality, buildStreamUrl, reportStart])

  const handleConfirmResume = () => {
    resumeDecisionMadeRef.current = true
    setShowResumePrompt(false)
    const video = videoRef.current
    if (!video) return
    const target = playerInfo?.resume_seconds || 0
    if (target > 0) {
      video.currentTime = target
    }
    video.play().then(() => {
      setIsPlaying(true)
    }).catch(() => {
      setIsPlaying(false)
    })
    reportStart({
      item_id: playerInfo?.item_id || '',
      media_source_id: playerInfo?.media_source_id,
      audio_stream_index: selectedAudioIndex ?? undefined,
      position_seconds: target,
    })
  }

  const handleStartFromBeginning = () => {
    resumeDecisionMadeRef.current = true
    setShowResumePrompt(false)
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play().then(() => {
      setIsPlaying(true)
    }).catch(() => {
      setIsPlaying(false)
    })
    reportProgress({
      item_id: playerInfo?.item_id || '',
      media_source_id: playerInfo?.media_source_id,
      position_seconds: 0,
      duration_seconds: duration || playerInfo?.duration_seconds,
      is_paused: false,
      event: 'seek',
    })
  }

  // Stop reporting on unmount or page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const cur = currentItemRef.current
      if (cur.id) {
        reportStop({
          item_id: cur.id,
          media_source_id: cur.mediaSourceId,
          position_seconds: cur.time,
          duration_seconds: duration,
          close_player: true,
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
          duration_seconds: duration,
          close_player: true,
        })
      }
    }
  }, [reportStop, duration])

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
          duration_seconds: duration || video.duration,
          is_paused: false,
          event: 'timeupdate',
        })
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isPlaying, playerInfo?.item_id, playerInfo?.media_source_id, duration, reportProgress])

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
        duration_seconds: duration || video.duration,
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
        duration_seconds: duration || video.duration,
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
      duration_seconds: duration || video.duration,
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

  const handleSelectEpisode = (ep: EpisodeInfo) => {
    if (ep.id === playerInfo?.item_id) {
      setShowEpisodesDrawer(false)
      return
    }
    const cur = currentItemRef.current
    if (cur.id) {
      reportStop({
        item_id: cur.id,
        media_source_id: cur.mediaSourceId,
        position_seconds: cur.time,
        close_player: false,
      })
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
    setShowEpisodesDrawer(false)
    setShowStallPrompt(false)
    setShowResumePrompt(false)
    resumeDecisionMadeRef.current = false
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    setIsBuffering(true)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBufferedEnd(0)
    setSelectedAudioIndex(null)
    setSelectedSubtitleIndex(null)
    playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
    setCurrentSeason(ep.season_number)
    setCurrentEpisode(ep.episode_number)
  }

  const handlePlayNextEpisode = () => {
    if (playerInfo?.next_episode) {
      setNextEpisodePrompt(false)
      handleSelectEpisode(playerInfo.next_episode)
    }
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
          else if (showQualityMenu) setShowQualityMenu(false)
          else if (showAudioMenu) setShowAudioMenu(false)
          else if (showSubtitleMenu) setShowSubtitleMenu(false)
          else if (showSpeedMenu) setShowSpeedMenu(false)
          else handleClosePlayer()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, handleSkip, handleVolumeChange, toggleFullscreen, toggleMute, volume, showEpisodesDrawer, showQualityMenu, showAudioMenu, showSubtitleMenu, showSpeedMenu, handleClosePlayer, handleUserActivity])

  // Progress Bar Scrubber Calculation
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return createPortal(
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none overflow-hidden"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Video Element */}
      <video
        key={`video-${tconst}-${currentSeason ?? 0}-${currentEpisode ?? 0}`}
        ref={videoRef}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false)
          const cur = currentItemRef.current
          if (cur.id) {
            reportStop({
              item_id: cur.id,
              media_source_id: cur.mediaSourceId,
              position_seconds: duration,
              duration_seconds: duration,
              close_player: false,
              is_played: true,
            })
          }
          if (playerInfo?.has_next_episode && playerInfo.next_episode) {
            setNextEpisodePrompt(true)
          }
        }}
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

      {/* Syncing / Scanning State */}
      {isSyncingWithJellyfin && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-20 text-center px-4">
          <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
          <p className="mt-4 text-base text-zinc-200 font-medium">Подключение к торрент-потоку...</p>
          <p className="mt-1 text-xs text-zinc-400">TorrServer получает метаданные и буферизирует пиры (попытка {syncRetryCount + 1}/10)</p>
        </div>
      )}

      {/* Error State */}
      {isErrorState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 z-50 text-center pointer-events-auto">
          <div className="p-3 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-3">
            <X className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Не удалось запустить воспроизведение</h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            {playerInfo?.error || 'Ошибка связи со стриминг-сервером TorrServer. Проверьте раздачу.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 relative z-50 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSyncRetryCount(0)
                refetch()
              }}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <RotateCw className="w-4 h-4" />
              Повторить
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowAlternateModal(true)
              }}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-sm font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Zap className="w-4 h-4 fill-current" />
              Выбрать по сидам
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClosePlayer()
              }}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-sm font-semibold transition cursor-pointer shadow-lg"
            >
              Вернуться назад
            </button>
          </div>
        </div>
      )}

      {/* Resume Playback Interactive Prompt Modal */}
      {showResumePrompt && playerInfo && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 pointer-events-auto animate-fade-in">
          <div className="bg-zinc-950 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="p-3.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <RotateCcw className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                Продолжить просмотр?
              </h3>
              <p className="text-xs text-zinc-400">
                {playerInfo.ru_title || ruTitle || title}
                {playerInfo.media_type === 'Episode' && playerInfo.title && (
                  <span className="block text-emerald-400 font-medium mt-0.5">
                    {playerInfo.title}
                  </span>
                )}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 w-full flex items-center justify-between text-xs">
              <span className="text-zinc-400">Остановлено на:</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                {formatTime(playerInfo.resume_seconds)}
                <span className="text-zinc-500 text-xs font-normal ml-1">
                  / {formatTime(playerInfo.duration_seconds || duration)}
                </span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full mt-1">
              <button
                autoFocus
                onClick={handleConfirmResume}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Продолжить с {formatTime(playerInfo.resume_seconds)}</span>
              </button>
              <button
                onClick={handleStartFromBeginning}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-sm transition border border-white/10 active:scale-95 shrink-0"
              >
                С начала
              </button>
            </div>
          </div>
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
              Сезон {playerInfo.next_episode.season_number}, серия {playerInfo.next_episode.episode_number}
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

      {/* Quality Toast Notification */}
      {qualityToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-zinc-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-2xl pointer-events-none flex items-center gap-2 animate-fade-in">
          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
          <span>{qualityToast}</span>
        </div>
      )}

      {/* Cinema Controls Overlay */}
      {!isErrorState && (
        <div
          className={`absolute inset-0 flex flex-col justify-between p-4 md:p-6 bg-gradient-to-t from-black/85 via-transparent to-black/70 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4 pointer-events-auto z-20">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-extrabold text-white truncate drop-shadow-md">
              {playerInfo?.ru_title || ruTitle || title}
            </h2>
            {playerInfo?.media_type === 'Episode' && playerInfo.title && (
              <p className="text-xs md:text-sm text-emerald-400 font-semibold truncate drop-shadow-sm">
                {playerInfo.title}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAlternateModal(true)}
              className="p-2 md:px-3.5 py-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition border border-white/10 backdrop-blur-md flex items-center gap-1.5"
              title="Сменить раздачу (выбрать по сидам)"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span className="text-xs font-semibold hidden sm:inline">Сменить раздачу</span>
            </button>

            {/* External Players Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExternalMenu(!showExternalMenu)}
                className="p-2 md:px-3.5 py-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-white/10 backdrop-blur-md flex items-center gap-1.5"
                title="Открыть во внешнем плеере"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="text-xs font-semibold hidden sm:inline">Внешний плеер</span>
              </button>

              {showExternalMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-zinc-900/95 border border-white/15 p-2 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Открыть в приложении
                  </div>
                  <button
                    onClick={() => handleOpenExternal('vlc')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                  >
                    <span className="text-amber-400 text-base">🟠</span> VLC Player
                  </button>
                  <button
                    onClick={() => handleOpenExternal('iina')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                  >
                    <span className="text-sky-400 text-base">🔵</span> IINA (macOS)
                  </button>
                  <button
                    onClick={() => handleOpenExternal('infuse')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                  >
                    <span className="text-orange-500 text-base">🔥</span> Infuse (Apple TV / iOS)
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button
                    onClick={() => handleOpenExternal('copy')}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition text-left"
                  >
                    <Copy className="h-4 w-4" />
                    <span>{copiedLink ? 'Ссылка скопирована!' : 'Скопировать поток'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleClosePlayer}
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
                  onClick={() => {
                    setShowEpisodesDrawer(!showEpisodesDrawer)
                    setShowAudioMenu(false)
                    setShowSubtitleMenu(false)
                    setShowSpeedMenu(false)
                    setShowQualityMenu(false)
                  }}
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
                      setShowQualityMenu(false)
                      setShowEpisodesDrawer(false)
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
                      setShowQualityMenu(false)
                      setShowEpisodesDrawer(false)
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

              {/* Quality Dropdown */}
              {qualityOptions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu)
                      setShowAudioMenu(false)
                      setShowSubtitleMenu(false)
                      setShowSpeedMenu(false)
                      setShowEpisodesDrawer(false)
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                      showQualityMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Качество видео"
                  >
                    <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="text-[11px] md:text-xs">
                      {activeQuality ? activeQuality.shortLabel : 'Качество'}
                    </span>
                  </button>

                  {showQualityMenu && (
                    <div className="absolute bottom-12 right-0 w-64 md:w-72 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                        <span>Качество видео</span>
                        {playerInfo?.video_codec && (
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded uppercase">
                            {playerInfo.video_codec}
                          </span>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto mt-1 space-y-1">
                        {qualityOptions.map((preset) => {
                          const isSelected = activeQuality?.id === preset.id
                          return (
                            <button
                              key={preset.id}
                              onClick={() => handleQualityChange(preset)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                  : 'hover:bg-white/10 text-zinc-300'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">{preset.label}</span>
                                  {preset.isOriginal && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                      Direct
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                                  {preset.description}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                              )}
                            </button>
                          )
                        })}
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
                    setShowQualityMenu(false)
                    setShowEpisodesDrawer(false)
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
      )}

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
                      Сезон {ep.season_number} · Серия {ep.episode_number}
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

      {/* 30-Second Buffering Stall Notification Prompt */}
      {showStallPrompt && !showAlternateModal && (
        <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-amber-500/50 backdrop-blur-xl shadow-2xl max-w-md w-[92%] flex flex-col gap-3 animate-fade-in pointer-events-auto">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Долгая буферизация (&gt;30 сек)
              </div>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                Похоже, текущая раздача медленно отдает данные. Хотите переключиться на раздачу с максимальным количеством сидов?
              </p>
            </div>
            <button
              onClick={() => setShowStallPrompt(false)}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => {
                setShowStallPrompt(false)
                if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
                stallTimerRef.current = setTimeout(() => {
                  setShowStallPrompt(true)
                }, 30000)
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
            >
              Подождать
            </button>
            {activeQuality && (activeQuality.isOriginal || (activeQuality.videoBitrate && activeQuality.videoBitrate > 3500000)) && (
              <button
                onClick={() => {
                  setShowStallPrompt(false)
                  const webPreset = qualityOptions.find((q) => q.id === '1080p_std') || qualityOptions.find((q) => q.id === '720p')
                  if (webPreset) {
                    handleQualityChange(webPreset)
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold transition flex items-center gap-1 active:scale-95 shadow-md"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Снизить битрейт (3.5 Мбит/с)
              </button>
            )}
            <button
              onClick={() => {
                setShowStallPrompt(false)
                setShowAlternateModal(true)
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              Выбрать по сидам ({sortedTorrentsBySeeds.length})
            </button>
          </div>
        </div>
      )}

      {/* Alternate Torrent Selector Modal (Sorted by Seeds) */}
      {showAlternateModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 pointer-events-auto animate-fade-in">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl md:rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Выбор раздачи по сидам</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                      {sortedTorrentsBySeeds.length}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {currentSeason !== undefined ? `Сезон ${currentSeason} · ` : ''}Сортировка строго по количеству активных сидов
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAlternateModal(false)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5">
              {isLoadingTorrents ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="h-8 w-8 text-amber-400 animate-spin mb-3" />
                  <span className="text-sm text-zinc-400">Поиск доступных раздач...</span>
                </div>
              ) : sortedTorrentsBySeeds.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-sm">
                  Раздачи не найдены
                </div>
              ) : (
                sortedTorrentsBySeeds.map((torrent) => {
                  const audioTag = extractAudioLabel(torrent.title || '')
                  const res = classifyResolution(torrent).toUpperCase()
                  const isDead = (torrent.seeds || 0) === 0
                  return (
                    <div
                      key={torrent.id || torrent.magnet}
                      className="p-3.5 rounded-2xl bg-zinc-900/70 border border-white/5 hover:border-amber-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              res === '4K'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : res === '1080P'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {res}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            🌱 {torrent.seeds || 0} сидов
                          </span>
                          {torrent.leeches !== undefined && torrent.leeches > 0 && (
                            <span className="text-[11px] text-zinc-400 font-mono">
                              📥 {torrent.leeches}
                            </span>
                          )}
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatBytes(torrent.size || 0)}
                          </span>
                          {torrent.tracker && (
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                              {torrent.tracker}
                            </span>
                          )}
                          {audioTag && (
                            <span className="text-[10px] text-cyan-400/90 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
                              {audioTag}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-xs text-zinc-200 line-clamp-2 leading-relaxed"
                          title={torrent.title}
                        >
                          {torrent.title}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-end sm:justify-center">
                        <button
                          disabled={isMountingAlternate || isDead}
                          onClick={() => handleSelectAlternateTorrent(torrent)}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-md"
                        >
                          {isMountingAlternate ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Монтирование...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Смотреть</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
