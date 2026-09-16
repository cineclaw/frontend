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
  ChevronDown,
  ChevronUp,
  Gauge,
  Zap,
  SlidersHorizontal,
  ExternalLink,
  Copy,
  Cpu,
  WifiOff,
  SignalZero,
  RefreshCw,
  FastForward,
} from 'lucide-react'
import {
  useGetPlayerInfoQuery,
  useReportPlayerStartMutation,
  useReportPlayerProgressMutation,
  useReportPlayerStopMutation,
  useSetAudioPreferenceMutation,
  useStopTranscodingMutation,
  useGetTorrentsQuery,
  useMountTorrentMutation,
  useGetStreamStatsQuery,
  torrentsApi,
  type AudioTrack,
  type SubtitleTrack,
  type EpisodeInfo,
  type PlayerInfoResponse,
  type TranscodeProfile,
  type TorrentResult,
} from '@/api/torrentsApi'
import { useAppDispatch } from '@/store/store'
import {
  getLocalPlayback,
  saveLocalPlayback,
  resolveEffectiveResumeTime,
} from '@/lib/playbackProgress'
import { replaceRoute } from '@/lib/router'

const defaultTranscodeProfiles: TranscodeProfile[] = [
  {
    id: 'direct',
    label: '⚡ Исходный (HLS Remux)',
    description: 'Прямой поток / Remux HLS (максимальное качество, все аудиодорожки)',
    max_height: 0,
    bitrate_kbps: 0,
    maxrate_kbps: 0,
    bufsize_kbps: 0,
    audio_kbps: 0,
    is_direct: true,
  },
  {
    id: 'http_direct',
    label: '🚀 Прямой HTTP (без сегментов)',
    description: 'Прямой Range-поток TorrServer напрямую в HTML5 <video> (как в TorrServer web)',
    max_height: 0,
    bitrate_kbps: 0,
    maxrate_kbps: 0,
    bufsize_kbps: 0,
    audio_kbps: 0,
    is_direct: true,
  },
  {
    id: '1080p',
    label: '📱 1080p Full HD (6 Мбит/с)',
    description: 'Для скоростного Wi-Fi и больших экранов',
    max_height: 1080,
    bitrate_kbps: 6000,
    maxrate_kbps: 6500,
    bufsize_kbps: 12000,
    audio_kbps: 192,
    is_direct: false,
  },
  {
    id: '720p',
    label: '📱 720p HD (3 Мбит/с)',
    description: 'Рекомендуется для мобильного интернета (LTE/5G)',
    max_height: 720,
    bitrate_kbps: 2800,
    maxrate_kbps: 3200,
    bufsize_kbps: 6000,
    audio_kbps: 128,
    is_direct: false,
  },
  {
    id: '480p',
    label: '📶 480p SD (1.4 Мбит/с)',
    description: 'Экономия трафика при слабом сигнале',
    max_height: 480,
    bitrate_kbps: 1300,
    maxrate_kbps: 1600,
    bufsize_kbps: 3000,
    audio_kbps: 96,
    is_direct: false,
  },
  {
    id: '360p',
    label: '🔋 360p Эконом (700 Кбит/с)',
    description: 'Минимальный битрейт для роуминга или 3G',
    max_height: 360,
    bitrate_kbps: 600,
    maxrate_kbps: 800,
    bufsize_kbps: 1500,
    audio_kbps: 64,
    is_direct: false,
  },
]
import {
  classifyResolution,
  extractAudioLabel,
  buildTorrentQualityOptions,
  getTorrentHash,
  type TorrentQualityOption,
  type QualityTier,
} from '@/lib/torrentSelector'
import { formatBytes } from '@/lib/utils'

interface CinemaPlayerModalProps {
  tconst: string
  title: string
  ruTitle?: string
  initialSeason?: number
  initialEpisode?: number
  autoResume?: boolean
  onClose: () => void
}

function getPluralVariants(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 19) return 'вариантов'
  if (mod10 === 1) return 'вариант'
  if (mod10 >= 2 && mod10 <= 4) return 'варианта'
  return 'вариантов'
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

function formatCodec(codec?: string): string {
  if (!codec) return ''
  const c = codec.toLowerCase()
  if (c.includes('h264') || c.includes('avc')) return 'H.264'
  if (c.includes('h265') || c.includes('hevc')) return 'HEVC'
  if (c.includes('av1')) return 'AV1'
  if (c.includes('vp9')) return 'VP9'
  if (c.includes('mpeg4') || c.includes('xvid')) return 'MPEG-4'
  const first = codec.split(',')[0].trim()
  return first.replace(/^(video|audio)\/x-/, '').toUpperCase()
}

