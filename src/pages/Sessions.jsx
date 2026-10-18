import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChevronDown, Eye, NotebookPen, Play, Timer } from 'lucide-react'
import api from '../api'
import Workspace from '../components/Workspace'
import Eyes from '../components/focus/Eyes'
import StartSessionSheet from '../components/focus/StartSessionSheet'
import { useAppData } from '../context/appDataContext'
import { formatDuration, isOpen, sessionWhen } from '../sessions'

const RECENT = 5
const EASE = [0.2, 0.8, 0.2, 1]

function SessionRow({ session, index, open, onToggle }) {
  const goal = session.goal
  const title = goal?.title || session.label || 'Free focus'
  const hasNotes = Boolean(session.notes.trim())

  return (
    <motion.li className={`session-row ${open ? 'is-open' : ''}`} initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: 0.1 + index * 0.05 }}>
      <button type="button" className="session-row-main" onClick={onToggle} aria-expanded={open}
        disabled={!hasNotes && !goal}>
        <span className="session-row-icon" aria-hidden="true">
          {goal ? <span className="session-row-emoji">{goal.icon}</span> : <Timer size={18} />}
        </span>
        <span className="session-row-text">
          <span className="session-row-title">{title}</span>
          <span className="session-row-sub">{sessionWhen(session.startedAt)} · {goal ? 'Goal' : 'Free session'}</span>
        </span>
        <span className="session-row-flags">
          {hasNotes && <NotebookPen size={14} aria-label="Has notes" />}
          {session.distractions > 0 && (
            <span className="session-left" title="Times you left the app">
              <Eye size={14} aria-hidden="true" />{session.distractions}
            </span>
          )}
        </span>
        <span className="session-row-dur">{formatDuration(session.focusedSeconds)}</span>
        {(hasNotes || goal) && <ChevronDown size={16} className="session-row-chevron" aria-hidden="true" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="session-row-detail" initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="session-row-inner">
              {hasNotes ? <p className="session-notes">{session.notes}</p> : <p className="text-faint">No notes for this session.</p>}
              {goal && (
                <Link to={`/goals/${goal._id}`} className="btn btn-ghost">Open goal<ArrowRight size={14} aria-hidden="true" /></Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Sessions() {
  const { goals, activeSession } = useAppData()
  const [data, setData] = useState(null)
  // undefined: closed. null: free session. A goal object: that goal's session.
  const [sheetFor, setSheetFor] = useState(undefined)
  const [openRow, setOpenRow] = useState(null)

  useEffect(() => {
    api.get(`/sessions?limit=${RECENT}`).then(({ data: d }) => setData(d))
      .catch(() => setData({ sessions: [], stats: { count: 0, seconds: 0, todaySeconds: 0 } }))
  }, [])

  const live = isOpen(activeSession) ? activeSession : null
  const activeGoals = (goals || []).filter((g) => g.status === 'active').slice(0, 6)
  const stats = data?.stats

  return (
    <Workspace title="Focus sessions" folder="Sessions" wide
      status={stats ? `${stats.count} session${stats.count === 1 ? '' : 's'}` : 'Loading…'}>
      <div className="stagger">
        <h1 className="inline-title">Focus sessions</h1>
        <p className="lede">Time you've spent focused, on goals or on anything else.</p>

        {live && (
          <Link to={`/focus/${live._id}`} className="live-banner">
            <span className="live-dot" aria-hidden="true" />
            <span>
              {live.status === 'paused' ? 'A session is paused.' : 'A session is running.'} Return to it
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}

        <div className="sessions-top">
          <section className="card focus-hero" aria-labelledby="free-title">
            <div className="hero-eyes"><Eyes mood="focus" /></div>
            <div className="hero-body">
              <h2 id="free-title">Free focus</h2>
              <p>A session that isn't tied to a goal: deep work, study, clearing a backlog.</p>
              <motion.button type="button" className="btn btn-cta btn-large" onClick={() => setSheetFor(null)}
                disabled={Boolean(live)} whileTap={{ scale: 0.97 }}>
                <Play size={16} aria-hidden="true" />Start free session
              </motion.button>
              {activeGoals.length > 0 && (
                <div className="hero-goals">
                  <span className="hero-goals-label">Or focus on a goal</span>
                  <div className="hero-goal-chips">
                    {activeGoals.map((g) => (
                      <button key={g._id} type="button" className="goal-chip" onClick={() => setSheetFor(g)}
                        disabled={Boolean(live)}>
                        <span className="goal-chip-icon" aria-hidden="true">{g.icon}</span>{g.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card stat-card" aria-label="Totals">
            <div className="stat-tile">
              <span className="stat-num">{stats ? formatDuration(stats.todaySeconds) : '–'}</span>
              <span className="stat-label">focused today</span>
            </div>
            <div className="stat-tile">
              <span className="stat-num">{stats ? stats.count : '–'}</span>
              <span className="stat-label">sessions in total</span>
            </div>
            <div className="stat-tile">
              <span className="stat-num">{stats ? formatDuration(stats.seconds) : '–'}</span>
              <span className="stat-label">focused in total</span>
            </div>
          </section>
        </div>

        <section className="recent-sessions" aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">Recent sessions</h2>
          {data === null ? (
            <div className="goal-skeleton"><span /><span /><span /></div>
          ) : data.sessions.length === 0 ? (
            <p className="text-muted">No sessions yet. Your last {RECENT} will show up here.</p>
          ) : (
            <ul className="session-rows">
              {data.sessions.map((s, i) => (
                <SessionRow key={s._id} session={s} index={i} open={openRow === s._id}
                  onToggle={() => setOpenRow(openRow === s._id ? null : s._id)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {createPortal(
        <AnimatePresence>
          {sheetFor !== undefined && <StartSessionSheet goal={sheetFor} onClose={() => setSheetFor(undefined)} />}
        </AnimatePresence>,
        document.body,
      )}
    </Workspace>
  )
}

export default Sessions
