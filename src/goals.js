import {
  Brain, Briefcase, Dumbbell, GraduationCap, HeartPulse, Palette, PiggyBank, Users,
} from 'lucide-react'

// Keep values in sync with AREAS in backend/src/models/Goal.js
export const AREAS = [
  { value: 'fitness', label: 'Fitness', icon: Dumbbell, hint: 'Strength, running, sport' },
  { value: 'learning', label: 'Learning', icon: GraduationCap, hint: 'Skills, courses, reading' },
  { value: 'career', label: 'Career', icon: Briefcase, hint: 'Work, projects, promotions' },
  { value: 'mindfulness', label: 'Mindfulness', icon: Brain, hint: 'Focus, calm, journaling' },
  { value: 'finance', label: 'Finance', icon: PiggyBank, hint: 'Saving, investing, debt' },
  { value: 'health', label: 'Health', icon: HeartPulse, hint: 'Sleep, food, habits' },
  { value: 'creativity', label: 'Creativity', icon: Palette, hint: 'Art, music, writing' },
  { value: 'relationships', label: 'Relationships', icon: Users, hint: 'Family, friends, partner' },
]

export const areaOf = (value) => AREAS.find((a) => a.value === value)

export const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
]

export const QUICK_ICONS = ['🎯', '🏃', '📚', '💼', '🧘', '💰', '🥗', '🎨', '❤️', '🚀', '🧠', '🌱', '✍️', '🎸', '🏔️', '⚡']

const addMonths = (months) => {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export const DEADLINES = [
  { id: '1m', label: '1 month', date: () => addMonths(1) },
  { id: '3m', label: '3 months', date: () => addMonths(3) },
  { id: '6m', label: '6 months', date: () => addMonths(6) },
  { id: '1y', label: '1 year', date: () => addMonths(12) },
  { id: 'custom', label: 'Pick a date' },
  { id: 'none', label: 'No deadline' },
]

const paragraph = (text) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' })
const heading = (text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })

// The note a new goal starts with: why it matters, milestones as to-dos, space for notes.
export const buildGoalDoc = ({ why, milestones }) => {
  const steps = milestones.map((m) => m.trim()).filter(Boolean)
  const content = []
  if (why.trim()) {
    content.push(heading('Why this matters'), { type: 'blockquote', content: [paragraph(why.trim())] })
  }
  content.push(heading('Milestones'))
  content.push({
    type: 'taskList',
    content: (steps.length ? steps : ['']).map((text) => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [paragraph(text)],
    })),
  })
  content.push(heading('Notes'), paragraph(''))
  return { type: 'doc', content }
}

export const progressPercent = (progress) =>
  progress?.total ? Math.round((progress.done / progress.total) * 100) : 0

const DAY = 24 * 60 * 60 * 1000

// "in 3 months", "in 12 days", "today", "5 days ago"
export const relativeDate = (value) => {
  if (!value) return ''
  const target = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target - today) / DAY)
  if (days === 0) return 'today'
  const abs = Math.abs(days)
  const unit = abs >= 60 ? [Math.round(abs / 30), 'month'] : abs >= 14 ? [Math.round(abs / 7), 'week'] : [abs, 'day']
  const text = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`
  return days > 0 ? `in ${text}` : `${text} ago`
}

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
