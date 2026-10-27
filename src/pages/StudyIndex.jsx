import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CirclePlay, Clock, Plus } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import { useAppData } from '../context/appDataContext'
import { formatDuration, sessionWhen } from '../sessions'
import { STUDY_ICONS } from '../study'
import useOutsideClose from '../useOutsideClose'

const EASE = [0.2, 0.8, 0.2, 1]

function TopicCard({ topic, index }) {
  const videos = topic.videos?.length || 0
  const { seconds, lastAt } = topic.sessions || {}

  return (
    <motion.li layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.05 }}>
      <Link to={`/study/${topic._id}`} className="goal-card topic-card">
        <span className="goal-card-icon" aria-hidden="true">{topic.icon}</span>
        <span className="goal-card-title">{topic.title}</span>
        <span className="goal-card-meta">
          <span className="goal-card-date">
            <CirclePlay size={13} aria-hidden="true" />{videos} video{videos === 1 ? '' : 's'}
          </span>
          {seconds > 0 && (
            <span className="goal-card-date" title="Time studied">
              <Clock size={13} aria-hidden="true" />{formatDuration(seconds)}
            </span>
          )}
        </span>
        <span className="topic-card-last">{lastAt ? `Last studied ${sessionWhen(lastAt)}` : 'Not studied yet'}</span>
      </Link>
    </motion.li>
  )
}

// A one-line form: pick an icon, name the topic, and go straight to its page.
function NewTopicForm({ autoFocus }) {
  const navigate = useNavigate()
  const { upsertTopic } = useAppData()
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState(STUDY_ICONS[0])
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const pickerRef = useOutsideClose(picking, setPicking)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/topics', { title: title.trim(), icon })
      upsertTopic(data.topic)
      navigate(`/study/${data.topic._id}`, { state: { created: true } })
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="card new-topic" onSubmit={submit} id="new">
      <div className="new-topic-row">
        <div className="popover-anchor" ref={pickerRef}>
          <button type="button" className="new-topic-icon" onClick={() => setPicking(!picking)}
            aria-label={`Icon: ${icon}. Change icon`} aria-expanded={picking}>
            {icon}
          </button>
          <AnimatePresence>
            {picking && (
              <motion.div className="popover icon-popover" role="group" aria-label="Choose an icon"
                initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: EASE }}>
                {STUDY_ICONS.map((i) => (
                  <button key={i} type="button" className={`icon-option ${icon === i ? 'is-selected' : ''}`}
                    onClick={() => { setIcon(i); setPicking(false); inputRef.current?.focus() }} aria-label={i}>
                    {i}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <input ref={inputRef} className="property-value" value={title} maxLength={120}
          onChange={(e) => setTitle(e.target.value)} placeholder="What are you studying? e.g. Binary trees"
          aria-label="Topic name" />
        <button type="submit" className="btn btn-cta" disabled={!title.trim() || busy}>
          <Plus size={16} aria-hidden="true" />{busy ? 'Creating…' : 'New topic'}
        </button>
      </div>
      {error && <p className="yt-add-error" role="alert">{error}</p>}
    </form>
  )
}

function StudyIndex() {
  const { topics } = useAppData()
  const { hash } = useLocation()
  const list = topics || []
  const totalSeconds = list.reduce((sum, t) => sum + (t.sessions?.seconds || 0), 0)

  const status = topics === null ? 'Loading…' : `${list.length} topic${list.length === 1 ? '' : 's'}`

  return (
    <Workspace title="Study" folder="Study" status={status} wide>
      <div className="stagger">
        <h1 className="inline-title">Study</h1>
        <p className="lede">
          {list.length
            ? `${list.length} topic${list.length === 1 ? '' : 's'}${totalSeconds ? `, ${formatDuration(totalSeconds)} studied` : ''}. Each one keeps your notes and the videos you learn from.`
            : 'One page per topic: your notes and the YouTube videos you learn from, side by side, with a timer when you sit down to study.'}
        </p>

        <NewTopicForm key={hash} autoFocus={hash === '#new' || (topics !== null && list.length === 0)} />

        {topics === null ? (
          <ul className="goal-grid" aria-label="Loading topics">
            {[0, 1, 2].map((i) => <li key={i} className="goal-card skeleton" />)}
          </ul>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">📚</span>
            <h2>No topics yet</h2>
            <p>Name the first thing you're studying above. You can add YouTube links and notes to it straight after.</p>
          </div>
        ) : (
          <ul className="goal-grid">
            <AnimatePresence mode="popLayout">
              {list.map((t, i) => <TopicCard key={t._id} topic={t} index={i} />)}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Workspace>
  )
}

export default StudyIndex
