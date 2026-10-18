export const CAMPAIGN_ICONS = ['⚔️', '🛡️', '🔥', '🏔️', '🚀', '🎯', '⚡', '🧠', '💪', '📚', '🏆', '🌅', '🧘', '💻', '🥇', '🦁']

// Lengths offered when launching a campaign, in days.
export const DURATIONS = [
  { days: 21, label: '21 days', hint: 'Build one habit' },
  { days: 30, label: '30 days', hint: 'A solid month' },
  { days: 66, label: '66 days', hint: 'Make it automatic' },
  { days: 90, label: '90 days', hint: 'A full quarter' },
]

export const MAX_ITEMS = 20

// Calendar-day helpers on "YYYY-MM-DD" strings, in the user's own timezone.
export const toDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fromDay = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s, n) => {
  const d = fromDay(s)
  d.setDate(d.getDate() + n)
  return toDay(d)
}

export const daysBetween = (a, b) => Math.round((fromDay(b) - fromDay(a)) / 86400000)

export const shortDate = (s) => fromDay(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export const dayLabel = (s) => fromDay(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

// "2026-10" for the month a day falls in.
export const monthOf = (s) => s.slice(0, 7)

export const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const monthLabel = (month) => fromDay(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

// The days shown for a month, Monday first, padded with nulls to whole weeks.
export const monthGrid = (month) => {
  const first = fromDay(`${month}-01`)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: lead }, () => null)
  for (let i = 1; i <= count; i += 1) cells.push(`${month}-${String(i).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// A day with nothing logged yet.
export const emptyDay = (date) => ({ date, rituals: [], slips: [], todos: [], score: 0, won: false })

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
