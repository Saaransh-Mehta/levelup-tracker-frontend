import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Crosshair, Flame, Play, Plus, Shield, ShieldAlert, ShieldCheck,
  Swords, Timer, Trash2, Trophy, X, Zap,
} from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import Burst from '../components/Burst'
import CheckButton from '../components/CheckButton'
import StartSessionSheet from '../components/focus/StartSessionSheet'
import { useAppData } from '../context/appDataContext'
import { localToday } from '../habits'
import { formatDuration, isOpen } from '../sessions'
import {
  CAMPAIGN_ICONS, MAX_ITEMS, WEEKDAY_INITIALS, addDays, addMonths, dayLabel, daysBetween, emptyDay, monthGrid,
  monthLabel, monthOf, plural, shortDate,
} from '../campaigns'

const EASE = [0.2, 0.8, 0.2, 1]
const SPRING = { type: 'spring', stiffness: 520, damping: 30 }
const RING_R = 46
const RING_C = 2 * Math.PI * RING_R
const MAX_TODOS = 30

// Mongo-style id made on the client, so new rows keep their key once the server saves them.
const objectId = () =>
  Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')
  + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

const clamp = (date, { startDate, endDate }) => (date < startDate ? startDate : date > endDate ? endDate : date)

// A delete button that asks for a second click within three seconds.
function DeleteButton({ label, onConfirm, className = '' }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button type="button" className={`icon-btn habit-delete ${armed ? 'is-armed' : ''} ${className}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? `Confirm removing ${label}` : `Remove ${label}`} title={armed ? 'Click again to remove' : 'Remove'}>
      {armed ? <X size={14} /> : <Trash2 size={14} />}
    </button>
  )
}

// One-line input that adds a row on Enter.
function AddRow({ placeholder, label, onAdd, disabled }) {
  const [text, setText] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || disabled) return
    onAdd(value)
    setText('')
  }
  return (
    <form className="camp-add" onSubmit={submit}>
      <Plus size={15} aria-hidden="true" />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label}
        maxLength={200} disabled={disabled} />
      <AnimatePresence>
        {text.trim() && (
          <motion.button type="submit" className="btn btn-cta camp-add-btn" initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} whileTap={{ scale: 0.94 }}>
            Add
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  )
}

function CheckRow({ done, text, onToggle, onRemove, disabled, removeLabel, children }) {
  return (
    <motion.li layout="position" className={`camp-row ${done ? 'is-done' : ''}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease: EASE }}>
      {disabled ? <span className="camp-row-lock" aria-hidden="true" /> : <CheckButton done={done} label={text} onToggle={onToggle} />}
      <span className="habit-title camp-row-text">
        <span>{text}</span>
        <motion.span className="habit-strike" aria-hidden="true" initial={false}
          animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
      </span>
      {children}
      {onRemove && <DeleteButton label={removeLabel || text} onConfirm={onRemove} />}
    </motion.li>
  )
}

