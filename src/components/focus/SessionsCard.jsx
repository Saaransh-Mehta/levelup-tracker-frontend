import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, NotebookPen, Play, Timer } from 'lucide-react'
import api from '../../api'
import { useAppData } from '../../context/appDataContext'
import { formatDuration, isOpen, sessionWhen } from '../../sessions'
import StartSessionSheet from './StartSessionSheet'

const RECENT = 4

// Session count, total focused time and recent sessions for one goal, plus the way in.
function SessionsCard({ goal, style }) {
  const { activeSession } = useAppData()
  const [data, setData] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    api.get(`/goals/${goal._id}/sessions`).then(({ data: d }) => setData(d)).catch(() => setData({ sessions: [], stats: { count: 0, seconds: 0 } }))
  }, [goal._id])

  const runningHere = isOpen(activeSession) && activeSession.goal === goal._id
  const runningElsewhere = isOpen(activeSession) && !runningHere
  const recent = (data?.sessions || []).filter((s) => s.status === 'completed').slice(0, RECENT)

  return (
    <section className="card side-card sessions-card rise-in" aria-labelledby="sessions-title" style={style}>
      <h2 className="side-title" id="sessions-title"><Timer size={15} aria-hidden="true" />Focus sessions</h2>

      <div className="session-stats">
        <div>
          <span className="session-num">{data ? data.stats.count : '–'}</span>
          <span className="session-label">sessions</span>
        </div>
        <div>
          <span className="session-num">{data ? formatDuration(data.stats.seconds) : '–'}</span>
          <span className="session-label">focused</span>
        </div>
      </div>

      {runningHere ? (
        <Link to={`/focus/${activeSession._id}`} className="btn btn-cta btn-block session-live">
          <span className="live-dot" aria-hidden="true" />
          {activeSession.status === 'paused' ? 'Paused · return to focus' : 'Running · return to focus'}
        </Link>
      ) : runningElsewhere ? (
        <Link to={`/focus/${activeSession._id}`} className="btn btn-block">
          <span className="live-dot" aria-hidden="true" />Another session is running
        </Link>
      ) : (
        <motion.button type="button" className="btn btn-cta btn-block" onClick={() => setSheetOpen(true)}
          whileTap={{ scale: 0.97 }}>
          <Play size={15} aria-hidden="true" />Start focus session
        </motion.button>
      )}

      {recent.length > 0 && (
        <ul className="session-list">
          {recent.map((s, i) => (
            <motion.li key={s._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}>
              <span className="session-when">{sessionWhen(s.startedAt)}</span>
              <span className="session-flags">
                {s.notes.trim() && <NotebookPen size={13} aria-label="Has notes" />}
                {s.distractions > 0 && (
                  <span className="session-left" title="Times you left the app">
                    <Eye size={13} aria-hidden="true" />{s.distractions}
                  </span>
                )}
              </span>
              <span className="session-dur">{formatDuration(s.focusedSeconds)}</span>
            </motion.li>
          ))}
        </ul>
      )}

      {createPortal(
        <AnimatePresence>
          {sheetOpen && <StartSessionSheet goal={goal} onClose={() => setSheetOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  )
}

export default SessionsCard
