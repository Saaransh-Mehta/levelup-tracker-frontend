export const DURATION_PRESETS = [15, 25, 45, 60, 90, 120]

// Default session length from the onboarding "How do you prefer to work?" answer.
const BY_WORK_STYLE = { short_sprints: 25, medium_blocks: 60, deep_work: 120 }
export const defaultMinutes = (workStyle) => BY_WORK_STYLE[workStyle] || 25

export const APP_SUGGESTIONS = [
  { name: 'Google Docs', url: 'https://docs.google.com' },
  { name: 'Spotify', url: 'https://open.spotify.com' },
  { name: 'LeetCode', url: 'https://leetcode.com' },
  { name: 'GitHub', url: 'https://github.com' },
]

// 1500 → "25:00", 3725 → "1:02:05"
export const formatClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`
}

// 185 → "3m", 5400 → "1h 30m", 30 → "30s"
export const formatDuration = (seconds) => {
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

export const isOpen = (session) => session && ['running', 'paused'].includes(session.status)

// Seconds focused so far, using the server clock offset measured when the session was fetched.
export const focusedAt = (session, clockOffset, now = Date.now()) => {
  if (!session) return 0
  const running = session.resumedAt ? (now + clockOffset - Date.parse(session.resumedAt)) / 1000 : 0
  return Math.min(session.plannedSeconds, session.accumulatedSeconds + Math.max(0, running))
}

export const sessionWhen = (date) => {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