// The whole campaign as a strip of days: won, lost, today and still to come.
function DayStrip({ campaign, days, today, selected, onSelect }) {
  const cells = Array.from({ length: campaign.totalDays }, (_, i) => addDays(campaign.startDate, i))
  return (
    <div className="camp-strip" role="group" aria-label="Every day of the campaign">
      {cells.map((date, i) => {
        const day = days.get(date)
        const state = date > today ? 'future' : day?.won ? 'won' : date === today ? 'today' : 'lost'
        return (
          <motion.button key={date} type="button" className={`camp-strip-day is-${state} ${date === selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(date)} title={`Day ${i + 1} · ${shortDate(date)}`} aria-label={`Day ${i + 1}, ${shortDate(date)}`}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * 0.006, 0.6) }} />
        )
      })}
    </div>
  )
}

function Hero({ campaign, days, today, selected, onSelect, onUpdate, onDelete }) {
  const [name, setName] = useState(campaign.name)
  const [mission, setMission] = useState(campaign.mission)
  const [picking, setPicking] = useState(false)
  const [saved, setSaved] = useState(campaign)

  // A save from elsewhere (or a rollback) resets the fields to what's stored.
  if (saved.name !== campaign.name || saved.mission !== campaign.mission) {
    setSaved(campaign)
    setName(campaign.name)
    setMission(campaign.mission)
  }

  const pct = campaign.totalDays ? Math.round((campaign.elapsed / campaign.totalDays) * 100) : 0
  const winRate = campaign.elapsed ? Math.round((campaign.wins / campaign.elapsed) * 100) : 0

  const commitName = () => {
    const value = name.trim()
    if (!value) return setName(campaign.name)
    if (value !== campaign.name) onUpdate({ name: value })
  }

  return (
    <section className="card camp-hero" aria-label="Campaign">
      <div className="camp-hero-glow" aria-hidden="true" />
      <div className="camp-hero-top">
        <div className="camp-hero-id">
          <div className="goal-icon-wrap">
            <button type="button" className="goal-icon camp-hero-icon" onClick={() => setPicking(!picking)}
              aria-label={`Icon: ${campaign.icon}. Change icon`} aria-expanded={picking}>
              <motion.span key={campaign.icon} initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
                {campaign.icon}
              </motion.span>
            </button>
            <AnimatePresence>
              {picking && (
                <motion.div className="icon-popover camp-icon-pop" initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.16 }}>
                  {CAMPAIGN_ICONS.map((icon) => (
                    <button key={icon} type="button" className={`icon-option ${campaign.icon === icon ? 'is-selected' : ''}`}
                      onClick={() => { onUpdate({ icon }); setPicking(false) }} aria-label={icon}>
                      {icon}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="camp-hero-text">
            <span className={`camp-chip is-${campaign.status}`}>
              {campaign.status === 'active' && <span className="live-dot" aria-hidden="true" />}
              {campaign.status === 'active' ? 'Campaign live' : campaign.status === 'upcoming' ? 'Starts soon' : 'Campaign complete'}
            </span>
            <input className="camp-name" value={name} maxLength={120} aria-label="Campaign name"
              onChange={(e) => setName(e.target.value)} onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <input className="camp-mission" value={mission} maxLength={500} aria-label="Mission"
              placeholder="Add a mission: the one line that keeps you going"
              onChange={(e) => setMission(e.target.value)}
              onBlur={() => mission.trim() !== campaign.mission && onUpdate({ mission: mission.trim() })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          </div>
        </div>

        <div className="camp-counter" aria-live="polite">
          <span className="camp-counter-label">
            {campaign.status === 'active' ? 'Day' : campaign.status === 'upcoming' ? 'Starts in' : 'Days won'}
          </span>
          <span className="camp-counter-value">
            <motion.span key={campaign.dayNumber ?? campaign.wins} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={SPRING}>
              {campaign.status === 'active' ? campaign.dayNumber
                : campaign.status === 'upcoming' ? campaign.daysLeft - campaign.totalDays : campaign.wins}
            </motion.span>
            <span className="camp-counter-of">
              {campaign.status === 'upcoming' ? `day${campaign.daysLeft - campaign.totalDays === 1 ? '' : 's'}` : `/${campaign.totalDays}`}
            </span>
          </span>
        </div>
      </div>

      <DayStrip campaign={campaign} days={days} today={today} selected={selected} onSelect={onSelect} />
      <div className="camp-strip-legend">
        <span>{shortDate(campaign.startDate)}</span>
        <span className="camp-strip-pct">{pct}% through</span>
        <span>{shortDate(campaign.endDate)}</span>
      </div>

      <div className="camp-stats">
        <div className="camp-stat">
          <motion.span key={campaign.streak} className={`camp-stat-num camp-flame ${campaign.streak ? 'is-lit' : ''}`}
            initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={SPRING}>
            <Flame size={18} aria-hidden="true" />{campaign.streak}
          </motion.span>
          <span className="stat-label">day streak</span>
        </div>
        <div className="camp-stat">
          <span className="camp-stat-num"><Trophy size={17} aria-hidden="true" />{campaign.wins}</span>
          <span className="stat-label">days won</span>
        </div>
        <div className="camp-stat">
          <span className="camp-stat-num"><Zap size={17} aria-hidden="true" />{winRate}%</span>
          <span className="stat-label">win rate</span>
        </div>
        <div className="camp-stat">
          <span className="camp-stat-num">{campaign.best}</span>
          <span className="stat-label">best streak</span>
        </div>
        <div className="camp-stat">
          <span className="camp-stat-num">{campaign.daysLeft}</span>
          <span className="stat-label">days left</span>
        </div>
        <DeleteButton label="this campaign" onConfirm={onDelete} className="camp-hero-delete" />
      </div>
    </section>
  )
}

function ScoreRing({ day, total, future, celebrate }) {
  const reduceMotion = useReducedMotion()
  const score = future ? 0 : day.score
  const pct = Math.round(score * 100)
  return (
    <div className="camp-ring">
      <svg className="ring" viewBox="0 0 110 110" aria-hidden="true">
        <circle className="ring-track" cx="55" cy="55" r={RING_R} />
        <motion.circle className={`ring-fill ${day.won ? 'is-complete' : ''}`} cx="55" cy="55" r={RING_R}
          strokeDasharray={RING_C} initial={{ strokeDashoffset: RING_C }}
          animate={{ strokeDashoffset: RING_C * (1 - score) }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
      </svg>
      <div className="ring-label">
        <motion.span key={pct} className="camp-ring-pct" initial={{ scale: 1.25, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
          transition={SPRING}>
          {total && !future ? `${pct}%` : '–'}
        </motion.span>
        <span className="ring-sub">{future ? 'ahead' : day.won ? 'won' : 'score'}</span>
      </div>
      {!reduceMotion && celebrate > 0 && <Burst key={celebrate} count={36} spread={320} height={130} />}
    </div>
  )
}

function DistractionRow({ item, slipped, disabled, onToggle, onRemove }) {
  return (
    <motion.li layout="position" className={`camp-enemy ${slipped ? 'is-slipped' : 'is-held'}`}
      initial={{ opacity: 0, y: 8 }} animate={slipped ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }} transition={{ duration: 0.38, ease: EASE }}>
      <motion.button type="button" className="camp-enemy-toggle" onClick={onToggle} disabled={disabled}
        aria-pressed={slipped} whileTap={{ scale: 0.9 }}
        aria-label={slipped ? `${item.text}: you slipped. Mark as held` : `${item.text}: held. Mark as slipped`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={slipped ? 'slip' : 'held'} className="camp-enemy-icon"
            initial={{ scale: 0.3, rotate: -45, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.3, rotate: 45, opacity: 0 }} transition={{ duration: 0.2 }}>
            {disabled ? <Shield size={17} /> : slipped ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <span className="camp-enemy-text">{item.text}</span>
      <span className="camp-enemy-state">{disabled ? 'ahead' : slipped ? 'slipped' : 'held'}</span>
      <DeleteButton label={item.text} onConfirm={onRemove} />
    </motion.li>
  )
}

// A to-do's focus time, and the button that starts (or returns to) a session on it.
function TodoFocus({ seconds, live, canStart, onStart }) {
  return (
    <>
      <AnimatePresence initial={false}>
        {seconds > 0 && (
          <motion.span key="time" className="camp-todo-time" title="Time focused on this to-do"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
            <Timer size={12} aria-hidden="true" />{formatDuration(seconds)}
          </motion.span>
        )}
      </AnimatePresence>
      {live ? (
        <Link to={`/focus/${live._id}`} className="camp-todo-live" title="Back to your focus session">
          <span className="live-dot" aria-hidden="true" />{live.status === 'paused' ? 'Paused' : 'Focusing'}
        </Link>
      ) : canStart && (
        <motion.button type="button" className="camp-todo-play" onClick={onStart} whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.08 }} aria-label="Start a focus session on this to-do" title="Focus on this">
          <Play size={13} aria-hidden="true" />
        </motion.button>
      )}
    </>
  )
}

function DayPanel({ campaign, day, today, focus, liveSession, celebrate, onMove, onSaveDay, onUpdate, onFocus }) {
  const future = day.date > today
  const past = day.date < today
  const dayNumber = daysBetween(campaign.startDate, day.date) + 1
  const ritualsDone = new Set(day.rituals)
  const slips = new Set(day.slips)
  // Rituals and distractions added later didn't apply to earlier days.
  const applies = (item) => (item.since || campaign.startDate) <= day.date
  const rituals = campaign.rituals.filter(applies)
  const distractions = campaign.distractions.filter(applies)
  const total = rituals.length + day.todos.length + distractions.length
  const focusedToday = day.todos.reduce((sum, t) => sum + (focus[t._id] || 0), 0)
  const addLine = (key, text) => onUpdate({ [key]: [...campaign[key], { _id: objectId(), text, since: today }] })
  const isFirst = day.date === campaign.startDate
  const isLast = day.date === campaign.endDate

  const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const setTodos = (todos) => onSaveDay(day.date, { todos })

  return (
    <section className="card camp-day" aria-labelledby="camp-day-title">
      <header className="camp-day-head">
        <div className="camp-day-nav">
          <motion.button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={isFirst}
            aria-label="Previous day" whileTap={{ scale: 0.85 }}>
            <ChevronLeft size={18} />
          </motion.button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={day.date} className="camp-day-title" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <span className="camp-day-num">Day {dayNumber}</span>
              <h2 id="camp-day-title">{dayLabel(day.date)}</h2>
            </motion.div>
          </AnimatePresence>
          <motion.button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={isLast}
            aria-label="Next day" whileTap={{ scale: 0.85 }}>
            <ChevronRight size={18} />
          </motion.button>
        </div>
        <div className="camp-day-badges">
          {day.date === today ? <span className="camp-chip is-active"><span className="live-dot" aria-hidden="true" />Today</span>
            : <button type="button" className="camp-chip is-link" onClick={() => onMove(0)}>Back to today</button>}
          <AnimatePresence>
            {day.won && (
              <motion.span className="camp-chip is-won" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }} transition={SPRING}>
                <Trophy size={12} aria-hidden="true" />Day won
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <ScoreRing day={day} total={total} future={future} celebrate={celebrate} />
      </header>

      <div className="camp-block">
        <h3 className="camp-block-title"><Crosshair size={15} aria-hidden="true" />Daily protocol
          <span className="camp-count">{rituals.filter((r) => ritualsDone.has(r._id)).length}/{rituals.length}</span>
        </h3>
        {future && rituals.length > 0 && <p className="camp-hint">Unlocks on the day. You can plan to-dos below.</p>}
        <ul className="camp-list">
          <AnimatePresence initial={false}>
            {rituals.map((r) => (
              <CheckRow key={r._id} text={r.text} done={ritualsDone.has(r._id)} disabled={future}
                onToggle={() => onSaveDay(day.date, { rituals: toggleIn(day.rituals, r._id) })}
                onRemove={() => onUpdate({ rituals: campaign.rituals.filter((x) => x._id !== r._id) })} />
            ))}
          </AnimatePresence>
        </ul>
        {!past && campaign.rituals.length < MAX_ITEMS && (
          <AddRow label="Add a daily action" placeholder="Add something you'll do every day"
            onAdd={(text) => addLine('rituals', text)} />
        )}
      </div>

      <div className="camp-block">
        <h3 className="camp-block-title"><Shield size={15} aria-hidden="true" />Distractions
          <span className="camp-count">{future ? '–' : `${distractions.length - day.slips.length}/${distractions.length} held`}</span>
        </h3>
        {!future && distractions.length > 0 && (
          <p className="camp-hint">Held by default. Tap the shield if one got you today. Be honest, it's your campaign.</p>
        )}
        <ul className="camp-list">
          <AnimatePresence initial={false}>
            {distractions.map((d) => (
              <DistractionRow key={d._id} item={d} slipped={slips.has(d._id)} disabled={future}
                onToggle={() => onSaveDay(day.date, { slips: toggleIn(day.slips, d._id) })}
                onRemove={() => onUpdate({ distractions: campaign.distractions.filter((x) => x._id !== d._id) })} />
            ))}
          </AnimatePresence>
        </ul>
        {!past && campaign.distractions.length < MAX_ITEMS && (
          <AddRow label="Add a distraction" placeholder="Add a distraction to stay away from"
            onAdd={(text) => addLine('distractions', text)} />
        )}
      </div>

      <div className="camp-block">
        <h3 className="camp-block-title"><Swords size={15} aria-hidden="true" />{future ? 'Planned to-dos' : "Day's to-dos"}
          <span className="camp-count">
            {focusedToday > 0 && <span className="camp-count-time">{formatDuration(focusedToday)} focused · </span>}
            {day.todos.filter((t) => t.done).length}/{day.todos.length}
          </span>
        </h3>
        <ul className="camp-list">
          <AnimatePresence initial={false}>
            {day.todos.map((t) => (
              <CheckRow key={t._id} text={t.text} done={t.done} disabled={future}
                onToggle={() => setTodos(day.todos.map((x) => (x._id === t._id ? { ...x, done: !x.done } : x)))}
                onRemove={() => setTodos(day.todos.filter((x) => x._id !== t._id))}>
                <TodoFocus seconds={focus[t._id] || 0}
                  live={liveSession?.todo === t._id ? liveSession : null}
                  canStart={!future && !t.done && !liveSession} onStart={() => onFocus(t)} />
              </CheckRow>
            ))}
          </AnimatePresence>
        </ul>
        {day.todos.length < MAX_TODOS && (
          <AddRow label="Add a to-do" placeholder={future ? 'Plan a to-do for this day' : 'Add a to-do for this day'}
            onAdd={(text) => setTodos([...day.todos, { _id: objectId(), text, done: false }])} />
        )}
      </div>
    </section>
  )
}

const monthSlide = {
  enter: (dir) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -28 }),
}

function CalendarCard({ campaign, days, today, selected, onSelect }) {
  const [month, setMonth] = useState(monthOf(selected))
  const [dir, setDir] = useState(1)
  const [shownFor, setShownFor] = useState(selected)
  const firstMonth = monthOf(campaign.startDate)
  const lastMonth = monthOf(campaign.endDate)

  // Picking a day elsewhere (the strip, the arrows) brings its month into view.
  if (shownFor !== selected) {
    setShownFor(selected)
    const target = monthOf(selected)
    if (target !== month) {
      setDir(target > month ? 1 : -1)
      setMonth(target)
    }
  }

  const turn = (n) => {
    setDir(n)
    setMonth((m) => addMonths(m, n))
  }

  return (
    <section className="card camp-cal" aria-label="Calendar">
      <header className="camp-cal-head">
        <h3 className="camp-block-title"><CalendarDays size={15} aria-hidden="true" />Calendar</h3>
        <div className="camp-cal-nav">
          <motion.button type="button" className="icon-btn" onClick={() => turn(-1)} disabled={month <= firstMonth}
            aria-label="Previous month" whileTap={{ scale: 0.85 }}>
            <ChevronLeft size={16} />
          </motion.button>
          <span className="camp-cal-month">{monthLabel(month)}</span>
          <motion.button type="button" className="icon-btn" onClick={() => turn(1)} disabled={month >= lastMonth}
            aria-label="Next month" whileTap={{ scale: 0.85 }}>
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </header>

      <div className="camp-cal-week" aria-hidden="true">
        {WEEKDAY_INITIALS.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="camp-cal-stage">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div key={month} className="camp-cal-grid" custom={dir} variants={monthSlide} initial="enter" animate="center"
            exit="exit" transition={{ duration: 0.26, ease: EASE }}>
            {monthGrid(month).map((date, i) => {
              if (!date) return <span key={`pad-${i}`} className="camp-cell is-pad" />
              const inRange = date >= campaign.startDate && date <= campaign.endDate
              const day = days.get(date)
              const state = !inRange ? 'out' : date > today ? 'future' : day?.won ? 'won' : date === today ? 'today' : 'past'
              const label = `${dayLabel(date)}${inRange ? `, day ${daysBetween(campaign.startDate, date) + 1}` : ''}${day?.won ? ', won' : ''}`
              return (
                <motion.button key={date} type="button" disabled={!inRange} onClick={() => onSelect(date)}
                  className={`camp-cell is-${state} ${date === today ? 'is-today' : ''} ${date === selected ? 'is-selected' : ''}`}
                  style={{ '--s': day && state !== 'future' ? day.score : 0 }}
                  aria-label={label} aria-pressed={date === selected}
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: EASE, delay: i * 0.008 }} whileHover={inRange ? { y: -2 } : undefined}
                  whileTap={inRange ? { scale: 0.9 } : undefined}>
                  {date === selected && (
                    <motion.span layoutId="camp-cell-sel" className="camp-cell-sel" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
                  )}
                  <span className="camp-cell-num">{Number(date.slice(8))}</span>
                  {day?.won && <Trophy size={9} className="camp-cell-won" aria-hidden="true" />}
                  {state === 'future' && day?.todos.length > 0 && <span className="camp-cell-dot" aria-hidden="true" />}
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="camp-cal-legend" aria-hidden="true">
        <span><i className="is-won" />Won</span>
        <span><i className="is-partial" />Partly done</span>
        <span><i className="is-past" />Missed</span>
        <span><i className="is-future" />Ahead</span>
      </div>
    </section>
  )
}

function GoalsCard({ campaign, onUpdate }) {
  const reduceMotion = useReducedMotion()
  const [pops, setPops] = useState(0)
  const done = campaign.goals.filter((g) => g.done).length
  const total = campaign.goals.length
  const full = total > 0 && done === total

  const toggle = (goal) => {
    const goals = campaign.goals.map((g) => (g._id === goal._id ? { ...g, done: !g.done } : g))
    if (!goal.done && goals.every((g) => g.done)) setPops((n) => n + 1)
    onUpdate({ goals })
  }

  return (
    <section className="card camp-goals" aria-labelledby="camp-goals-title">
      <div className="checklist-head">
        <h3 id="camp-goals-title" className="camp-block-title"><Trophy size={15} aria-hidden="true" />Campaign goals</h3>
        <span className="checklist-count">{done}/{total}</span>
        {!reduceMotion && pops > 0 && <Burst key={pops} count={30} spread={260} height={110} />}
      </div>
      <div className="checklist-meter" aria-hidden="true">
        <motion.span className={full ? 'is-full' : ''} initial={false} animate={{ scaleX: total ? done / total : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
      </div>
      <ul className="camp-list">
        <AnimatePresence initial={false}>
          {campaign.goals.map((g) => (
            <CheckRow key={g._id} text={g.text} done={g.done} onToggle={() => toggle(g)}
              onRemove={() => onUpdate({ goals: campaign.goals.filter((x) => x._id !== g._id) })} />
          ))}
        </AnimatePresence>
      </ul>
      {total === 0 && <p className="camp-hint">What should this campaign get you? Add the goals you're fighting for.</p>}
      {total < MAX_ITEMS && (
        <AddRow label="Add a goal" placeholder="Add a goal"
          onAdd={(text) => onUpdate({ goals: [...campaign.goals, { _id: objectId(), text, done: false }] })} />
      )}
    </section>
  )
}

function Campaign({ id }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { upsertCampaign, removeCampaign, activeSession } = useAppData()
  const [today, setToday] = useState(localToday)
  const [campaign, setCampaign] = useState(null)
  const [days, setDays] = useState(() => new Map())
  const [selected, setSelected] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(location.state?.launched ? 'Campaign live. Make day one count.' : null)
  const [celebrate, setCelebrate] = useState(0)
  const [focus, setFocus] = useState({})
  const [focusTodo, setFocusTodo] = useState(null)

  const apply = useCallback((data) => {
    setCampaign(data.campaign)
    if (data.days) setDays(new Map(data.days.map((d) => [d.date, d])))
    if (data.focus) setFocus(data.focus)
    upsertCampaign(data.campaign)
  }, [upsertCampaign])

  useEffect(() => {
    api.get(`/campaigns/${id}?today=${today}`).then(({ data }) => {
      apply(data)
      setSelected((s) => s || clamp(today, data.campaign))
    }).catch((err) => {
      if (err.response?.status === 404) setMissing(true)
      else setError(getErrorMessage(err))
    })
  }, [id, today, apply])

  // Past midnight with the page open: move "today" on, which reloads.
  useEffect(() => {
    const onFocus = () => setToday(localToday())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const move = useCallback((n) => {
    if (!campaign) return
    setSelected((s) => clamp(n === 0 ? today : addDays(s, n), campaign))
  }, [campaign, today])

  // Arrow keys step through days when you're not typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 't') move(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  const saveDay = async (date, patch) => {
    setError('')
    const before = days.get(date) || emptyDay(date)
    setDays((map) => new Map(map).set(date, { ...before, ...patch }))
    try {
      const { data } = await api.put(`/campaigns/${id}/days/${date}`, { ...patch, today })
      setCampaign(data.campaign)
      upsertCampaign(data.campaign)
      setDays((map) => new Map(map).set(date, data.day))
      if (!before.won && data.day.won) {
        setCelebrate((n) => n + 1)
        const n = daysBetween(data.campaign.startDate, date) + 1
        setToast(date === today && data.campaign.streak > 1
          ? `Day ${n} won. ${data.campaign.streak}-day streak.`
          : `Day ${n} won.`)
      }
    } catch (err) {
      setDays((map) => new Map(map).set(date, before))
      setError(getErrorMessage(err))
    }
  }

  const update = async (patch) => {
    setError('')
    const before = campaign
    setCampaign({ ...campaign, ...patch })
    try {
      const { data } = await api.patch(`/campaigns/${id}`, { ...patch, today })
      apply(data)
    } catch (err) {
      setCampaign(before)
      setError(getErrorMessage(err))
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/campaigns/${id}`)
      removeCampaign(id)
      navigate('/campaigns')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (missing) {
    return (
      <Workspace title="Not found" folder="Campaigns">
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">🗺️</span>
          <h2>Campaign not found</h2>
          <p>It may have been deleted.</p>
          <Link to="/campaigns" className="btn btn-cta">All campaigns</Link>
        </div>
      </Workspace>
    )
  }

  if (!campaign || !selected) {
    return (
      <Workspace title="Campaign" folder="Campaigns" status="Loading…" wide>
        <div className="goal-skeleton"><span /><span /><span /></div>
      </Workspace>
    )
  }

  const day = days.get(selected) || emptyDay(selected)
  const status = campaign.status === 'active'
    ? `Day ${campaign.dayNumber} of ${campaign.totalDays} · ${plural(campaign.streak, 'day')} streak · ${plural(campaign.wins, 'win')}`
    : campaign.status === 'upcoming' ? `Starts ${shortDate(campaign.startDate)}` : `Complete · ${campaign.wins}/${campaign.totalDays} won`

  return (
    <Workspace title={campaign.name} folder="Campaigns" tabIcon={campaign.icon} status={status} wide>
      <div className="stagger camp-page">
        <Hero campaign={campaign} days={days} today={today} selected={selected} onSelect={setSelected}
          onUpdate={update} onDelete={remove} />
        <div className="camp-layout">
          <DayPanel campaign={campaign} day={day} today={today} celebrate={celebrate}
            focus={focus} liveSession={isOpen(activeSession) ? activeSession : null}
            onMove={move} onSaveDay={saveDay} onUpdate={update}
            onFocus={(t) => setFocusTodo({ campaign: id, date: day.date, _id: t._id, text: t.text, icon: campaign.icon })} />
          <div className="camp-side">
            <CalendarCard campaign={campaign} days={days} today={today} selected={selected} onSelect={setSelected} />
            <GoalsCard campaign={campaign} onUpdate={update} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {focusTodo && <StartSessionSheet todo={focusTodo} onClose={() => setFocusTodo(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast habit-toast" role="status" initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={SPRING}>
            <Trophy size={16} aria-hidden="true" />{toast}
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

// Keyed by id so moving between campaigns starts from a clean slate.
function CampaignPage() {
  const { id } = useParams()
  return <Campaign key={id} id={id} />
}

export default CampaignPage
