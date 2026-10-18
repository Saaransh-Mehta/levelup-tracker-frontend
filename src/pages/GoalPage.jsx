import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CalendarDays, ChevronDown, CircleCheck, Flag, LayoutGrid, PartyPopper, Trash2, TrendingUp, X,
} from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import Burst from '../components/Burst'
import GoalEditor from '../components/editor/GoalEditor'
import SessionsCard from '../components/focus/SessionsCard'
import { countTasks } from '../components/editor/blocks'
import { useAppData } from '../context/appDataContext'
import { AREAS, QUICK_ICONS, STATUSES, areaOf, formatDate, progressPercent, relativeDate } from '../goals'

const EASE = [0.2, 0.8, 0.2, 1]
const TEXT_SAVE_DELAY = 700
const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

function ProgressRing({ pct, complete }) {
  return (
    <svg className="ring" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
      <circle className="ring-track" cx="70" cy="70" r={RING_R} />
      <motion.circle
        className={`ring-fill ${complete ? 'is-complete' : ''}`}
        cx="70"
        cy="70"
        r={RING_R}
        strokeDasharray={RING_C}
        initial={{ strokeDashoffset: RING_C }}
        animate={{ strokeDashoffset: RING_C * (1 - pct / 100) }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
      />
    </svg>
  )
}

function useOutsideClose(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return ref
}

function AreaPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, setOpen)
  const area = areaOf(value)
  const Icon = area?.icon

  return (
    <div className="popover-anchor" ref={ref}>
      <button type="button" className="prop-button" onClick={() => setOpen(!open)} aria-expanded={open}
        aria-haspopup="listbox" id="area-btn">
        {area ? <><Icon size={15} aria-hidden="true" />{area.label}</> : <span className="text-faint">Empty</span>}
        <ChevronDown size={14} className="prop-chevron" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul className="popover" role="listbox" aria-labelledby="area-btn"
            initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.15, ease: EASE }}>
            {AREAS.map((a) => {
              const AIcon = a.icon
              return (
                <li key={a.value}>
                  <button type="button" role="option" aria-selected={a.value === value}
                    className={`popover-item ${a.value === value ? 'is-selected' : ''}`}
                    onClick={() => { onChange(a.value); setOpen(false) }}>
                    <AIcon size={15} aria-hidden="true" />{a.label}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoalPage({ id }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { upsertGoal, removeGoal } = useAppData()
  const reduceMotion = useReducedMotion()

  const [goal, setGoal] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [saveState, setSaveState] = useState('saved')
  const [pickingIcon, setPickingIcon] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [celebrations, setCelebrations] = useState(0)
  const [toast, setToast] = useState(location.state?.created ? 'created' : null)

  const pending = useRef({})
  const timer = useRef(null)
  const lastSaved = useRef(null)
  const progressRef = useRef({ done: 0, total: 0 })
  const titleRef = useRef(null)
  const iconRef = useOutsideClose(pickingIcon, setPickingIcon)

  useEffect(() => {
    api.get(`/goals/${id}`)
      .then(({ data }) => {
        setGoal(data.goal)
        progressRef.current = data.goal.progress || { done: 0, total: 0 }
        setProgress(progressRef.current)
        lastSaved.current = data.goal
      })
      .catch((err) => setLoadError(err.response?.status === 404 ? 'not-found' : getErrorMessage(err)))
  }, [id])

  // The "goal created" toast shows once; clear it so a refresh doesn't repeat it.
  useEffect(() => {
    if (!toast) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const body = pending.current
    if (!Object.keys(body).length) return
    pending.current = {}
    setSaveState('saving')
    try {
      const { data } = await api.patch(`/goals/${id}`, body)
      lastSaved.current = data.goal
      upsertGoal(data.goal)
      setSaveState(Object.keys(pending.current).length ? 'unsaved' : 'saved')
    } catch {
      pending.current = { ...body, ...pending.current }
      setSaveState('error')
    }
  }, [id, upsertGoal])

  const queueSave = useCallback((fields, delay = 0) => {
    Object.assign(pending.current, fields)
    setSaveState('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }, [flush])

  // Save anything still pending when leaving the page.
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (Object.keys(pending.current).length) {
      api.patch(`/goals/${id}`, pending.current).then(({ data }) => upsertGoal(data.goal)).catch(() => {})
    }
  }, [id, upsertGoal])

  const update = (fields, delay = 0) => {
    setGoal((g) => ({ ...g, ...fields }))
    queueSave(fields, delay)
  }

  const handleDoc = useCallback((doc) => {
    const next = countTasks(doc)
    const prev = progressRef.current
    const wasComplete = prev.total > 0 && prev.done === prev.total
    if (next.total > 0 && next.done === next.total && !wasComplete) setCelebrations((n) => n + 1)
    progressRef.current = next
    setProgress(next)
    queueSave({ content: doc }, TEXT_SAVE_DELAY)
  }, [queueSave])

  // Grow the title box with its text.
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [goal?.title])

  const handleTitle = (e) => {
    const title = e.target.value.replace(/\n/g, '')
    setGoal((g) => ({ ...g, title }))
    if (title.trim()) queueSave({ title }, TEXT_SAVE_DELAY)
  }

  const deleteGoal = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3500)
      return
    }
    clearTimeout(timer.current)
    pending.current = {}
    try {
      await api.delete(`/goals/${id}`)
      removeGoal(id)
      navigate('/goals', { replace: true })
    } catch (err) {
      setLoadError(getErrorMessage(err))
    }
  }

  if (loadError === 'not-found') {
    return (
      <Workspace title="Not found" status=" ">
        <div className="stagger">
          <h1 className="inline-title">This goal doesn't exist</h1>
          <p className="lede">It may have been deleted, or the link is wrong.</p>
          <Link to="/goals" className="btn btn-large"><LayoutGrid size={16} aria-hidden="true" />All goals</Link>
        </div>
      </Workspace>
    )
  }

  if (!goal) {
    return (
      <Workspace title="Loading…" status="Loading…">
        {loadError ? (
          <div className="callout callout-error" role="alert"><p className="callout-title">{loadError}</p></div>
        ) : (
          <div className="goal-skeleton" aria-label="Loading goal">
            <span /><span /><span /><span />
          </div>
        )}
      </Workspace>
    )
  }

  const pct = progressPercent(progress)
  const complete = progress.total > 0 && progress.done === progress.total
  const saveLabel = {
    saved: 'Saved',
    unsaved: 'Editing…',
    saving: 'Saving…',
    error: 'Not saved, will retry',
  }[saveState]

  return (
    <Workspace title={goal.title.trim() || 'Untitled goal'} tabIcon={goal.icon} folder="Goals" status={saveLabel} wide>
      <div className="goal-page">
        <header className="goal-header stagger">
          <div className="goal-icon-wrap" ref={iconRef}>
            <button type="button" className="goal-icon" onClick={() => setPickingIcon(!pickingIcon)}
              aria-label={`Icon: ${goal.icon}. Change icon`} aria-expanded={pickingIcon}>
              <motion.span key={goal.icon} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
                {goal.icon}
              </motion.span>
            </button>
            <AnimatePresence>
              {pickingIcon && (
                <motion.div className="popover icon-popover" role="group" aria-label="Choose an icon"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: EASE }}>
                  {QUICK_ICONS.map((icon) => (
                    <button key={icon} type="button" className={`icon-option ${goal.icon === icon ? 'is-selected' : ''}`}
                      onClick={() => { update({ icon }); setPickingIcon(false) }} aria-label={icon}>
                      {icon}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <textarea ref={titleRef} className="inline-title title-edit" value={goal.title} onChange={handleTitle} rows={1}
            aria-label="Goal name" placeholder="Untitled goal" maxLength={200}
            onBlur={() => !goal.title.trim() && setGoal((g) => ({ ...g, title: lastSaved.current.title }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), document.querySelector('.goal-doc')?.focus())} />
        </header>

        <div className="goal-layout">
          <section className="card goal-main rise-in" aria-label="Goal notes">
            <GoalEditor content={goal.content} onChange={handleDoc} autoFocus={Boolean(location.state?.created)} />
          </section>

          <aside className="goal-side">
            <section className={`card side-card progress-card rise-in ${complete ? 'is-complete' : ''}`}
              aria-labelledby="progress-title" style={{ animationDelay: '80ms' }}>
              <h2 className="side-title" id="progress-title"><TrendingUp size={15} aria-hidden="true" />Progress</h2>
              <div className="ring-wrap">
                <ProgressRing pct={pct} complete={complete} />
                <span className="ring-label">
                  <span className="ring-pct">{pct}%</span>
                  <span className="ring-sub">{progress.total ? `${progress.done} of ${progress.total}` : 'no to-dos'}</span>
                </span>
                {!reduceMotion && celebrations > 0 && <Burst key={celebrations} />}
              </div>
              <p className="ring-caption" aria-live="polite">
                {!progress.total
                  ? 'Add a to-do in the note to start tracking.'
                  : goal.status === 'done'
                    ? 'Goal completed. Well done.'
                    : complete
                      ? 'Every milestone is done.'
                      : `${progress.total - progress.done} milestone${progress.total - progress.done === 1 ? '' : 's'} to go.`}
              </p>
              <AnimatePresence initial={false}>
                {complete && goal.status !== 'done' && (
                  <motion.div className="complete-action"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                    <button type="button" className="btn btn-cta btn-block" onClick={() => update({ status: 'done' })}>
                      <PartyPopper size={16} aria-hidden="true" />Mark goal as done
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <SessionsCard goal={goal} style={{ animationDelay: '120ms' }} />

            <section className="card side-card rise-in" aria-labelledby="details-title" style={{ animationDelay: '160ms' }}>
              <h2 className="side-title" id="details-title"><Flag size={15} aria-hidden="true" />Details</h2>
              <div className="side-prop">
                <span className="side-key">Area</span>
                <AreaPicker value={goal.area} onChange={(area) => update({ area })} />
              </div>
              <div className="side-prop">
                <label htmlFor="targetDate" className="side-key">Target date</label>
                <div className="prop-inline">
                  <input id="targetDate" type="date" className="property-value prop-date"
                    value={goal.targetDate ? goal.targetDate.slice(0, 10) : ''}
                    onChange={(e) => update({ targetDate: e.target.value || null })} />
                  {goal.targetDate && (
                    <button type="button" className="icon-btn" onClick={() => update({ targetDate: null })}
                      aria-label="Remove target date" title="Remove target date"><X size={14} /></button>
                  )}
                </div>
                {goal.targetDate && (
                  <span className="side-hint"><CalendarDays size={13} aria-hidden="true" />{relativeDate(goal.targetDate)}</span>
                )}
              </div>
              <div className="side-prop">
                <span className="side-key" id="status-key">Status</span>
                <div className="segmented segmented-small" role="radiogroup" aria-labelledby="status-key">
                  {STATUSES.map((s) => (
                    <button key={s.value} type="button" role="radio" aria-checked={goal.status === s.value}
                      className="segmented-btn" onClick={() => update({ status: s.value })}>
                      {goal.status === s.value && (
                        <motion.span layoutId="status-pill" className={`segmented-pill pill-${s.value}`}
                          transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                      )}
                      <span className="segmented-label">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="side-prop side-meta">
                <span>Created {formatDate(goal.createdAt)}</span>
              </div>
            </section>

            <button type="button" className={`btn btn-ghost btn-danger delete-goal ${confirmDelete ? 'is-armed' : ''}`}
              onClick={deleteGoal}>
              <Trash2 size={15} aria-hidden="true" />{confirmDelete ? 'Click again to delete' : 'Delete goal'}
            </button>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status"
            initial={{ opacity: 0, x: 24, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <CircleCheck size={16} aria-hidden="true" />
            <span>Goal created. Type <kbd>/</kbd> in the note to add blocks.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Workspace>
  )
}

// Remount per goal so state and pending saves never leak between goals.
export default function GoalRoute() {
  const { id } = useParams()
  return <GoalPage key={id} id={id} />
}
