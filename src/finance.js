// Amounts travel in minor units (paise, cents) so sums never pick up float error.

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Rupee', locale: 'en-IN', presets: [1000, 2000, 3000, 5000, 10000], monthPresets: [5000, 10000, 15000, 20000, 30000] },
  { code: 'USD', symbol: '$', label: 'Dollar', locale: 'en-US', presets: [50, 100, 200, 300, 500], monthPresets: [200, 500, 800, 1200, 2000] },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'en-IE', presets: [50, 100, 200, 300, 500], monthPresets: [200, 500, 800, 1200, 2000] },
  { code: 'GBP', symbol: '£', label: 'Pound', locale: 'en-GB', presets: [50, 100, 200, 300, 500], monthPresets: [200, 500, 800, 1200, 2000] },
]

export const currencyOf = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]

export const CATEGORIES = [
  { value: 'food', label: 'Food', icon: '🍜' },
  { value: 'transport', label: 'Transport', icon: '🚌' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'bills', label: 'Bills', icon: '🧾' },
  { value: 'fun', label: 'Fun', icon: '🎬' },
  { value: 'health', label: 'Health', icon: '💊' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📦' },
]

export const categoryOf = (value) => CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1]

// "450.5" → 45050. Null when it isn't a usable amount.
export const toMinor = (text) => {
  const n = Number(String(text).replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

// 45050 → "₹450.50", 300000 → "₹3,000". Whole amounts drop the decimals.
export const money = (minor, code) => {
  const c = currencyOf(code)
  const whole = minor % 100 === 0
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(minor / 100)
}

// Calendar days as "YYYY-MM-DD" in the user's own timezone.
const pad = (n) => String(n).padStart(2, '0')
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromDay = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const localToday = () => toDay(new Date())

export const addDays = (s, n) => {
  const d = fromDay(s)
  d.setDate(d.getDate() + n)
  return toDay(d)
}

// Weeks run Monday to Sunday.
export const weekStartOf = (s) => addDays(s, -((fromDay(s).getDay() + 6) % 7))

export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i))

// "5 – 11 Oct", or "29 Sep – 5 Oct" across months.
export const weekRange = (start) => {
  const a = fromDay(start)
  const b = fromDay(addDays(start, 6))
  const day = (d, withMonth) => d.toLocaleDateString(undefined, withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' })
  return `${day(a, a.getMonth() !== b.getMonth())} – ${day(b, true)}`
}

export const shortDay = (s) => fromDay(s).toLocaleDateString(undefined, { weekday: 'short' })
export const longDay = (s) => fromDay(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

// Months: "2026-10-01" style starts.
export const monthStartOf = (s) => `${s.slice(0, 7)}-01`
export const daysInMonth = (s) => {
  const d = fromDay(s)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
export const addMonths = (s, n) => {
  const d = fromDay(monthStartOf(s))
  d.setMonth(d.getMonth() + n)
  return toDay(d)
}
export const monthDays = (start) => Array.from({ length: daysInMonth(start) }, (_, i) => addDays(start, i))
export const monthName = (s, withYear = true) =>
  fromDay(s).toLocaleDateString(undefined, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })

// The same daily allowance drives both views: a weekly budget spreads over 7 days, a monthly one over
// that month's days. Any range's budget is the sum of its days, so weeks and months always agree.
// (The server does the same sum for the totals it returns.)
export const dailyBudget = (amount, period, day) => (period === 'month' ? amount / daysInMonth(day) : amount / 7)
export const budgetForDays = (amount, period, days) =>
  Math.round(days.reduce((sum, d) => sum + dailyBudget(amount, period, d), 0) / 100) * 100

// Mondays that start a week touching this month, for the month's week-by-week view.
export const weeksOfMonth = (start) => {
  const days = monthDays(start)
  const weeks = []
  for (let w = weekStartOf(start); w <= days[days.length - 1]; w = addDays(w, 7)) {
    weeks.push({ start: w, days: weekDays(w).filter((d) => d >= days[0] && d <= days[days.length - 1]) })
  }
  return weeks
}
