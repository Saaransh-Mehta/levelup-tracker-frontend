export const HABIT_ICONS = ['🌱', '📚', '🏃', '🧘', '💧', '🥗', '😴', '✍️', '🎸', '🧠', '💪', '🚶', '🧹', '💻', '🙏', '☀️']

// Daily time targets offered when creating a habit. 0: just tick it off.
export const TARGET_PRESETS = [0, 10, 15, 20, 30, 45, 60]

export const TIME_STEPS = [5, 10, 15, 30, 60]

// Monday first, as people read a week. Values are JS weekdays (0 = Sunday).
export const WEEK_DAYS = [
  { value: 1, short: 'M', name: 'Monday' },
  { value: 2, short: 'T', name: 'Tuesday' },
  { value: 3, short: 'W', name: 'Wednesday' },
  { value: 4, short: 'T', name: 'Thursday' },
  { value: 5, short: 'F', name: 'Friday' },
  { value: 6, short: 'S', name: 'Saturday' },
  { value: 0, short: 'S', name: 'Sunday' },
]

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

// Streak lengths that get a toast.
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100, 365]

// The user's own calendar day, "2026-10-05". The server keys habit days by this.
export const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fromDay = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const dayName = (s, style = 'long') => fromDay(s).toLocaleDateString(undefined, { weekday: style })

export const longDate = (s) => fromDay(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

// 45 → "45m", 90 → "1h 30m"
export const formatMinutes = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

// "Every day", "Weekdays", "Weekends" or "Mon, Wed, Fri".
export const describeDays = (days) => {
  const set = [...days].sort().join()
  if (set === '0,1,2,3,4,5,6') return 'Every day'
  if (set === '1,2,3,4,5') return 'Weekdays'
  if (set === '0,6') return 'Weekends'
  return WEEK_DAYS.filter((d) => days.includes(d.value)).map((d) => d.name.slice(0, 3)).join(', ')
}
