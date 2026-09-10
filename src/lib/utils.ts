import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRuntime(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}ч ${remainingMinutes}м` : `${hours}ч`
  }
  return `${minutes}м`
}

export function formatVotes(votes: number): string {
  if (votes >= 1_000_000) {
    return `${(votes / 1_000_000).toFixed(1)}M`
  }
  if (votes >= 1_000) {
    return `${(votes / 1_000).toFixed(1)}K`
  }
  return votes.toString()
}

export function formatRating(rating?: number | null): string {
  if (rating === undefined || rating === null || rating === 0) return "—"
  return rating.toFixed(1)
}

export function getTypeLabel(type: string): string {
  switch (type.toLowerCase()) {
    case "movie":
      return "Фильм"
    case "tvseries":
      return "Сериал"
    case "tvminiseries":
      return "Мини-сериал"
    case "tvmovie":
      return "ТВ-фильм"
    case "short":
      return "Короткометражка"
    case "tvepisode":
      return "Серия"
    default:
      return type
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