export const CinemaPlayerModal: React.FC<CinemaPlayerModalProps> = ({
  tconst,
  title,
  ruTitle,
  initialSeason,
  initialEpisode,
  autoResume,
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

  // Auto-retry polling if TorrServer is still probing metadata or buffering peers
  const [syncRetryCount, setSyncRetryCount] = useState<number>(0)
  const isPreparingStream = Boolean(
    !isLoading &&
    playerInfo &&
    !playerInfo.success &&
    (playerInfo.error?.includes('метадан') ||
     playerInfo.error?.includes('подключен') ||
     playerInfo.error?.includes('сканирует') ||
     playerInfo.error?.includes('серий') ||
     playerInfo.error?.includes('Сезон') ||
     playerInfo.error?.includes('смонтирован') ||
     playerInfo.error?.includes('поиск') ||
     playerInfo.error?.includes('подготовк') ||
     playerInfo.error?.includes('пирам')) &&
    syncRetryCount < 30
  )
  const isErrorState = Boolean(!isPreparingStream && (error || (playerInfo && !playerInfo.success)))

  useEffect(() => {
    if (isPreparingStream) {
      const timer = setTimeout(() => {
        setSyncRetryCount((prev) => prev + 1)
        refetch()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isPreparingStream, refetch])

  const [reportStart] = useReportPlayerStartMutation()
  const [reportProgress] = useReportPlayerProgressMutation()
  const [reportStop] = useReportPlayerStopMutation()
  const [setAudioPreference] = useSetAudioPreferenceMutation()
  const dispatch = useAppDispatch()

  const lastSavedLocalTimeRef = useRef<number>(0)

  // Keep URL updated with active season & episode
  useEffect(() => {
    if (!tconst) return
    replaceRoute({
      type: 'watch',
      tconst,
      season: currentSeason,
      episode: currentEpisode,
      autoResume: true,
    })
  }, [tconst, currentSeason, currentEpisode])

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
  const [expandedQualityTier, setExpandedQualityTier] = useState<QualityTier | null>(null)
  const [showTranscodeMenu, setShowTranscodeMenu] = useState<boolean>(false)
  const [selectedTranscodeProfile, setSelectedTranscodeProfile] = useState<string>(() => {
    return localStorage.getItem('cineclaw_transcode_profile') || 'direct'
  })
  const [stopTranscoding] = useStopTranscodingMutation()
  const [showExternalMenu, setShowExternalMenu] = useState<boolean>(false)
  const [showStatsTooltip, setShowStatsTooltip] = useState<boolean>(false)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)
  const [qualityToast, setQualityToast] = useState<string | null>(null)
  const [nextEpisodePrompt, setNextEpisodePrompt] = useState<boolean>(false)
  const [nextCountdown, setNextCountdown] = useState<number>(10)

  // Real-time Swarm & Stream Speed Polling (every 3 seconds during playback)
  const { data: streamStats } = useGetStreamStatsQuery(
    {
      hash: playerInfo?.media_source_id,
      tconst,
      season: currentSeason,
      episode: currentEpisode,
      duration: duration || playerInfo?.duration_seconds,
    },
    {
      pollingInterval: isPlaying || isBuffering ? 3000 : 0,
      skip: !tconst && !playerInfo?.media_source_id,
    }
  )

  // Network Auto-Recovery & Offline States
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0)
  const [isConnectionExhausted, setIsConnectionExhausted] = useState<boolean>(false)
  const [isNetworkOffline, setIsNetworkOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false
  })
  const [reconnectNonce, setReconnectNonce] = useState<number>(0)
  const [showLowBandwidthPrompt, setShowLowBandwidthPrompt] = useState<boolean>(false)
  const recentStallsRef = useRef<number[]>([])

  const closeAllMenus = useCallback(() => {
    setShowQualityMenu(false)
    setShowTranscodeMenu(false)
    setShowAudioMenu(false)
    setShowSubtitleMenu(false)
    setShowSpeedMenu(false)
    setShowExternalMenu(false)
    setShowStatsTooltip(false)
  }, [])

  const closeAllMenusExcept = useCallback(
    (menu: 'quality' | 'transcode' | 'audio' | 'subtitles' | 'speed' | 'episodes' | 'external') => {
      if (menu !== 'quality') setShowQualityMenu(false)
      if (menu !== 'transcode') setShowTranscodeMenu(false)
      if (menu !== 'audio') setShowAudioMenu(false)
      if (menu !== 'subtitles') setShowSubtitleMenu(false)
      if (menu !== 'speed') setShowSpeedMenu(false)
      if (menu !== 'episodes') setShowEpisodesDrawer(false)
      if (menu !== 'external') setShowExternalMenu(false)
    },
    []
  )

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 })
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Seamless quality switching & seek preservation states and refs
  const pendingSeekTimeRef = useRef<number | null>(null)
  const seekTargetRef = useRef<number | null>(null)
  const wasPlayingBeforeSwitchRef = useRef<boolean>(true)
  const streamRetryCountRef = useRef<number>(0)
  const [isSwitchingQuality, setIsSwitchingQuality] = useState<boolean>(false)
  const [switchingQualityTarget, setSwitchingQualityTarget] = useState<string | null>(null)
  const [targetSeekTimeDisplay, setTargetSeekTimeDisplay] = useState<string | null>(null)

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
  const [resumeDecisionNonce, setResumeDecisionNonce] = useState<number>(0)

  // Fetch available torrents for this title and current season
  const { currentData: rawTorrents, isLoading: isLoadingTorrents } = useGetTorrentsQuery(
    {
      q: ruTitle || title,
      imdb_id: tconst,
      season: currentSeason,
      type: currentSeason !== undefined ? 'tv' : 'movie',
      limit: 100,
    },
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

  // Compute effective duration & episodes count for accurate torrent bitrate approximation
  const effectiveDuration = useMemo(() => {
    if (playerInfo?.duration_seconds && playerInfo.duration_seconds > 0) {
      return playerInfo.duration_seconds
    }
    if (duration && duration > 0) {
      return duration
    }
    return currentSeason !== undefined ? 2700 : 6300
  }, [playerInfo?.duration_seconds, duration, currentSeason])

  const episodesCount = useMemo(() => {
    return Math.max(1, playerInfo?.episodes?.length || 1)
  }, [playerInfo?.episodes])

  // Available torrent quality options with calculated bitrates
  const qualityTorrentOptions = useMemo<TorrentQualityOption[]>(() => {
    return buildTorrentQualityOptions(
      sortedTorrentsBySeeds,
      playerInfo?.media_source_id || '',
      effectiveDuration,
      currentSeason !== undefined || playerInfo?.media_type === 'Episode',
      episodesCount
    )
  }, [
    sortedTorrentsBySeeds,
    playerInfo?.media_source_id,
    effectiveDuration,
    currentSeason,
    playerInfo?.media_type,
    episodesCount,
  ])

  // Active torrent option
  const activeTorrentOption = useMemo(() => {
    return qualityTorrentOptions.find((o) => o.isActive) || null
  }, [qualityTorrentOptions])

  // Group quality options by tier (4K, 1080p, 720p, SD)
  const groupedQualityOptions = useMemo(() => {
    const groups: {
      tier: QualityTier
      title: string
      badge: string
      badgeColor: string
      options: TorrentQualityOption[]
    }[] = [
      {
        tier: '4k',
        title: '4K Ultra HD',
        badge: '2160p',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        options: [],
      },
      {
        tier: '1080p',
        title: '1080p Full HD',
        badge: '1080p',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        options: [],
      },
      {
        tier: '720p',
        title: '720p HD',
        badge: '720p',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        options: [],
      },
      {
        tier: 'sd',
        title: 'SD Качество',
        badge: 'SD',
        badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        options: [],
      },
    ]

    for (const opt of qualityTorrentOptions) {
      const g = groups.find((grp) => grp.tier === opt.tier)
      if (g) {
        g.options.push(opt)
      } else {
        groups[groups.length - 1].options.push(opt)
      }
    }

    return groups.filter((g) => g.options.length > 0)
  }, [qualityTorrentOptions])

  // Single-accordion rule: default expanded accordion tier matches active option or first available
  useEffect(() => {
    if (showQualityMenu) {
      const activeGroup = groupedQualityOptions.find((g) => g.options.some((o) => o.isActive))
      if (activeGroup) {
        setExpandedQualityTier(activeGroup.tier)
      } else if (groupedQualityOptions.length > 0) {
        setExpandedQualityTier(groupedQualityOptions[0].tier)
      }
    }
  }, [showQualityMenu, groupedQualityOptions])

  // Current quality display for the player control bar button
  const currentQualityDisplay = useMemo(() => {
    if (activeTorrentOption) {
      return {
        badge: activeTorrentOption.resolutionBadge,
        bitrate: activeTorrentOption.bitrateLabel,
      }
    }
    const w = playerInfo?.width || 0
    const h = playerInfo?.height || 0
    const is4K = w >= 2500 || h >= 1400
    const is1080p = !is4K && (w >= 1300 || h >= 750 || (w === 0 && h === 0))
    const is720p = !is4K && !is1080p && (w >= 900 || h >= 500)
    const badge = is4K ? '4K' : is1080p ? '1080p' : is720p ? '720p' : 'SD'
    return {
      badge,
      bitrate: '',
    }
  }, [activeTorrentOption, playerInfo?.width, playerInfo?.height])

  // Track continuous buffering / waiting time (trigger prompt after 30s)
  useEffect(() => {
    // If playing smoothly and not buffering, reset timer & prompt
    if (isPlaying && !isBuffering && !isPreparingStream) {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      setShowStallPrompt(false)
      return
    }

    // If waiting/buffering/syncing and not in exhausted retry state, start 15s countdown
    if ((isBuffering || isPreparingStream) && !showStallPrompt && !isConnectionExhausted) {
      if (!stallTimerRef.current) {
        stallTimerRef.current = setTimeout(() => {
          setShowStallPrompt(true)
        }, 15000)
      }
    }

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
  }, [isPlaying, isBuffering, isPreparingStream, showStallPrompt, isConnectionExhausted])

  const handleSelectAlternateTorrent = async (torrent: TorrentResult) => {
    setIsMountingAlternate(true)
    setShowStallPrompt(false)
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    const video = videoRef.current
    const currentPos =
      video && !isNaN(video.currentTime) && video.currentTime > 0
        ? video.currentTime
        : currentTime > 0
        ? currentTime
        : 0

    wasPlayingBeforeSwitchRef.current = isPlaying
    pendingSeekTimeRef.current = currentPos
    seekTargetRef.current = currentPos
    streamRetryCountRef.current = 0

    // Immediately report progress to backend so DB is in sync with exact second
    if (playerInfo?.item_id) {
      reportProgress({
        item_id: playerInfo.item_id,
        media_source_id: playerInfo.media_source_id,
        position_seconds: currentPos,
        duration_seconds: duration || (video?.duration ?? 0),
        is_paused: !isPlaying,
        event: 'seek',
      })
    }

    try {
      await mountTorrent({
        tconst,
        title,
        ru_title: ruTitle,
        type: currentSeason !== undefined ? 'tvSeries' : 'movie',
        season: currentSeason,
        episode: currentEpisode,
        position_seconds: currentPos,
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

      // Do NOT destroy video src or blank the canvas here.
      // Keeping the previous video frame visible prevents jarring black screen flashes.
      videoRef.current?.pause()
      setIsBuffering(true)
      setShowAlternateModal(false)
      setSyncRetryCount(0)
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      await refetch()
    } catch (err) {
      console.error('Failed to mount alternate torrent:', err)
      setIsSwitchingQuality(false)
      setIsBuffering(false)
    } finally {
      setIsMountingAlternate(false)
    }
  }

  const handleSelectQualityTorrent = useCallback(
    async (torrent: TorrentResult) => {
      const tHash = getTorrentHash(torrent)
      const currentHash = (playerInfo?.media_source_id || '').toLowerCase()

      if (tHash && currentHash && tHash === currentHash) {
        setShowQualityMenu(false)
        return
      }

      // Preserve current playback timestamp
      const video = videoRef.current
      const currentPos =
        video && !isNaN(video.currentTime) && video.currentTime > 0
          ? video.currentTime
          : currentTime > 0
          ? currentTime
          : 0

      wasPlayingBeforeSwitchRef.current = isPlaying
      pendingSeekTimeRef.current = currentPos
      seekTargetRef.current = currentPos

      const tier = classifyResolution(torrent).toUpperCase()
      setIsSwitchingQuality(true)
      setSwitchingQualityTarget(tier)
      setTargetSeekTimeDisplay(formatTime(currentPos))
      setShowQualityMenu(false)
      setQualityToast(`Переключение: ${tier}...`)

      await handleSelectAlternateTorrent(torrent)

      setQualityToast(`Качество: ${tier}`)
      setTimeout(() => setQualityToast(null), 2500)
    },
    [playerInfo?.media_source_id, currentTime, isPlaying, handleSelectAlternateTorrent]
  )

  const handleClosePlayer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    const cur = currentItemRef.current
    const video = videoRef.current
    let liveTime =
      video && !isNaN(video.currentTime) && video.currentTime > 0
        ? video.currentTime
        : cur.time || currentTime
    if (!resumeDecisionMadeRef.current && (playerInfo?.resume_seconds ?? 0) > 15 && liveTime <= 5) {
      liveTime = playerInfo!.resume_seconds!
    }
    const isFinished = duration > 0 && liveTime >= (duration - 30)

    const fallbackItemId = currentSeason !== undefined && currentEpisode !== undefined
      ? `${tconst}_s${currentSeason}_e${currentEpisode}`
      : `${tconst}_s0_e0`
    const itemId = cur.id || playerInfo?.item_id || fallbackItemId
    const effDuration = duration || playerInfo?.duration_seconds || 0

    saveLocalPlayback({
      tconst,
      season: currentSeason,
      episode: currentEpisode,
      itemId,
      positionSeconds: liveTime,
      durationSeconds: effDuration,
      isPlayed: isFinished,
      title: title || playerInfo?.title,
      ruTitle: ruTitle || playerInfo?.ru_title,
    })

    if (itemId) {
      reportStop({
        item_id: itemId,
        media_source_id: cur.mediaSourceId || playerInfo?.media_source_id,
        position_seconds: liveTime,
        duration_seconds: effDuration,
        close_player: true,
        is_played: isFinished,
      }).unwrap().catch((err) => {
        console.warn('Failed to report player stop:', err)
      })
    }
    const mediaHash = cur.mediaSourceId || playerInfo?.media_source_id
    if (mediaHash) {
      stopTranscoding({ hash: mediaHash }).unwrap().catch(() => {})
    }
    // Invalidate resume list immediately in RTK Query cache
    dispatch(torrentsApi.util.invalidateTags([{ type: 'MountStatus', id: 'ResumeList' }]))

    // Gracefully handle browser back if opened in-app, or trigger onClose
    if (window.history.state?.hasInAppHistory) {
      window.history.back()
    } else {
      onClose()
    }
  }, [reportStop, onClose, currentTime, duration, playerInfo?.resume_seconds, playerInfo?.item_id, playerInfo?.media_source_id, playerInfo?.duration_seconds, playerInfo?.title, playerInfo?.ru_title, title, ruTitle, tconst, currentSeason, currentEpisode, dispatch])

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

  // Unique playSessionId for streaming session coordination
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
    if (playerInfo.direct_stream_url) {
      return `http://${host}:8092${playerInfo.direct_stream_url.replace(/^\/torr/, '')}`
    }
    const match = playerInfo.stream_url?.match(/(?:file_)?index=(\d+)/)
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

  // Stream construction helper with selected audio track, transcode profile & session binding
  const buildStreamUrl = useCallback(
    (
      info: PlayerInfoResponse,
      audioIdx: number | null,
      sessionId: string,
      profile: string,
      startSec: number = 0
    ) => {
      // Direct HTTP Range stream without HLS segmentation
      if (profile === 'http_direct') {
        if (info.direct_stream_url) {
          return info.direct_stream_url
        }
        if (info.stream_url && !info.stream_url.includes('.m3u8')) {
          return info.stream_url
        }
      }

      const targetAudio =
        audioIdx !== null
          ? audioIdx
          : info.audio_tracks?.find((a) => a.is_default)?.index ?? (info.audio_tracks?.[0]?.index ?? 0)

      // Transcoded or Remuxed HLS via FFmpeg on-the-fly
      if (profile && profile !== 'http_direct' && info.media_source_id) {
        const fileIdx = info.target_file_idx ?? 0
        const startParam = startSec > 0 ? startSec.toFixed(2) : '0'
        const totalDuration = info.duration_seconds || duration || 0
        const durationParam = totalDuration > 0 ? `&duration=${totalDuration.toFixed(2)}` : ''
        return `/api/stream/transcode/${info.media_source_id}/master.m3u8?profile=${encodeURIComponent(
          profile
        )}&file_idx=${fileIdx}&audio=${targetAudio}&start=${startParam}${durationParam}&s=${sessionId}`
      }

      if (!info.stream_url) return ''
      let url = info.stream_url

      if (url.includes('.m3u8')) {
        try {
          const parsed = new URL(url, window.location.origin)
          parsed.searchParams.set('audio', String(targetAudio))
          parsed.searchParams.set('s', sessionId)
          return parsed.pathname + parsed.search
        } catch {
          return url
        }
      }

      return url
    },
    []
  )

  // Audio Track Selection & Persistence
  const handleSelectAudioTrack = useCallback(
    (track: AudioTrack) => {
      if (videoRef.current) {
        pendingSeekTimeRef.current = videoRef.current.currentTime || currentTime || 0
      }
      if (selectedTranscodeProfile === 'http_direct') {
        setSelectedTranscodeProfile('direct')
        localStorage.setItem('cineclaw_transcode_profile', 'direct')
      }
      setSelectedAudioIndex(track.index)
      setShowAudioMenu(false)
      if (tconst) {
        setAudioPreference({
          imdb_id: tconst,
          audio_title: track.title,
          audio_index: track.index,
        }).unwrap().catch((e) => console.warn('[Player] setAudioPreference failed:', e))
      }
    },
    [currentTime, selectedTranscodeProfile, tconst, setAudioPreference]
  )

  // Load and Attach HLS Stream
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playerInfo?.item_id || !playerInfo.success) return

    const isNewEpisode = prevItemIdRef.current !== playerInfo.item_id
    if (isNewEpisode) {
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)
      prevItemIdRef.current = playerInfo.item_id
      resumeDecisionMadeRef.current = false
      const defAudio = playerInfo.audio_tracks?.find((a) => a.is_default) || playerInfo.audio_tracks?.[0]
      if (defAudio) {
        setSelectedAudioIndex(defAudio.index)
      }
    }

    const localRecord = getLocalPlayback(tconst, currentSeason, currentEpisode, playerInfo.item_id)
    const { effectiveResumeSeconds, isPlayed: isLocalPlayed } = resolveEffectiveResumeTime(
      playerInfo.resume_seconds,
      localRecord
    )

    const hasResume = !!(
      !autoResume &&
      effectiveResumeSeconds > 15 &&
      !isLocalPlayed &&
      !playerInfo.is_played &&
      effectiveResumeSeconds < ((playerInfo.duration_seconds || 999999) - 30)
    )

    if (hasResume && !resumeDecisionMadeRef.current) {
      setShowResumePrompt(true)
      setIsBuffering(false)
      return
    } else if (autoResume) {
      resumeDecisionMadeRef.current = true
      wasPlayingBeforeSwitchRef.current = true
    }

    // Determine seek time: if pendingSeekTimeRef is set (e.g. from quality / torrent change), use it.
    // If it's a newly switched episode and resume decision hasn't been made, wait for user choice.
    // If decision already made or autoResume, start at resume position.
    const targetSeekTime =
      pendingSeekTimeRef.current !== null
        ? pendingSeekTimeRef.current
        : isNewEpisode
        ? (resumeDecisionMadeRef.current || autoResume) && effectiveResumeSeconds > 0 && !isLocalPlayed && !playerInfo.is_played
          ? effectiveResumeSeconds
          : 0
        : video.currentTime || 0

    const streamUrl = buildStreamUrl(
      playerInfo,
      selectedAudioIndex,
      playSessionIdRef.current,
      selectedTranscodeProfile,
      targetSeekTime
    )
    if (!streamUrl) return

    setIsBuffering(true)

    const isHls = streamUrl.includes('.m3u8')

    seekTargetRef.current = targetSeekTime

    if (!isHls) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      // Check if src actually changed before resetting
      let nextSrc = streamUrl
      try {
        nextSrc = new URL(streamUrl, window.location.origin).href
      } catch {}
      const srcChanged = video.src !== nextSrc

      if (srcChanged) {
        video.src = streamUrl
      }

      let hasAppliedSeek = false
      const applySeekIfNeeded = () => {
        const target = seekTargetRef.current ?? pendingSeekTimeRef.current ?? 0
        if (target > 0 && !hasAppliedSeek) {
          hasAppliedSeek = true
          try {
            video.currentTime = target
          } catch (e) {
            console.warn('[Player] Initial seek error:', e)
          }
        }
      }

      const handleLoadedMetadata = () => {
        applySeekIfNeeded()
      }

      const handleSeekedOrCanPlay = () => {
        const target = seekTargetRef.current ?? pendingSeekTimeRef.current ?? 0
        if (target > 0 && Math.abs(video.currentTime - target) > 2.0 && video.seeking) {
          return
        }

        setIsBuffering(false)
        setIsSwitchingQuality(false)

        if (hasResume && !resumeDecisionMadeRef.current && !autoResume) {
          video.pause()
          setIsPlaying(false)
        } else {
          // Autostart playback when buffer is ready
          video.play().then(() => {
            setIsPlaying(true)
          }).catch((err) => {
            console.warn('[Player] play on seeked/canplay pending buffer:', err)
          })
        }
      }

      const handleInternalTimeUpdate = () => {
        if (pendingSeekTimeRef.current !== null) {
          const target = pendingSeekTimeRef.current
          if (video.currentTime >= target - 1.0) {
            pendingSeekTimeRef.current = null
            seekTargetRef.current = null
          }
        }
      }

      const handleError = () => {
        console.warn('[Player] Video error:', video.error?.code, video.error?.message)
        // If profile was http_direct and the browser cannot play this container or codec natively,
        // automatically fallback to 'direct' (HLS remux) and notify the user!
        if (selectedTranscodeProfile === 'http_direct') {
          console.warn('[Player] http_direct failed in browser, falling back to HLS direct remux')
          setQualityToast('Браузер не поддерживает контейнер напрямую. Переключение на HLS Remux...')
          setTimeout(() => setQualityToast(null), 3500)
          setSelectedTranscodeProfile('direct')
          localStorage.setItem('cineclaw_transcode_profile', 'direct')
          return
        }

        if (streamRetryCountRef.current < 5) {
          streamRetryCountRef.current++
          setIsBuffering(true)
          console.log(`[Player] TorrServer piece buffering retry (${streamRetryCountRef.current}/5)...`)
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.load()
            }
          }, 1500)
        } else {
          setIsBuffering(false)
          setIsSwitchingQuality(false)
        }
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('canplay', handleSeekedOrCanPlay)
      video.addEventListener('seeked', handleSeekedOrCanPlay)
      video.addEventListener('timeupdate', handleInternalTimeUpdate)
      video.addEventListener('error', handleError)

      if (video.readyState >= 1) {
        applySeekIfNeeded()
      }
      if (video.readyState >= 3) {
        handleSeekedOrCanPlay()
      }

      if (!hasResume || resumeDecisionMadeRef.current) {
        reportStart({
          item_id: playerInfo.item_id,
          media_source_id: playerInfo.media_source_id,
          audio_stream_index: selectedAudioIndex ?? undefined,
          position_seconds: targetSeekTime,
        })
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('canplay', handleSeekedOrCanPlay)
        video.removeEventListener('seeked', handleSeekedOrCanPlay)
        video.removeEventListener('timeupdate', handleInternalTimeUpdate)
        video.removeEventListener('error', handleError)
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
        backBufferLength: 60,
        maxBufferLength: 120, // 2 minutes buffer lead for high-bitrate remuxes
        maxMaxBufferLength: 300, // Up to 5 minutes buffer lead
        maxBufferSize: 500 * 1024 * 1024, // 500 MB RAM buffer to support 30+ Mbps 1080p/4K torrents
        startPosition: targetSeekTime > 0 ? targetSeekTime : -1,
        // Aggressive buffer hole jumping & non-fatal stall recovery
        maxBufferHole: 0.5,
        detectStallWithCurrentTimeMs: 1500,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.15,
        nudgeMaxRetry: 10,
        nudgeOnVideoHole: true,
        skipBufferHolePadding: 0.15,
        // Resilient network timeouts for high-bitrate torrent chunks (e.g. 25MB+ per segment)
        fragLoadingTimeOut: 60000,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 60000,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
      })
      hlsRef.current = hls

      if (targetSeekTime > 0) {
        try {
          video.currentTime = targetSeekTime
        } catch {}
      }

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false)
        setIsSwitchingQuality(false)
        setIsReconnecting(false)
        reconnectAttemptRef.current = 0
        setReconnectAttempt(0)
        if (hasResume && !resumeDecisionMadeRef.current && !autoResume) {
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
              console.warn('[Player] Fatal network error in Hls.js, attempting recovery...')
              if (typeof navigator !== 'undefined' && !navigator.onLine) {
                setIsNetworkOffline(true)
                return
              }
              if (reconnectAttemptRef.current < 5) {
                hls.startLoad()
              } else {
                setIsConnectionExhausted(true)
                setIsReconnecting(false)
              }
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[Player] Fatal media error in Hls.js, attempting recovery...')
              hls.recoverMediaError()
              break
            default:
              console.error('[Player] Fatal unrecoverable HLS error:', data)
              if (reconnectAttemptRef.current < 5) {
                const nextAtt = reconnectAttemptRef.current + 1
                reconnectAttemptRef.current = nextAtt
                setReconnectAttempt(nextAtt)
                setIsReconnecting(true)
                const v = videoRef.current
                const curPos = v && !isNaN(v.currentTime) && v.currentTime > 0 ? v.currentTime : 0
                pendingSeekTimeRef.current = curPos
                seekTargetRef.current = curPos
                setReconnectNonce((n) => n + 1)
              } else {
                setIsConnectionExhausted(true)
                setIsReconnecting(false)
                hls.destroy()
              }
              break
          }
        } else {
          // Handle non-fatal buffer stall and hole events
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            console.warn('[Player] Buffer stall detected by Hls.js, checking buffer ranges...')
            const v = videoRef.current
            if (v && v.buffered.length > 0) {
              const cur = v.currentTime
              // Look for hole ahead
              for (let i = 0; i < v.buffered.length; i++) {
                const s = v.buffered.start(i)
                if (s > cur && s - cur <= 2.5) {
                  console.log(`[Player] HLS stall recovery: jumping hole ${cur.toFixed(2)}s -> ${(s + 0.05).toFixed(2)}s`)
                  v.currentTime = s + 0.05
                  v.play().catch(() => {})
                  setIsBuffering(false)
                  return
                }
              }
              // If inside buffer, nudge forward past micro-stall
              for (let i = 0; i < v.buffered.length; i++) {
                if (cur >= v.buffered.start(i) && cur < v.buffered.end(i) - 0.2) {
                  console.log(`[Player] HLS stall recovery: nudging forward from ${cur.toFixed(2)}s`)
                  v.currentTime = cur + 0.15
                  v.play().catch(() => {})
                  setIsBuffering(false)
                  return
                }
              }
            }
          } else if (
            data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE ||
            data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
          ) {
            console.log(`[Player] Hls.js automatic hole jump: ${data.details}`)
            setIsBuffering(false)
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
        setIsSwitchingQuality(false)
        if (hasResume && !resumeDecisionMadeRef.current && !autoResume) {
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
  }, [
    playerInfo?.item_id,
    playerInfo?.media_source_id,
    playerInfo?.stream_url,
    selectedAudioIndex,
    selectedTranscodeProfile,
    resumeDecisionNonce,
    reconnectNonce,
    buildStreamUrl,
    reportStart,
  ])

  // Transcode Profile helpers
  const currentTranscodeBadge = useMemo(() => {
    switch (selectedTranscodeProfile) {
      case 'http_direct':
        return '🚀 Прямой HTTP'
      case 'direct':
        return '⚡ Исходный'
      case '1080p':
        return '📱 1080p'
      case '720p':
        return '📱 720p'
      case '480p':
        return '📶 480p'
      case '360p':
        return '🔋 360p'
      default:
        return '⚡ Исходный'
    }
  }, [selectedTranscodeProfile])

  const handleSelectTranscodeProfile = useCallback(
    (profileId: string) => {
      if (profileId === selectedTranscodeProfile) {
        setShowTranscodeMenu(false)
        return
      }
      const video = videoRef.current
      const curTime =
        video && !isNaN(video.currentTime) && video.currentTime > 0
          ? video.currentTime
          : currentTime > 0
          ? currentTime
          : 0

      wasPlayingBeforeSwitchRef.current = isPlaying || true
      pendingSeekTimeRef.current = curTime
      seekTargetRef.current = curTime

      // Generate new session ID for transcode pipeline
      playSessionIdRef.current = Math.random().toString(36).substring(2, 12) + Date.now().toString(36)

      const prof = (playerInfo?.transcode_profiles || defaultTranscodeProfiles).find((p) => p.id === profileId)
      const profLabel = prof ? prof.label : profileId

      setIsSwitchingQuality(true)
      setSwitchingQualityTarget(profLabel)
      setTargetSeekTimeDisplay(formatTime(curTime))
      setQualityToast(`Формат: ${profLabel}`)
      setTimeout(() => setQualityToast(null), 2500)

      setSelectedTranscodeProfile(profileId)
      localStorage.setItem('cineclaw_transcode_profile', profileId)
      setShowTranscodeMenu(false)
    },
    [selectedTranscodeProfile, currentTime, isPlaying, playerInfo?.transcode_profiles]
  )

  const effectiveResumeSeconds = useMemo(() => {
    const localRecord = getLocalPlayback(tconst, currentSeason, currentEpisode, playerInfo?.item_id)
    const { effectiveResumeSeconds: eff } = resolveEffectiveResumeTime(
      playerInfo?.resume_seconds,
      localRecord
    )
    return eff
  }, [tconst, currentSeason, currentEpisode, playerInfo?.item_id, playerInfo?.resume_seconds])

  const handleConfirmResume = () => {
    resumeDecisionMadeRef.current = true
    setShowResumePrompt(false)
    const target = effectiveResumeSeconds || playerInfo?.resume_seconds || 0
    pendingSeekTimeRef.current = target
    seekTargetRef.current = target
    wasPlayingBeforeSwitchRef.current = true
    setIsBuffering(true)
    setResumeDecisionNonce((prev) => prev + 1)
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
    pendingSeekTimeRef.current = 0
    seekTargetRef.current = 0
    setCurrentTime(0)
    wasPlayingBeforeSwitchRef.current = true
    setIsBuffering(true)
    setResumeDecisionNonce((prev) => prev + 1)
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
      const video = videoRef.current
      const liveTime =
        video && !isNaN(video.currentTime) && video.currentTime > 0
          ? video.currentTime
          : cur.time
      const fallbackItemId = currentSeason !== undefined && currentEpisode !== undefined
        ? `${tconst}_s${currentSeason}_e${currentEpisode}`
        : `${tconst}_s0_e0`
      const itemId = cur.id || playerInfo?.item_id || fallbackItemId
      const effDuration = duration || playerInfo?.duration_seconds || (video && !isNaN(video.duration) ? video.duration : 0)
      const isPlayed = effDuration > 0 && (liveTime >= effDuration - 30 || liveTime / effDuration >= 0.9)

      // Synchronously flush to localStorage so not a single second is lost on sudden reload
      saveLocalPlayback({
        tconst,
        season: currentSeason,
        episode: currentEpisode,
        itemId: itemId,
        positionSeconds: liveTime,
        durationSeconds: effDuration,
        isPlayed,
        title: title || playerInfo?.title,
        ruTitle: ruTitle || playerInfo?.ru_title,
      })

      if (itemId) {
        reportStop({
          item_id: itemId,
          media_source_id: cur.mediaSourceId || playerInfo?.media_source_id,
          position_seconds: liveTime,
          duration_seconds: duration,
          close_player: true,
        })
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      handleBeforeUnload()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reportStop, duration, currentSeason, currentEpisode, tconst, playerInfo?.item_id, playerInfo?.media_source_id, title, ruTitle])

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

  // Active Playback Stall & Buffer Hole Watchdog & Stream Auto-Recovery
  const lastPlaybackTimeRef = useRef<{ time: number; timestamp: number }>({ time: 0, timestamp: Date.now() })
  const bufferingStartTimeRef = useRef<number | null>(null)
  const lastAutoRecoveryAttemptRef = useRef<number>(0)
  const reconnectAttemptRef = useRef<number>(0)

  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      const video = videoRef.current
      if (!video) return

      // Don't monitor if paused by user or during explicit seeking
      if (video.paused || !isPlaying || video.seeking) {
        lastPlaybackTimeRef.current = { time: video.currentTime, timestamp: Date.now() }
        bufferingStartTimeRef.current = null
        return
      }

      const cur = video.currentTime
      const now = Date.now()
      const timeDiff = Math.abs(cur - lastPlaybackTimeRef.current.time)

      // If playback position has advanced smoothly, update ref and clear false buffering/reconnecting flags
      if (timeDiff >= 0.15) {
        lastPlaybackTimeRef.current = { time: cur, timestamp: now }
        bufferingStartTimeRef.current = null
        if (isBuffering) {
          setIsBuffering(false)
        }
        if (isReconnecting) {
          setIsReconnecting(false)
        }
        if (reconnectAttemptRef.current > 0) {
          reconnectAttemptRef.current = 0
          setReconnectAttempt(0)
        }
        return
      }

      // If currentTime hasn't moved for >= 750ms while playing
      const stallDurationMs = now - lastPlaybackTimeRef.current.timestamp
      if (stallDurationMs >= 750) {
        const buf = video.buffered
        let holeJumpTarget: number | null = null
        let hasBufferAhead = false

        for (let i = 0; i < buf.length; i++) {
          const s = buf.start(i)
          const e = buf.end(i)
          if (cur >= s - 0.1 && cur < e - 0.3) {
            hasBufferAhead = true
            break
          }
          if (s > cur && (holeJumpTarget === null || s < holeJumpTarget)) {
            holeJumpTarget = s
          }
        }

        // Case 1: Stalled right in front of a micro-gap / buffer hole (e.g. 10ms - 2.5s gap)
        if (holeJumpTarget !== null && holeJumpTarget - cur <= 2.5) {
          console.warn(`[Player Watchdog] Auto-jumping buffer hole: ${cur.toFixed(2)}s -> ${(holeJumpTarget + 0.05).toFixed(2)}s`)
          video.currentTime = holeJumpTarget + 0.05
          video.play().catch(() => {})
          setIsBuffering(false)
          bufferingStartTimeRef.current = null
          lastPlaybackTimeRef.current = { time: holeJumpTarget + 0.05, timestamp: now }
          return
        }

        // Case 2: Stalled while buffer is present ahead (>0.3s) (decoder hiccup or false pause)
        if (hasBufferAhead) {
          console.warn(`[Player Watchdog] Stalled with buffer present ahead at ${cur.toFixed(2)}s. Nudging +0.08s and resuming...`)
          video.currentTime = cur + 0.08
          video.play().catch(() => {})
          setIsBuffering(false)
          bufferingStartTimeRef.current = null
          lastPlaybackTimeRef.current = { time: cur + 0.08, timestamp: now }
          return
        }

        // Case 3: Truly out of buffer (waiting for network chunks)
        if (!isBuffering) {
          setIsBuffering(true)
          bufferingStartTimeRef.current = now

          // Record stall timestamp for adaptive bandwidth tracking
          const oneMinuteAgo = now - 60000
          recentStallsRef.current = [...recentStallsRef.current.filter((t) => t > oneMinuteAgo), now]
          if (recentStallsRef.current.length >= 3 && !showLowBandwidthPrompt) {
            setShowLowBandwidthPrompt(true)
          }
        }

        // Network Auto-Recovery Logic
        const totalBufferingMs = bufferingStartTimeRef.current ? now - bufferingStartTimeRef.current : stallDurationMs

        // If network is offline, wait for online event without exhausting attempts
        if (isNetworkOffline) {
          return
        }

        // If retries already exhausted, let manual resume dialog remain visible
        if (isConnectionExhausted) {
          return
        }

        if (reconnectAttemptRef.current >= 5) {
          console.warn('[Player Recovery] Max reconnect attempts reached (5/5). Pausing auto-retries for user manual resume.')
          setIsConnectionExhausted(true)
          setIsReconnecting(false)
          return
        }

        // Level 1: Soft recovery at 4-7s of continuous stall
        if (totalBufferingMs >= 4000 && totalBufferingMs < 7000) {
          if (now - lastAutoRecoveryAttemptRef.current >= 4000) {
            lastAutoRecoveryAttemptRef.current = now
            console.warn(`[Player Recovery] Soft recovery attempt at ${cur.toFixed(2)}s (stalled for ${(totalBufferingMs / 1000).toFixed(1)}s)...`)
            if (hlsRef.current) {
              hlsRef.current.recoverMediaError()
              try {
                hlsRef.current.startLoad(cur)
              } catch {}
            }
          }
        }

        // Level 2: Hard stream reconnect at >= 7s of continuous stall
        if (totalBufferingMs >= 7000) {
          if (now - lastAutoRecoveryAttemptRef.current >= 6000) {
            lastAutoRecoveryAttemptRef.current = now
            const nextAttempt = reconnectAttemptRef.current + 1
            reconnectAttemptRef.current = nextAttempt
            setReconnectAttempt(nextAttempt)

            if (nextAttempt >= 5) {
              console.warn('[Player Recovery] Reconnect attempts exhausted (5/5). Showing connection lost card.')
              setIsConnectionExhausted(true)
              setIsReconnecting(false)
              return
            }

            console.warn(`[Player Recovery] Hard reconnecting stream at ${cur.toFixed(2)}s (attempt ${nextAttempt}/5)...`)
            setIsReconnecting(true)

            // Flush local watch progress to ensure 0 lost seconds
            saveLocalPlayback({
              tconst,
              season: currentSeason,
              episode: currentEpisode,
              itemId: playerInfo?.item_id,
              positionSeconds: cur,
              durationSeconds: duration,
              isPlayed: false,
              title: title || playerInfo?.title,
              ruTitle: ruTitle || playerInfo?.ru_title,
            })

            pendingSeekTimeRef.current = cur
            seekTargetRef.current = cur
            setReconnectNonce((prev) => prev + 1)
          }
        }
      }
    }, 500)

    return () => clearInterval(watchdogInterval)
  }, [
    isPlaying,
    isBuffering,
    isReconnecting,
    isNetworkOffline,
    isConnectionExhausted,
    showLowBandwidthPrompt,
    tconst,
    currentSeason,
    currentEpisode,
    playerInfo?.item_id,
    playerInfo?.title,
    playerInfo?.ru_title,
    duration,
    title,
    ruTitle,
  ])

  // Network Online / Offline Detection & Auto-Resumption
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Player] Network restored (online event). Triggering immediate stream recovery...')
      setIsNetworkOffline(false)
      setIsConnectionExhausted(false)
      reconnectAttemptRef.current = 0
      setReconnectAttempt(0)
      bufferingStartTimeRef.current = Date.now()
      lastAutoRecoveryAttemptRef.current = Date.now()

      const video = videoRef.current
      const cur =
        video && !isNaN(video.currentTime) && video.currentTime > 0
          ? video.currentTime
          : currentTime > 0
          ? currentTime
          : 0

      pendingSeekTimeRef.current = cur
      seekTargetRef.current = cur
      setReconnectNonce((prev) => prev + 1)
    }

    const handleOffline = () => {
      console.warn('[Player] Network lost (offline event).')
      setIsNetworkOffline(true)
      const video = videoRef.current
      if (video && !isNaN(video.currentTime) && video.currentTime > 0) {
        saveLocalPlayback({
          tconst,
          season: currentSeason,
          episode: currentEpisode,
          itemId: playerInfo?.item_id,
          positionSeconds: video.currentTime,
          durationSeconds: duration,
          isPlayed: false,
          title: title || playerInfo?.title,
          ruTitle: ruTitle || playerInfo?.ru_title,
        })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [tconst, currentSeason, currentEpisode, playerInfo?.item_id, duration, currentTime, title, ruTitle])

  const handleManualResume = useCallback(() => {
    console.log('[Player Recovery] User manually triggered resume.')
    setIsConnectionExhausted(false)
    setIsReconnecting(true)
    reconnectAttemptRef.current = 0
    setReconnectAttempt(0)
    bufferingStartTimeRef.current = Date.now()
    lastAutoRecoveryAttemptRef.current = Date.now()

    const video = videoRef.current
    const cur =
      video && !isNaN(video.currentTime) && video.currentTime > 0
        ? video.currentTime
        : currentTime > 0
        ? currentTime
        : 0

    pendingSeekTimeRef.current = cur
    seekTargetRef.current = cur
    setReconnectNonce((prev) => prev + 1)
  }, [currentTime])

  // Video Event Handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    const effectivePos = video.currentTime
    setCurrentTime(effectivePos)
    const effDuration = playerInfo?.duration_seconds && playerInfo.duration_seconds > 0
      ? playerInfo.duration_seconds
      : (video.duration && !isNaN(video.duration) ? video.duration : duration)
    if (effDuration > 0) {
      setDuration(effDuration)
    }

    // Periodic local progress tracking in localStorage (persists every 5s while playing)
    if (Math.abs(effectivePos - lastSavedLocalTimeRef.current) >= 5.0 && effectivePos > 0) {
      lastSavedLocalTimeRef.current = effectivePos
      const isPlayed = effDuration > 0 && (effectivePos >= effDuration - 30 || effectivePos / effDuration >= 0.9)
      saveLocalPlayback({
        tconst,
        season: currentSeason,
        episode: currentEpisode,
        itemId: playerInfo?.item_id,
        positionSeconds: effectivePos,
        durationSeconds: effDuration,
        isPlayed,
        title: title || playerInfo?.title,
        ruTitle: ruTitle || playerInfo?.ru_title,
      })
    }

    // Buffered range
    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1))
    }

    // If time is actively updating and not seeking, clear any false buffering flag
    if (isBuffering && !video.seeking) {
      setIsBuffering(false)
    }

    // Next episode detection: prompt when remaining time < 45s
    const totalDuration = playerInfo?.duration_seconds || duration || video.duration || 0
    if (playerInfo?.has_next_episode && totalDuration > 60) {
      const remaining = totalDuration - effectivePos
      if (remaining <= 45 && !nextEpisodePrompt) {
        setNextEpisodePrompt(true)
      } else if (remaining > 45 && nextEpisodePrompt) {
        setNextEpisodePrompt(false)
      }
    }
  }

  const handleWaiting = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // If actively seeking, let buffering spinner show
    if (video.seeking) {
      setIsBuffering(true)
      return
    }

    const cur = video.currentTime
    const buf = video.buffered
    let nextRangeStart: number | null = null
    let hasAheadBufferInCurrentRange = false

    for (let i = 0; i < buf.length; i++) {
      const s = buf.start(i)
      const e = buf.end(i)
      if (cur >= s - 0.1 && cur < e - 0.3) {
        hasAheadBufferInCurrentRange = true
        break
      }
      if (s > cur && (nextRangeStart === null || s < nextRangeStart)) {
        nextRangeStart = s
      }
    }

    if (hasAheadBufferInCurrentRange) {
      // Data is present ahead! Do not show "Буферизация потока..." spinner.
      console.log(`[Player] onWaiting triggered while buffer is present ahead (${cur.toFixed(2)}s). Nudging +0.06s...`)
      video.currentTime = cur + 0.06
      video.play().catch(() => {})
      return
    }

    if (nextRangeStart !== null && nextRangeStart - cur <= 2.5) {
      // Micro-gap / buffer hole detected! Jump directly over the hole
      console.log(`[Player] onWaiting buffer hole detected: jumping from ${cur.toFixed(2)}s to ${(nextRangeStart + 0.05).toFixed(2)}s`)
      video.currentTime = nextRangeStart + 0.05
      video.play().catch(() => {})
      return
    }

    setIsBuffering(true)
  }, [])

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
    const currentPos = video.currentTime

    if (video.paused) {
      video.play()
      setIsPlaying(true)
      reportProgress({
        item_id: playerInfo?.item_id || '',
        media_source_id: playerInfo?.media_source_id,
        position_seconds: currentPos,
        duration_seconds: duration || video.duration,
        is_paused: false,
        event: 'unpause',
      })
    } else {
      video.pause()
      setIsPlaying(false)
      const effDuration = duration || video.duration || 0
      saveLocalPlayback({
        tconst,
        season: currentSeason,
        episode: currentEpisode,
        itemId: playerInfo?.item_id,
        positionSeconds: currentPos,
        durationSeconds: effDuration,
        isPlayed: effDuration > 0 && (currentPos >= effDuration - 30 || currentPos / effDuration >= 0.9),
        title: title || playerInfo?.title,
        ruTitle: ruTitle || playerInfo?.ru_title,
      })
      reportProgress({
        item_id: playerInfo?.item_id || '',
        media_source_id: playerInfo?.media_source_id,
        position_seconds: currentPos,
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
    const effDuration = duration || video.duration || 0
    saveLocalPlayback({
      tconst,
      season: currentSeason,
      episode: currentEpisode,
      itemId: playerInfo?.item_id,
      positionSeconds: newTime,
      durationSeconds: effDuration,
      isPlayed: effDuration > 0 && (newTime >= effDuration - 30 || newTime / effDuration >= 0.9),
      title: title || playerInfo?.title,
      ruTitle: ruTitle || playerInfo?.ru_title,
    })
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
    const currentPos = video.currentTime
    const target = Math.max(0, Math.min(currentPos + seconds, duration || 999999))
    handleSeek(target)

    if (seconds < 0) {
      setTapRipple('left')
      setTimeout(() => setTapRipple(null), 600)
    } else {
      setTapRipple('right')
      setTimeout(() => setTapRipple(null), 600)
    }
  }

  // Click on empty space (when controls are visible) immediately hides controls
  const handleEmptySpaceClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    // If any menu or drawer is open, dismiss it first
    if (showQualityMenu || showTranscodeMenu || showAudioMenu || showSubtitleMenu || showSpeedMenu || showExternalMenu || showEpisodesDrawer) {
      closeAllMenus()
      setShowEpisodesDrawer(false)
      return
    }
    setShowControls(false)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = null
    }
  }, [showQualityMenu, showTranscodeMenu, showAudioMenu, showSubtitleMenu, showSpeedMenu, showExternalMenu, showEpisodesDrawer, closeAllMenus])

  // Screen click & double-tap gesture handler
  const handleScreenTap = (e: React.MouseEvent | React.TouchEvent) => {
    // If any menu or drawer is open, dismiss it first
    if (showQualityMenu || showTranscodeMenu || showAudioMenu || showSubtitleMenu || showSpeedMenu || showExternalMenu || showEpisodesDrawer) {
      closeAllMenus()
      setShowEpisodesDrawer(false)
      return
    }

    const now = Date.now()
    const clientX =
      'touches' in e && e.touches.length > 0
        ? e.touches[0].clientX
        : 'changedTouches' in e && e.changedTouches.length > 0
        ? e.changedTouches[0].clientX
        : (e as React.MouseEvent).clientX

    const width = window.innerWidth
    const diff = now - lastTapRef.current.time

    // Double-tap threshold (< 320ms and within 100px)
    if (diff < 320 && Math.abs(clientX - lastTapRef.current.x) < 100) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
        tapTimeoutRef.current = null
      }
      if (clientX < width * 0.35) {
        handleSkip(-10)
      } else if (clientX > width * 0.65) {
        handleSkip(10)
      } else {
        togglePlay()
      }
      lastTapRef.current = { time: 0, x: 0 }
      return
    }

    lastTapRef.current = { time: now, x: clientX }

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
    }

    tapTimeoutRef.current = setTimeout(() => {
      // Reveal controls and start autohide timer
      setShowControls(true)
      handleUserActivity()
    }, 260)
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
    const container = containerRef.current
    const video = videoRef.current
    if (!container) return

    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (video as any)?.webkitDisplayingFullscreen
    )

    if (!isCurrentlyFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if (video && (video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen()
          }
        })
      } else if (video && (video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen()
      }
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      }
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

  // Active Skip Segment (Intro or Credits)
  const activeSkipSegment = useMemo(() => {
    const segments = playerInfo?.skip_segments
    if (!segments || segments.length === 0) return null
    return (
      segments.find(
        (s) => currentTime >= s.start_time && currentTime < s.end_time
      ) || null
    )
  }, [playerInfo?.skip_segments, currentTime])

  const handleSkipActiveSegment = useCallback(() => {
    if (!activeSkipSegment) return
    if (activeSkipSegment.type === 'credits' && playerInfo?.has_next_episode && playerInfo.next_episode) {
      handleSelectEpisode(playerInfo.next_episode)
    } else {
      handleSeek(activeSkipSegment.end_time)
    }
  }, [activeSkipSegment, playerInfo, handleSelectEpisode, handleSeek])

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
        case 's':
        case 'S':
        case 'ы':
        case 'Ы':
          if (activeSkipSegment) {
            e.preventDefault()
            handleSkipActiveSegment()
          }
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
  }, [togglePlay, handleSkip, handleVolumeChange, toggleFullscreen, toggleMute, volume, showEpisodesDrawer, showQualityMenu, showAudioMenu, showSubtitleMenu, showSpeedMenu, handleClosePlayer, handleUserActivity, activeSkipSegment, handleSkipActiveSegment])

  // Progress Bar Scrubber Calculation
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return createPortal(
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none overflow-hidden"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Video Element */}
      <video
        key={`video-${tconst}-${currentSeason ?? 0}-${currentEpisode ?? 0}`}
        ref={videoRef}
        playsInline
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          if (!videoRef.current?.seeking) {
            setIsPlaying(false)
          }
        }}
        onWaiting={handleWaiting}
        onPlaying={() => {
          setIsBuffering(false)
          setIsPlaying(true)
        }}
        onCanPlay={() => {
          setIsBuffering(false)
          if (resumeDecisionMadeRef.current || autoResume || wasPlayingBeforeSwitchRef.current) {
            videoRef.current?.play().catch(() => {})
          }
        }}
        onLoadedData={() => setIsBuffering(false)}
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
        onClick={handleScreenTap}
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

      {/* Buffering Spinner & Reconnecting Status */}
      {isBuffering && !isConnectionExhausted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-black/30 backdrop-blur-[2px]">
          <Loader2 className="h-14 w-14 text-emerald-400 animate-spin" />
          <span className="text-xs text-zinc-300 font-medium tracking-wide mt-3">
            {isNetworkOffline
              ? 'Ожидание сети...'
              : isReconnecting
              ? `Восстановление потока (попытка ${reconnectAttempt}/5)...`
              : 'Буферизация потока...'}
          </span>
        </div>
      )}

      {/* Connection Lost / Exhausted Retries Modal (Metro / Elevator / Deep Disconnect) */}
      {isConnectionExhausted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-md p-6 z-40 text-center pointer-events-auto animate-fade-in">
          <div className="p-4 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <WifiOff className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isNetworkOffline ? 'Нет подключения к интернету' : 'Связь потеряна'}
          </h3>
          <p className="text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
            {isNetworkOffline
              ? 'Устройство отключено от сети. Воспроизведение продолжится автоматически сразу при появлении интернета.'
              : 'Не удалось восстановить поток из-за нестабильного интернет-соединения. Нажмите кнопку, когда появится устойчивая сеть (например, после выхода из метро или лифта).'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleManualResume()
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/40 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Возобновить просмотр
            </button>
            {qualityTorrentOptions && qualityTorrentOptions.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowQualityMenu(true)
                }}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition cursor-pointer"
              >
                Сменить качество / раздачу
              </button>
            )}
          </div>
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
      {isPreparingStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-20 text-center px-4">
          <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
          <p className="mt-4 text-base text-zinc-200 font-medium">Подключение к торрент-потоку...</p>
          <p className="mt-1 text-xs text-zinc-400">TorrServer получает метаданные и буферизирует пиры (попытка {syncRetryCount + 1}/30)</p>
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
                {formatTime(effectiveResumeSeconds || playerInfo.resume_seconds)}
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
                <span>Продолжить с {formatTime(effectiveResumeSeconds || playerInfo.resume_seconds)}</span>
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

      {/* Seamless Quality Switching Transition Overlay */}
      {isSwitchingQuality && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3 pointer-events-none animate-fade-in">
          <div className="p-4 rounded-2xl bg-zinc-900/95 border border-emerald-500/40 shadow-2xl flex items-center gap-3.5 pointer-events-auto">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                <span>Смена качества:</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {switchingQualityTarget || 'Новый поток'}
                </span>
              </div>
              {targetSeekTimeDisplay && (
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Возобновление с {targetSeekTimeDisplay}
                </div>
              )}
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

      {/* Skip Intro / Skip Credits Floating Action Button */}
      {activeSkipSegment && !showResumePrompt && !isSwitchingQuality && (
        <div className="absolute bottom-24 right-6 z-40 animate-slide-up pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleSkipActiveSegment()
            }}
            className="group px-5 py-2.5 rounded-full bg-black/80 hover:bg-emerald-500 hover:text-black border border-white/20 hover:border-emerald-400 text-white font-bold text-xs sm:text-sm backdrop-blur-md shadow-2xl transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
            title={`${activeSkipSegment.label} (Клавиша S)`}
          >
            <FastForward className="h-4 w-4 fill-current transition-transform group-hover:scale-110" />
            <span>{activeSkipSegment.label}</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 group-hover:bg-black/20 text-zinc-300 group-hover:text-black/80">
              S
            </span>
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

      {/* Low Bandwidth / Frequent Stalls Adaptive Suggestion */}
      {showLowBandwidthPrompt && !isConnectionExhausted && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900/95 border border-amber-500/40 text-zinc-200 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md animate-fade-in text-xs sm:text-sm pointer-events-auto">
          <SignalZero className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="font-medium text-amber-200/90 text-xs">
            Нестабильная связь. Рекомендуем снизить качество для непрерывного просмотра
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowLowBandwidthPrompt(false)
              setShowQualityMenu(true)
            }}
            className="px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs transition active:scale-95 cursor-pointer shrink-0"
          >
            Сменить
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowLowBandwidthPrompt(false)
            }}
            className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer shrink-0"
            aria-label="Закрыть"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Cinema Controls Overlay */}
      {!isErrorState && (
        <div
          className={`absolute inset-0 flex flex-col justify-between pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] p-4 md:p-6 bg-gradient-to-t from-black/90 via-transparent to-black/75 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Invisible Backdrop to dismiss controls or open menus when clicking empty space */}
          {showControls && (
            <div
              className="absolute inset-0 z-10 cursor-pointer pointer-events-auto"
              onClick={handleEmptySpaceClick}
            />
          )}

          {/* Top Header Bar */}
          <div className="flex items-center justify-between gap-3 relative z-30 pointer-events-auto">
            <div className="min-w-0 max-w-[55%] sm:max-w-md">
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white truncate drop-shadow-md">
                {playerInfo?.ru_title || ruTitle || title}
              </h2>
              {playerInfo?.media_type === 'Episode' && playerInfo.title && (
                <p className="text-[11px] sm:text-xs md:text-sm text-emerald-400 font-semibold truncate drop-shadow-sm">
                  {playerInfo.title}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAlternateModal(true)
                }}
                className="p-2 md:px-3.5 py-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition border border-white/10 backdrop-blur-md flex items-center gap-1.5"
                title="Сменить раздачу (выбрать по сидам)"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span className="text-xs font-semibold hidden sm:inline">Сменить раздачу</span>
              </button>

              {/* Swarm Download Speed & Cellular Signal Indicator */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStatsTooltip(!showStatsTooltip)
                    closeAllMenusExcept('quality') // keep tooltip isolated
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-2 transition cursor-pointer ${
                    (streamStats?.signal_level ?? 0) >= 3
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : (streamStats?.signal_level ?? 0) === 2
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : (streamStats?.signal_level ?? 0) === 1
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                      : 'bg-zinc-900/70 border-white/10 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title="Статистика скорости и качества связи"
                >
                  {/* 4-bar cellular signal bars */}
                  <div className="flex items-end gap-[2px] h-3.5 pb-0.5">
                    {[4, 7, 10, 13].map((h, idx) => {
                      const isLit = (idx + 1) <= (streamStats?.signal_level ?? 0)
                      return (
                        <div
                          key={idx}
                          style={{ height: `${h}px` }}
                          className={`w-[3px] rounded-full transition-colors ${
                            isLit
                              ? (streamStats?.signal_level ?? 0) >= 3
                                ? 'bg-emerald-400'
                                : (streamStats?.signal_level ?? 0) === 2
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                              : 'bg-white/20'
                          }`}
                        />
                      )
                    })}
                  </div>

                  <span className="text-xs font-bold font-mono tracking-tight">
                    {streamStats?.download_speed_fmt || '0 КБ/с'}
                  </span>

                  {(streamStats?.connected_seeders ?? 0) > 0 && (
                    <span className="text-[11px] font-medium text-zinc-300 hidden md:inline">
                      🌱 {streamStats?.connected_seeders}
                    </span>
                  )}
                </button>

                {/* Popover Tooltip for Detailed Signal / Bitrate Stats */}
                {showStatsTooltip && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-zinc-900/95 border border-white/15 p-3.5 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-2.5 animate-fade-in text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="font-semibold text-zinc-200">Сигнал потока</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          (streamStats?.signal_level ?? 0) >= 3
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : (streamStats?.signal_level ?? 0) === 2
                            ? 'bg-amber-500/20 text-amber-300'
                            : (streamStats?.signal_level ?? 0) === 1
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {streamStats?.signal_status || 'Поиск пиров'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-zinc-300">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Скорость отдачи:</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {streamStats?.download_speed_fmt || '0 КБ/с'}
                        </span>
                      </div>

                      {Boolean(streamStats?.video_bitrate_fmt) && (
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Битрейт видео:</span>
                          <span className="font-medium text-zinc-200 font-mono">
                            {streamStats?.video_bitrate_fmt}
                          </span>
                        </div>
                      )}

                      {(streamStats?.speed_ratio ?? 0) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Запас скорости:</span>
                          <span className="font-bold text-sky-400">
                            {(streamStats?.speed_ratio ?? 0).toFixed(1)}x
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Сиды / Пиры:</span>
                        <span className="text-zinc-200 font-medium">
                          🌱 {streamStats?.connected_seeders || 0} / 👥 {streamStats?.active_peers || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* External Players Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowExternalMenu(!showExternalMenu)
                    closeAllMenusExcept('external')
                  }}
                  className="p-2 md:px-3.5 py-2 rounded-full bg-zinc-900/70 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-white/10 backdrop-blur-md flex items-center gap-1.5"
                  title="Открыть во внешнем плеере"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-xs font-semibold hidden sm:inline">Внешний плеер</span>
                </button>

                {/* Desktop Popover for External Player */}
                {showExternalMenu && (
                  <div className="hidden sm:flex absolute right-0 top-full mt-2 w-56 rounded-2xl bg-zinc-900/95 border border-white/15 p-2 shadow-2xl backdrop-blur-xl z-50 flex-col gap-1 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Открыть в приложении
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenExternal('vlc')
                        setShowExternalMenu(false)
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                    >
                      <span className="text-amber-400 text-base">🟠</span> VLC Player
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenExternal('iina')
                        setShowExternalMenu(false)
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                    >
                      <span className="text-sky-400 text-base">🔵</span> IINA (macOS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenExternal('infuse')
                        setShowExternalMenu(false)
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition text-left"
                    >
                      <span className="text-orange-500 text-base">🔥</span> Infuse (Apple TV / iOS)
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenExternal('copy')
                        setShowExternalMenu(false)
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition text-left"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copiedLink ? 'Ссылка скопирована!' : 'Скопировать поток'}</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClosePlayer()
                }}
                className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-white/15 backdrop-blur-md active:scale-95 cursor-pointer shadow-lg"
                title="Закрыть плеер (Esc)"
                aria-label="Закрыть плеер"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Center Screen Transport Controls */}
          {/* Mobile View: Large glass transport buttons */}
          <div className="md:hidden absolute inset-0 flex items-center justify-center gap-6 sm:gap-10 pointer-events-none z-30 animate-fade-in">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSkip(-10)
              }}
              className="pointer-events-auto p-3.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white/90 hover:text-white border border-white/20 backdrop-blur-md shadow-2xl transition-all"
              title="Назад на 10 секунд"
              aria-label="Назад на 10 секунд"
            >
              <RotateCcw className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              className="pointer-events-auto p-5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-black shadow-2xl shadow-emerald-500/40 border border-emerald-400/40 transition-all"
              title={isPlaying ? 'Пауза' : 'Воспроизведение'}
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 fill-current" />
              ) : (
                <Play className="h-8 w-8 fill-current ml-1" />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSkip(10)
              }}
              className="pointer-events-auto p-3.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 text-white/90 hover:text-white border border-white/20 backdrop-blur-md shadow-2xl transition-all"
              title="Вперед на 10 секунд"
              aria-label="Вперед на 10 секунд"
            >
              <RotateCw className="h-6 w-6" />
            </button>
          </div>

          {/* Desktop View: Splash icon on pause */}
          {!isPlaying && !isBuffering && (
            <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
              <div className="p-6 rounded-full bg-black/60 border border-white/20 backdrop-blur-md shadow-2xl scale-110 animate-fade-in">
                <Play className="h-12 w-12 text-white fill-current ml-1" />
              </div>
            </div>
          )}

          {/* Bottom Control Bar */}
          <div className="flex flex-col gap-2 relative z-30 pointer-events-auto max-w-5xl mx-auto w-full">
            {/* Interactive Scrub Bar */}
            <div
              className="group relative h-7 -my-1 flex items-center cursor-pointer touch-none"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = (e.clientX - rect.left) / rect.width
                handleSeek(ratio * duration)
              }}
              onTouchStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width))
                handleSeek(ratio * duration)
              }}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width))
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
                className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-md border border-emerald-400 -translate-x-1/2 scale-100 sm:scale-0 sm:group-hover:scale-100 transition-transform"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Mobile Timecode Row (Visible on mobile, hidden on md+) */}
            <div className="flex md:hidden items-center justify-between text-[11px] font-mono text-zinc-300 px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Mobile Action Bar (Dedicated clean single row for mobile, zero wrapping) */}
            <div className="flex md:hidden items-center justify-between gap-1 text-white mt-1 w-full">
              {/* TV Series Episodes Drawer */}
              {playerInfo?.episodes && playerInfo.episodes.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowEpisodesDrawer(!showEpisodesDrawer)
                    closeAllMenusExcept('episodes')
                  }}
                  className={`p-2 rounded-xl transition flex items-center justify-center ${
                    showEpisodesDrawer ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                  }`}
                  title="Список серий"
                  aria-label="Список серий"
                >
                  <ListVideo className="h-5 w-5" />
                </button>
              ) : <div className="w-8" />}

              {/* Audio Track Selector */}
              {playerInfo?.audio_tracks && playerInfo.audio_tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAudioMenu(!showAudioMenu)
                    closeAllMenusExcept('audio')
                  }}
                  className={`p-2 rounded-xl transition flex items-center justify-center ${
                    showAudioMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                  }`}
                  title="Аудиодорожки"
                  aria-label="Аудиодорожки"
                >
                  <Languages className="h-5 w-5" />
                </button>
              )}

              {/* Subtitle Selector */}
              {playerInfo?.subtitles && playerInfo.subtitles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSubtitleMenu(!showSubtitleMenu)
                    closeAllMenusExcept('subtitles')
                  }}
                  className={`p-2 rounded-xl transition flex items-center justify-center ${
                    showSubtitleMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                  }`}
                  title="Субтитры"
                  aria-label="Субтитры"
                >
                  <Subtitles className="h-5 w-5" />
                </button>
              )}

              {/* Quality Selector Pill */}
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu)
                  closeAllMenusExcept('quality')
                }}
                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 text-[11px] font-bold ${
                  showQualityMenu
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10'
                }`}
                title="Раздачи торрентов"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                <span>{currentQualityDisplay.badge}</span>
              </button>

              {/* Transcode Profile Pill */}
              <button
                type="button"
                onClick={() => {
                  setShowTranscodeMenu(!showTranscodeMenu)
                  closeAllMenusExcept('transcode')
                }}
                className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 text-[11px] font-bold ${
                  showTranscodeMenu
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                    : selectedTranscodeProfile !== 'direct'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10'
                }`}
                title="Формат потока и сжатие (FFmpeg)"
              >
                <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                <span>{currentTranscodeBadge}</span>
              </button>

              {/* Playback Speed */}
              <button
                type="button"
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu)
                  closeAllMenusExcept('speed')
                }}
                className={`p-2 rounded-xl transition flex items-center justify-center ${
                  showSpeedMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                }`}
                title="Скорость"
                aria-label="Скорость"
              >
                <Gauge className="h-5 w-5" />
                <span className="text-[10px] font-mono font-bold ml-0.5">{playbackSpeed}x</span>
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-xl hover:bg-white/15 transition text-zinc-300 hover:text-white"
                title="На весь экран"
                aria-label="На весь экран"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>

            {/* Desktop Action Row (Hidden on mobile, visible on md+) */}
            <div className="hidden md:flex items-center justify-between gap-2 text-white">
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
                      closeAllMenusExcept('episodes')
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

                {/* Audio Tracks Dropdown (Desktop) */}
                {playerInfo?.audio_tracks && playerInfo.audio_tracks.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowAudioMenu(!showAudioMenu)
                        closeAllMenusExcept('audio')
                      }}
                      className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                        showAudioMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                      }`}
                      title="Выбор аудиодорожки"
                    >
                      <Languages className="h-4 w-4 md:h-5 md:w-5" />
                      <span className="hidden lg:inline">Звук</span>
                    </button>

                    {/* Desktop Popover */}
                    {showAudioMenu && (
                      <div className="hidden sm:block absolute bottom-12 right-0 w-64 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5">
                          Аудиодорожки
                        </div>
                        <div className="max-h-56 overflow-y-auto mt-1 space-y-1">
                          {playerInfo.audio_tracks.map((a: AudioTrack) => (
                            <button
                              key={a.index}
                              onClick={() => handleSelectAudioTrack(a)}
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

                {/* Subtitles Dropdown (Desktop) */}
                {playerInfo?.subtitles && playerInfo.subtitles.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSubtitleMenu(!showSubtitleMenu)
                        closeAllMenusExcept('subtitles')
                      }}
                      className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                        showSubtitleMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                      }`}
                      title="Субтитры"
                    >
                      <Subtitles className="h-4 w-4 md:h-5 md:w-5" />
                      <span className="hidden lg:inline">Субтитры</span>
                    </button>

                    {/* Desktop Popover */}
                    {showSubtitleMenu && (
                      <div className="hidden sm:block absolute bottom-12 right-0 w-56 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
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

                {/* Quality & Torrents Dropdown (Desktop) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu)
                      closeAllMenusExcept('quality')
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                      showQualityMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Выбор раздачи и качества видео"
                  >
                    <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="text-[11px] md:text-xs">
                      {currentQualityDisplay.badge}
                    </span>
                    {currentQualityDisplay.bitrate && (
                      <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline">
                        • {currentQualityDisplay.bitrate}
                      </span>
                    )}
                  </button>

                  {/* Desktop Popover */}
                  {showQualityMenu && (
                    <div className="hidden sm:block absolute bottom-12 right-0 w-72 sm:w-80 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Качество и раздачи</span>
                        </div>
                        {playerInfo?.video_codec && (
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded uppercase">
                            {formatCodec(playerInfo.video_codec)}
                          </span>
                        )}
                      </div>

                      {isLoadingTorrents ? (
                        <div className="py-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                          <span>Загрузка доступных раздач...</span>
                        </div>
                      ) : qualityTorrentOptions.length === 0 ? (
                        <div className="py-4 px-3 text-center text-xs text-zinc-400">
                          <div>Раздачи не найдены</div>
                          {playerInfo?.width && playerInfo?.height && (
                            <div className="text-[10px] text-zinc-500 mt-1">
                              Текущий поток: {playerInfo.width}x{playerInfo.height}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="max-h-72 sm:max-h-84 overflow-y-auto mt-1 space-y-2 pr-1 custom-scrollbar">
                          {groupedQualityOptions.map((group) => {
                            const hasActive = group.options.some((opt) => opt.isActive)
                            const isExpanded = expandedQualityTier === group.tier
                            return (
                              <div key={group.tier} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedQualityTier((prev) => (prev === group.tier ? null : group.tier))
                                  }
                                  className={`w-full sticky top-0 z-10 px-2.5 py-2 rounded-lg flex items-center justify-between border transition text-[11px] font-semibold text-zinc-300 shadow-sm ${
                                    isExpanded
                                      ? 'bg-zinc-900/95 border-emerald-500/30 text-emerald-400'
                                      : 'bg-zinc-950/90 border-white/5 hover:bg-zinc-900/80 hover:border-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${group.badgeColor}`}>
                                      {group.badge}
                                    </span>
                                    <span>{group.title}</span>
                                    {hasActive && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                                        Текущее
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-400 font-normal">
                                      {group.options.length} {getPluralVariants(group.options.length)}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                    )}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="space-y-1 pl-1">
                                    {group.options.map((opt, idx) => {
                                      const isSelected = opt.isActive
                                      return (
                                        <button
                                          key={opt.id}
                                          autoFocus={idx === 0}
                                          disabled={isMountingAlternate || isSwitchingQuality}
                                          onClick={() => {
                                            handleSelectQualityTorrent(opt.torrent)
                                            setShowQualityMenu(false)
                                          }}
                                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition ${
                                            isSelected
                                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                                              : 'hover:bg-white/10 text-zinc-300 border border-transparent'
                                          }`}
                                        >
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${group.badgeColor}`}>
                                                {opt.resolutionBadge}
                                              </span>
                                              {opt.bitrateLabel && (
                                                <span className="font-semibold text-zinc-100">
                                                  {opt.bitrateLabel}
                                                </span>
                                              )}
                                              {isSelected && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                                  Текущая
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                              <span>{opt.sizeFormatted}</span>
                                              <span>•</span>
                                              <span className="text-emerald-400 font-medium">
                                                🌱 {opt.seeds} сидов
                                              </span>
                                              {opt.audioLabel && (
                                                <>
                                                  <span>•</span>
                                                  <span className="text-cyan-400/90 truncate max-w-[120px]">
                                                    {opt.audioLabel}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                              {opt.torrent.title}
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Transcode Profile Dropdown (Desktop) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTranscodeMenu(!showTranscodeMenu)
                      closeAllMenusExcept('transcode')
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-bold ${
                      showTranscodeMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Формат потока и сжатие (FFmpeg)"
                  >
                    <Cpu className="h-4 w-4 md:h-5 md:w-5 text-emerald-400" />
                    <span className="text-[11px] md:text-xs">{currentTranscodeBadge}</span>
                  </button>

                  {/* Desktop Popover */}
                  {showTranscodeMenu && (
                    <div className="hidden sm:block absolute bottom-12 right-0 w-80 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Формат потока и сжатие</span>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 text-[10px] text-zinc-400 border-b border-white/5 leading-tight">
                        Раздача остаётся на лучшем торренте. Видео пережимается налету силами FFmpeg.
                      </div>
                      <div className="max-h-72 overflow-y-auto mt-1 space-y-1 pr-1 custom-scrollbar">
                        {(playerInfo?.transcode_profiles && playerInfo.transcode_profiles.length > 0
                          ? playerInfo.transcode_profiles
                          : defaultTranscodeProfiles
                        ).map((p) => {
                          const isSelected = p.id === selectedTranscodeProfile
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectTranscodeProfile(p.id)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                  : 'hover:bg-white/10 text-zinc-300'
                              }`}
                            >
                              <div className="min-w-0 mr-2">
                                <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                                  <span>{p.label}</span>
                                  {p.is_direct && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      0% CPU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">{p.description}</div>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Playback Speed Dropdown (Desktop) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSpeedMenu(!showSpeedMenu)
                      closeAllMenusExcept('speed')
                    }}
                    className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-bold ${
                      showSpeedMenu ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/15 text-zinc-300'
                    }`}
                    title="Скорость воспроизведения"
                  >
                    <Gauge className="h-4 w-4 md:h-5 md:w-5" />
                    <span>{playbackSpeed}x</span>
                  </button>

                  {/* Desktop Popover */}
                  {showSpeedMenu && (
                    <div className="hidden sm:block absolute bottom-12 right-0 w-36 p-2 rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-fade-in">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5 border-b border-white/5">
                        Скорость
                      </div>
                      <div className="mt-1 space-y-1">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => {
                              handleSpeedChange(speed)
                              setShowSpeedMenu(false)
                            }}
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
        <>
          {/* Mobile Backdrop */}
          <div
            className="sm:hidden fixed inset-0 z-30 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowEpisodesDrawer(false)}
          />
          <div className="fixed sm:absolute top-0 right-0 bottom-0 w-full sm:w-80 max-w-full bg-zinc-950/98 border-l border-white/10 backdrop-blur-2xl z-40 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-4 flex flex-col shadow-2xl animate-slide-left">
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

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 custom-scrollbar">
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
        </>
      )}

      {/* 30-Second Buffering Stall Notification Prompt */}
      {showStallPrompt && !showAlternateModal && (
        <div className="fixed sm:absolute top-[max(4.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-amber-500/50 backdrop-blur-xl shadow-2xl max-w-md w-[92%] flex flex-col gap-3 animate-fade-in pointer-events-auto">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => {
                setShowStallPrompt(false)
                if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
                stallTimerRef.current = setTimeout(() => {
                  setShowStallPrompt(true)
                }, 30000)
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition text-center"
            >
              Подождать
            </button>
            {qualityTorrentOptions.length > 1 && (
              <button
                onClick={() => {
                  setShowStallPrompt(false)
                  setShowQualityMenu(true)
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1 active:scale-95 shadow-md"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Сменить качество
              </button>
            )}
            <button
              onClick={() => {
                setShowStallPrompt(false)
                setShowAlternateModal(true)
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md active:scale-95"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              Выбрать по сидам ({sortedTorrentsBySeeds.length})
            </button>
          </div>
        </div>
      )}

      {/* Alternate Torrent Selector Modal (Sorted by Seeds) */}
      {showAlternateModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-auto animate-fade-in pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
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
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5 custom-scrollbar">
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

      {/* Mobile Bottom Sheet: Quality & Torrents */}
      {showQualityMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowQualityMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full max-h-[82vh] bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {/* Pill */}
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowQualityMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            {/* Header */}
            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Качество и раздачи</h4>
                  <div className="text-[10px] text-zinc-400">
                    Текущее: <span className="text-emerald-400 font-semibold">{currentQualityDisplay.badge}</span>
                    {playerInfo?.video_codec && (
                      <span className="ml-1.5 font-mono uppercase bg-zinc-800 px-1 py-0.2 rounded">
                        {formatCodec(playerInfo.video_codec)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowQualityMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 custom-scrollbar">
              {isLoadingTorrents ? (
                <div className="py-10 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  <span>Загрузка доступных раздач...</span>
                </div>
              ) : qualityTorrentOptions.length === 0 ? (
                <div className="py-8 px-4 text-center text-xs text-zinc-400">
                  <div>Раздачи не найдены</div>
                  {playerInfo?.width && playerInfo?.height && (
                    <div className="text-[10px] text-zinc-500 mt-1">
                      Текущий поток: {playerInfo.width}x{playerInfo.height}
                    </div>
                  )}
                </div>
              ) : (
                groupedQualityOptions.map((group) => {
                  const hasActive = group.options.some((opt) => opt.isActive)
                  const isExpanded = expandedQualityTier === group.tier
                  return (
                    <div key={group.tier} className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQualityTier((prev) => (prev === group.tier ? null : group.tier))
                        }
                        className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between border transition text-xs font-semibold shadow-sm ${
                          isExpanded
                            ? 'bg-zinc-900 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-900/60 border-white/5 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${group.badgeColor}`}>
                            {group.badge}
                          </span>
                          <span>{group.title}</span>
                          {hasActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                              Текущее
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-normal">
                            {group.options.length} {getPluralVariants(group.options.length)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="space-y-1.5 pl-1">
                          {group.options.map((opt, idx) => {
                            const isSelected = opt.isActive
                            return (
                              <button
                                key={opt.id}
                                autoFocus={idx === 0}
                                disabled={isMountingAlternate || isSwitchingQuality}
                                onClick={() => {
                                  handleSelectQualityTorrent(opt.torrent)
                                  setShowQualityMenu(false)
                                }}
                                className={`w-full text-left p-3 rounded-xl text-xs flex items-center justify-between gap-2.5 transition active:scale-[0.99] ${
                                  isSelected
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                                    : 'bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-300 border border-white/5'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${group.badgeColor}`}>
                                      {opt.resolutionBadge}
                                    </span>
                                    {opt.bitrateLabel && (
                                      <span className="font-semibold text-zinc-100">
                                        {opt.bitrateLabel}
                                      </span>
                                    )}
                                    {isSelected && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                        Текущая
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span>{opt.sizeFormatted}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-medium">
                                      🌱 {opt.seeds} сидов
                                    </span>
                                    {opt.audioLabel && (
                                      <>
                                        <span>•</span>
                                        <span className="text-cyan-400/90 truncate max-w-[140px]">
                                          {opt.audioLabel}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                    {opt.torrent.title}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: Transcode Profiles */}
      {showTranscodeMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowTranscodeMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full max-h-[82vh] bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {/* Pill */}
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowTranscodeMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            {/* Header */}
            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Формат потока и сжатие</h4>
                  <div className="text-[10px] text-zinc-400">
                    Транскодирование силами FFmpeg на лету
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscodeMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Explanatory note */}
            <div className="px-5 py-2 bg-emerald-500/5 border-b border-white/5 text-[11px] text-emerald-300/90 leading-snug">
              💡 Раздача остаётся на лучшем торренте. Видео сжимается под вашу сеть в реальном времени.
            </div>

            {/* Content: List of profiles */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
              {(playerInfo?.transcode_profiles && playerInfo.transcode_profiles.length > 0
                ? playerInfo.transcode_profiles
                : defaultTranscodeProfiles
              ).map((p) => {
                const isSelected = p.id === selectedTranscodeProfile
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectTranscodeProfile(p.id)}
                    className={`w-full p-3 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg'
                        : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                          {p.label}
                        </span>
                        {p.is_direct && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            0% CPU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        {p.description}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="p-1 rounded-full bg-emerald-500 text-black">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-zinc-600" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: Audio Tracks */}
      {showAudioMenu && playerInfo?.audio_tracks && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowAudioMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full max-h-[75vh] bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowAudioMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Languages className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Аудиодорожки</h4>
                  <div className="text-[10px] text-zinc-400">
                    Доступно дорожек: {playerInfo.audio_tracks.length}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAudioMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 custom-scrollbar">
              {playerInfo.audio_tracks.map((a: AudioTrack) => (
                <button
                  key={a.index}
                  onClick={() => handleSelectAudioTrack(a)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs flex items-center justify-between transition active:scale-[0.99] ${
                    selectedAudioIndex === a.index
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-white/5'
                  }`}
                >
                  <span className="truncate mr-2 font-medium">{a.title}</span>
                  {selectedAudioIndex === a.index && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: Subtitles */}
      {showSubtitleMenu && playerInfo?.subtitles && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowSubtitleMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full max-h-[75vh] bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowSubtitleMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Subtitles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Субтитры</h4>
                  <div className="text-[10px] text-zinc-400">
                    Доступно вариантов: {playerInfo.subtitles.length}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSubtitleMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 custom-scrollbar">
              <button
                onClick={() => {
                  setSelectedSubtitleIndex(null)
                  setShowSubtitleMenu(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs flex items-center justify-between transition active:scale-[0.99] ${
                  selectedSubtitleIndex === null
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-white/5'
                }`}
              >
                <span className="font-medium">Отключены</span>
                {selectedSubtitleIndex === null && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
              </button>
              {playerInfo.subtitles.map((s: SubtitleTrack) => (
                <button
                  key={s.index}
                  onClick={() => {
                    setSelectedSubtitleIndex(s.index)
                    setShowSubtitleMenu(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs flex items-center justify-between transition active:scale-[0.99] ${
                    selectedSubtitleIndex === s.index
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-white/5'
                  }`}
                >
                  <span className="truncate mr-2 font-medium">{s.title}</span>
                  {selectedSubtitleIndex === s.index && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: Playback Speed */}
      {showSpeedMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowSpeedMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowSpeedMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Gauge className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Скорость воспроизведения</h4>
              </div>
              <button
                onClick={() => setShowSpeedMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-4">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    handleSpeedChange(speed)
                    setShowSpeedMenu(false)
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    playbackSpeed === speed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-900/70 hover:bg-zinc-800 text-zinc-300 border border-white/5'
                  }`}
                >
                  <span>{speed}x</span>
                  {playbackSpeed === speed && <Check className="h-4 w-4 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet: External Player */}
      {showExternalMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowExternalMenu(false)}
          />
          {/* Sheet Container */}
          <div className="relative w-full bg-zinc-950/98 border-t border-white/15 rounded-t-3xl shadow-2xl backdrop-blur-2xl flex flex-col animate-slide-up pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div
              className="pt-3 pb-1.5 flex items-center justify-center cursor-pointer"
              onClick={() => setShowExternalMenu(false)}
            >
              <div className="w-10 h-1 rounded-full bg-zinc-700/80" />
            </div>

            <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Открыть во внешнем плеере</h4>
              </div>
              <button
                onClick={() => setShowExternalMenu(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  handleOpenExternal('vlc')
                  setShowExternalMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/70 border border-white/5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 transition active:scale-[0.99]"
              >
                <span className="text-xl">🟠</span>
                <span>VLC Player</span>
              </button>
              <button
                onClick={() => {
                  handleOpenExternal('iina')
                  setShowExternalMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/70 border border-white/5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 transition active:scale-[0.99]"
              >
                <span className="text-xl">🔵</span>
                <span>IINA (macOS)</span>
              </button>
              <button
                onClick={() => {
                  handleOpenExternal('infuse')
                  setShowExternalMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/70 border border-white/5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 transition active:scale-[0.99]"
              >
                <span className="text-xl">🔥</span>
                <span>Infuse (Apple TV / iOS)</span>
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => {
                  handleOpenExternal('copy')
                  setShowExternalMenu(false)
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-semibold hover:bg-emerald-500/30 transition active:scale-[0.99]"
              >
                <Copy className="h-4 w-4" />
                <span>{copiedLink ? 'Ссылка скопирована!' : 'Скопировать прямую ссылку на поток'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
