import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, Plus, Timer } from 'lucide-react'
import Workspace from '../components/Workspace'
import { useAppData } from '../context/appDataContext'
import { areaOf, progressPercent, relativeDate } from '../goals'
import { formatDuration } from '../sessions'

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'active', label: 'Active', match: (g) => g.status === 'active' },
  { id: 'paused', label: 'Paused', match: (g) => g.status === 'paused' },
  { id: 'done', label: 'Done', match: (g) => g.status === 'done' },
]

const EASE = [0.2, 0.8, 0.2, 1]

function GoalCard({ goal, index }) {
  const area = areaOf(goal.area)
  const AreaIcon = area?.icon
  const pct = progressPercent(goal.progress)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.05 }}
    >
      <Link to={`/goals/${goal._id}`} className={`goal-card status-${goal.status}`}>
        <span className="goal-card-icon" aria-hidden="true">{goal.icon}</span>
        <span className="goal-card-title">{goal.title}</span>
        <span className="goal-card-meta">
          {area && (
            <span className="chip">
              <AreaIcon size={13} aria-hidden="true" />{area.label}
            </span>
          )}
          {goal.status !== 'active' && <span className={`chip chip-${goal.status}`}>{goal.status}</span>}
          {goal.sessions?.count > 0 && (
            <span className="goal-card-date" title="Focus sessions">
              <Timer size={13} aria-hidden="true" />{goal.sessions.count} · {formatDuration(goal.sessions.seconds)}
            </span>
          )}
          {goal.targetDate && (
            <span className="goal-card-date">
              <CalendarDays size={13} aria-hidden="true" />{relativeDate(goal.targetDate)}
            </span>
          )}
        </span>
        <span className="goal-card-progress">
          <span className={`progress-track ${pct === 100 ? 'is-complete' : ''}`} aria-hidden="true">
            <motion.span
              className="progress-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: pct / 100 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.25 + index * 0.05 }}
            />
          </span>
          <span className="progress-text">
            {goal.progress?.total ? `${goal.progress.done}/${goal.progress.total}` : 'No milestones'}
          </span>
        </span>
      </Link>
    </motion.li>
  )
}

function GoalsIndex() {
  const { goals } = useAppData()
  const [filter, setFilter] = useState('all')

  const list = goals || []
  const shown = list.filter(FILTERS.find((f) => f.id === filter).match)
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, list.filter(f.match).length]))

  const status = goals === null ? 'Loading…' : `${list.length} goal${list.length === 1 ? '' : 's'}`

  return (
    <Workspace title="Goals" status={status} wide>
      <div className="stagger">
        <div className="page-head">
          <h1 className="inline-title">Goals</h1>
          {list.length > 0 && (
            <Link to="/goals/new" className="btn btn-cta">
              <Plus size={16} aria-hidden="true" />New goal
            </Link>
          )}
        </div>
        <p className="lede">
          {list.length
            ? `${counts.active} active, ${counts.done} done. Open a goal to plan it out and tick off milestones.`
            : 'What you want to achieve, broken into steps you can actually tick off.'}
        </p>

        {goals === null ? (
          <ul className="goal-grid" aria-label="Loading goals">
            {[0, 1, 2].map((i) => <li key={i} className="goal-card skeleton" />)}
          </ul>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">🎯</span>
            <h2>No goals yet</h2>
            <p>Start with one thing you want to get done in the next few months. We'll walk you through it in six short steps.</p>
            <Link to="/goals/new" className="btn btn-cta btn-large">
              <Plus size={16} aria-hidden="true" />Create your first goal
            </Link>
          </div>
        ) : (
          <>
            <div className="segmented" role="tablist" aria-label="Filter goals">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className="segmented-btn"
                  onClick={() => setFilter(f.id)}
                >
                  {filter === f.id && (
                    <motion.span layoutId="filter-pill" className="segmented-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                  <span className="segmented-label">{f.label}</span>
                  <span className="segmented-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            <ul className="goal-grid">
              <AnimatePresence mode="popLayout">
                {shown.map((g, i) => <GoalCard key={g._id} goal={g} index={i} />)}
              </AnimatePresence>
            </ul>
            {shown.length === 0 && (
              <p className="text-muted filter-empty">No {filter} goals.</p>
            )}
          </>
        )}
      </div>
    </Workspace>
  )
}

export default GoalsIndex
