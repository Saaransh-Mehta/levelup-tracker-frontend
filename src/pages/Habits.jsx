import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Clock, Flame, Minus, PartyPopper, Plus, Trash2, X } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import Burst from '../components/Burst'
import CheckButton from '../components/CheckButton'
import {
  EVERY_DAY, HABIT_ICONS, STREAK_MILESTONES, TARGET_PRESETS, TIME_STEPS, WEEK_DAYS,
  dayName, describeDays, formatMinutes, localToday, longDate,
} from '../habits'

const EASE = [0.2, 0.8, 0.2, 1]
const SPRING = { type: 'spring', stiffness: 520, damping: 30 }
const RING_R = 54
const RING_C = 2 * Math.PI * RING_R
const MAX_CUSTOM_MINUTES = 600

// Applies a tick to the local copy right away, so the check doesn't wait for the server.
const withDone = (habit, date, done) => ({
  ...habit,
  today: habit.today.date === date ? { ...habit.today, done } : habit.today,
  week: habit.week.map((d) => (d.date === date ? { ...d, done } : d)),
})

function DayRing({ done, due }) {
  const pct = due ? done / due : 0
  const complete = due > 0 && done === due
  return (
    <div className="habit-ring">
      <svg className="ring" viewBox="0 0 140 140" aria-hidden="true">
        <circle className="ring-track" cx="70" cy="70" r={RING_R} />
        <motion.circle className={`ring-fill ${complete ? 'is-complete' : ''}`} cx="70" cy="70" r={RING_R}
          strokeDasharray={RING_C} initial={{ strokeDashoffset: RING_C }}
          animate={{ strokeDashoffset: RING_C * (1 - pct) }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
      </svg>
      <div className="ring-label">
        <motion.span key={done} className="ring-pct" initial={{ scale: 1.25, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
          transition={SPRING}>
          {done}<span className="habit-ring-of">/{due}</span>
        </motion.span>
        <span className="ring-sub">today</span>
      </div>
    </div>
  )
}

function TodayCard({ habits, today, celebrate }) {
  const reduceMotion = useReducedMotion()
  const due = habits.filter((h) => h.today.due)
  const done = due.filter((h) => h.today.done).length
  const minutes = habits.reduce((sum, h) => sum + h.today.minutes, 0)
  const topStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0)
  const complete = due.length > 0 && done === due.length

  const message = habits.length === 0
    ? 'Add your first habit below. Start small, something you can do even on a bad day.'
    : due.length === 0
      ? 'Nothing is due today. Enjoy the rest day.'
      : complete
        ? 'Day complete. Every habit done.'
        : done === 0
          ? `${due.length} to do today. Start with the easiest one.`
          : `${due.length - done} to go. You're ${Math.round((done / due.length) * 100)}% there.`

  return (
    <section className={`card habit-today ${complete ? 'is-complete' : ''}`} aria-labelledby="today-title">
      <div className="habit-today-ring">
        <DayRing done={done} due={due.length} />
        {!reduceMotion && celebrate > 0 && <Burst key={celebrate} count={36} spread={360} height={140} />}
      </div>
      <div className="habit-today-body">
        <h2 id="today-title">{longDate(today)}</h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={message} className="habit-today-msg" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {complete && <PartyPopper size={16} aria-hidden="true" />}{message}
          </motion.p>
        </AnimatePresence>
        <div className="habit-today-stats">
          <div>
            <span className="stat-num">{formatMinutes(minutes)}</span>
            <span className="stat-label">logged today</span>
          </div>
          <div>
            <span className="stat-num habit-flame-num">
              <Flame size={18} aria-hidden="true" className={topStreak ? 'is-lit' : ''} />{topStreak}
            </span>
            <span className="stat-label">top streak</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Composer({ onCreate }) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState(HABIT_ICONS[0])
  const [target, setTarget] = useState(0)
  const [days, setDays] = useState(EVERY_DAY)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const open = title.trim().length > 0

  const toggleDay = (value) => {
    const next = days.includes(value) ? days.filter((d) => d !== value) : [...days, value]
    if (next.length) setDays(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!open || saving) return
    setSaving(true)
    const ok = await onCreate({ title: title.trim(), icon, targetMinutes: target, days })
    setSaving(false)
    if (ok) {
      setTitle('')
      setTarget(0)
      setDays(EVERY_DAY)
      setIcon(HABIT_ICONS[Math.floor(Math.random() * HABIT_ICONS.length)])
      inputRef.current?.focus()
    }
  }

  return (
    <form className={`card habit-composer ${open ? 'is-open' : ''}`} onSubmit={submit}>
      <div className="habit-composer-row">
        <span className="habit-composer-icon" aria-hidden="true">{open ? icon : <Plus size={18} />}</span>
        <input ref={inputRef} className="habit-composer-input" value={title} maxLength={120}
          onChange={(e) => setTitle(e.target.value)} placeholder="New habit, e.g. Read before bed"
          aria-label="New habit" />
        <AnimatePresence>
          {open && (
            <motion.button type="submit" className="btn btn-cta" disabled={saving}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              whileTap={{ scale: 0.95 }}>
              Add habit
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="habit-composer-options" initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="habit-options-inner">
              <div className="habit-option">
                <span className="habit-option-key" id="icon-key">Icon</span>
                <div className="habit-icon-grid" role="radiogroup" aria-labelledby="icon-key">
                  {HABIT_ICONS.map((i) => (
                    <button key={i} type="button" role="radio" aria-checked={icon === i}
                      className={`habit-icon-btn ${icon === i ? 'is-selected' : ''}`} onClick={() => setIcon(i)}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div className="habit-option">
                <span className="habit-option-key" id="target-key">Daily time</span>
                <div className="pills" role="radiogroup" aria-labelledby="target-key">
                  {TARGET_PRESETS.map((m) => (
                    <label key={m} className="pill pill-small">
                      <input type="radio" name="target" checked={target === m} onChange={() => setTarget(m)} />
                      {m ? `${m} min` : 'Just tick it'}
                    </label>
                  ))}
                </div>
              </div>

              <div className="habit-option">
                <span className="habit-option-key" id="days-key">Days</span>
                <div className="habit-days" role="group" aria-labelledby="days-key">
                  {WEEK_DAYS.map((d) => (
                    <button key={d.value} type="button" aria-pressed={days.includes(d.value)} aria-label={d.name}
                      className={`habit-day ${days.includes(d.value) ? 'is-on' : ''}`} onClick={() => toggleDay(d.value)}>
                      {d.short}
                    </button>
                  ))}
                  <span className="habit-days-label">{describeDays(days)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}

function WeekDots({ habit, today, onToggle }) {
  return (
    <div className="habit-week" aria-label="Last 7 days">
      {habit.week.map((d) => {
        const isToday = d.date === today
        const state = d.done ? 'done' : d.due ? (isToday ? 'open' : 'missed') : 'rest'
        const title = `${dayName(d.date, 'short')}: ${d.done ? 'done' : d.due ? (isToday ? 'not yet' : 'missed') : 'rest day'}${d.minutes ? ` · ${formatMinutes(d.minutes)}` : ''}`
        return (
          <button key={d.date} type="button" className={`habit-dot is-${state} ${isToday ? 'is-today' : ''}`}
            onClick={() => onToggle(d.date, !d.done)} title={title} aria-label={title} aria-pressed={d.done}>
            <span className="habit-dot-day" aria-hidden="true">{dayName(d.date, 'narrow')}</span>
            <motion.span className="habit-dot-mark" initial={false} animate={{ scale: d.done ? 1 : 0.55 }} transition={SPRING} />
          </button>
        )
      })}
    </div>
  )
}

function TimeTray({ minutes, onAdd }) {
  const [custom, setCustom] = useState('')
  const value = parseInt(custom, 10)
  const validCustom = Number.isInteger(value) && value > 0 && value <= MAX_CUSTOM_MINUTES

  return (
    <div className="habit-tray-inner">
      <span className="habit-tray-label">How long did you spend?</span>
      <div className="habit-tray-steps">
        {TIME_STEPS.map((m) => (
          <motion.button key={m} type="button" className="habit-step" onClick={() => onAdd(m)} whileTap={{ scale: 0.9 }}>
            +{formatMinutes(m)}
          </motion.button>
        ))}
        <form className="habit-custom" onSubmit={(e) => {
          e.preventDefault()
          if (!validCustom) return
          onAdd(value)
          setCustom('')
        }}>
          <input type="number" min={1} max={MAX_CUSTOM_MINUTES} inputMode="numeric" className="property-value"
            value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" aria-label="Minutes to add" />
          <button type="submit" className="btn" disabled={!validCustom}>Add</button>
        </form>
        {minutes > 0 && (
          <button type="button" className="btn btn-ghost habit-undo" onClick={() => onAdd(-Math.min(5, minutes))}
            title="Take 5 minutes off">
            <Minus size={14} aria-hidden="true" />5m
          </button>
        )}
      </div>
    </div>
  )
}

function HabitRow({ habit, today, onLog, onDelete }) {
  const [trayOpen, setTrayOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [floaters, setFloaters] = useState([])
  const { done, minutes, due } = habit.today
  const target = habit.targetMinutes
  const progress = target ? Math.min(1, minutes / target) : 0

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  const addTime = (m) => {
    const id = Date.now() + Math.random()
    setFloaters((list) => [...list, { id, text: `${m > 0 ? '+' : '−'}${formatMinutes(Math.abs(m))}` }])
    setTimeout(() => setFloaters((list) => list.filter((f) => f.id !== id)), 900)
    onLog(habit, today, { addMinutes: m })
  }

  return (
    <motion.li layout="position" className={`card habit-row ${done ? 'is-done' : ''} ${due ? '' : 'is-rest'}`}
      initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.22 } }} transition={{ duration: 0.4, ease: EASE }}>
      <div className="habit-row-main">
        <CheckButton done={done} label={habit.title} onToggle={() => onLog(habit, today, { done: !done })} />

        <span className="habit-emoji" aria-hidden="true">{habit.icon}</span>

        <div className="habit-text">
          <span className="habit-title">
            <span>{habit.title}</span>
            <motion.span className="habit-strike" aria-hidden="true" initial={false}
              animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
          </span>
          <span className="habit-meta">
            <motion.span key={habit.streak} className={`habit-streak ${habit.streak ? 'is-lit' : ''}`}
              initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={SPRING}
              title={`Best streak: ${habit.best} day${habit.best === 1 ? '' : 's'}`}>
              <Flame size={13} aria-hidden="true" />{habit.streak} day{habit.streak === 1 ? '' : 's'}
            </motion.span>
            <span className="habit-target">
              {target > 0 ? `${minutes} / ${target} min` : minutes > 0 ? `${formatMinutes(minutes)} today` : null}
              <AnimatePresence>
                {floaters.map((f) => (
                  <motion.span key={f.id} className="habit-floater" aria-hidden="true"
                    initial={{ opacity: 0, y: 8, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: -16, scale: 1 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}>
                    {f.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            {habit.days.length < 7 && <span className="habit-sched">{describeDays(habit.days)}</span>}
            {habit.totalMinutes > 0 && <span className="habit-sched">{formatMinutes(habit.totalMinutes)} all time</span>}
          </span>
        </div>

        <WeekDots habit={habit} today={today} onToggle={(date, next) => onLog(habit, date, { done: next })} />

        <div className="habit-actions">
          <button type="button" className={`btn btn-ghost habit-time-btn ${trayOpen ? 'is-open' : ''}`}
            onClick={() => setTrayOpen(!trayOpen)} aria-expanded={trayOpen}>
            <Clock size={15} aria-hidden="true" /><span>Log time</span>
            <ChevronDown size={14} className="habit-chev" aria-hidden="true" />
          </button>
          <button type="button" className={`icon-btn habit-delete ${armed ? 'is-armed' : ''}`}
            onClick={() => (armed ? onDelete(habit) : setArmed(true))}
            aria-label={armed ? `Confirm deleting ${habit.title}` : `Delete ${habit.title}`}
            title={armed ? 'Click again to delete' : 'Delete habit'}>
            {armed ? <X size={15} /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>

      {target > 0 && (
        <div className="habit-bar" aria-hidden="true">
          <motion.span className={`habit-bar-fill ${progress >= 1 ? 'is-full' : ''}`} initial={false}
            animate={{ scaleX: progress }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {trayOpen && (
          <motion.div className="habit-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <TimeTray minutes={minutes} onAdd={addTime} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Habits() {
  const [habits, setHabits] = useState(null)
  const [today, setToday] = useState(localToday)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [celebrate, setCelebrate] = useState(0)
  const [showRest, setShowRest] = useState(false)

  useEffect(() => {
    api.get(`/habits?today=${today}`).then(({ data }) => setHabits(data.habits)).catch((err) => {
      setHabits((h) => h || [])
      setError(getErrorMessage(err))
    })
  }, [today])

  // Past midnight with the page open: move "today" on, which reloads.
  useEffect(() => {
    const onFocus = () => setToday(localToday())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const replace = (habit) => setHabits((list) => list.map((h) => (h._id === habit._id ? habit : h)))

  const allDone = (list) => {
    const due = list.filter((h) => h.today.due)
    return due.length > 0 && due.every((h) => h.today.done)
  }

  const onLog = async (habit, date, body) => {
    setError('')
    const before = habits
    if (body.done !== undefined) {
      const next = before.map((h) => (h._id === habit._id ? withDone(h, date, body.done) : h))
      setHabits(next)
      if (!allDone(before) && allDone(next)) setCelebrate((n) => n + 1)
    }
    try {
      const { data } = await api.put(`/habits/${habit._id}/days/${date}`, { ...body, today })
      const updated = data.habit
      replace(updated)
      // Reaching the time target ticks the habit on the server; celebrate that too.
      if (body.addMinutes && !allDone(before) && allDone(before.map((h) => (h._id === updated._id ? updated : h)))) {
        setCelebrate((n) => n + 1)
      }
      if (updated.streak > habit.streak && STREAK_MILESTONES.includes(updated.streak)) {
        setToast(`${updated.streak}-day streak on ${updated.icon} ${updated.title}`)
      } else if (body.addMinutes && !habit.today.done && updated.today.done && date === today) {
        setToast(`Target hit: ${updated.icon} ${updated.title}`)
      }
    } catch (err) {
      setHabits(before)
      setError(getErrorMessage(err))
    }
  }

  const onCreate = async (fields) => {
    setError('')
    try {
      const { data } = await api.post('/habits', { ...fields, today })
      setHabits((list) => [...list, data.habit])
      return true
    } catch (err) {
      setError(getErrorMessage(err))
      return false
    }
  }

  const onDelete = async (habit) => {
    const before = habits
    setHabits((list) => list.filter((h) => h._id !== habit._id))
    try {
      await api.delete(`/habits/${habit._id}`)
    } catch (err) {
      setHabits(before)
      setError(getErrorMessage(err))
    }
  }

  const list = habits || []
  const todo = list.filter((h) => h.today.due && !h.today.done)
  const done = list.filter((h) => h.today.done)
  const rest = list.filter((h) => !h.today.due && !h.today.done)
  const dueCount = list.filter((h) => h.today.due).length
  const dueDone = list.filter((h) => h.today.due && h.today.done).length

  const rowProps = { today, onLog, onDelete }

  return (
    <Workspace title="Habits" folder="Habits" wide
      status={habits ? `${list.length} habit${list.length === 1 ? '' : 's'} · ${dueDone}/${dueCount} today` : 'Loading…'}>
      <div className="stagger habits-page">
        <h1 className="inline-title">Habits</h1>
        <p className="lede">Small things, done often. Tick them off and log the time you put in.</p>

        {habits === null ? (
          <div className="goal-skeleton"><span /><span /><span /></div>
        ) : (
          <TodayCard habits={list} today={today} celebrate={celebrate} />
        )}

        <Composer onCreate={onCreate} />

        <section aria-label="Today's habits">
          <ul className="habit-list">
            <AnimatePresence initial={false}>
              {todo.map((h) => <HabitRow key={h._id} habit={h} {...rowProps} />)}
              {done.length > 0 && (
                <motion.li key="done-divider" layout="position" className="habit-divider" initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span>Done today</span><span className="habit-divider-count">{done.length}</span>
                </motion.li>
              )}
              {done.map((h) => <HabitRow key={h._id} habit={h} {...rowProps} />)}
            </AnimatePresence>
          </ul>

          {rest.length > 0 && (
            <div className="habit-rest">
              <button type="button" className="habit-divider habit-rest-toggle" onClick={() => setShowRest(!showRest)}
                aria-expanded={showRest}>
                <ChevronDown size={14} className="habit-chev" aria-hidden="true" />
                <span>Not due today</span><span className="habit-divider-count">{rest.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {showRest && (
                  <motion.ul className="habit-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                    {rest.map((h) => <HabitRow key={h._id} habit={h} {...rowProps} />)}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast habit-toast" role="status" initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={SPRING}>
            <Flame size={16} aria-hidden="true" />{toast}
          </motion.div>
        )}
        {error && (
          <motion.div className="toast habit-error" role="alert" initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </Workspace>
  )
}

export default Habits
