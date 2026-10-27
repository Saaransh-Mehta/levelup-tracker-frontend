import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, CirclePlay, CircleCheck, NotebookPen, Play, Timer, Trash2 } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import GoalEditor from '../components/editor/GoalEditor'
import StartSessionSheet from '../components/focus/StartSessionSheet'
import { AddVideoForm, VideoList, VideoPlayer } from '../components/study/Videos'
import { useAppData } from '../context/appDataContext'
import { formatDuration, isOpen, sessionWhen } from '../sessions'
import { STUDY_ICONS } from '../study'
import useOutsideClose from '../useOutsideClose'

const EASE = [0.2, 0.8, 0.2, 1]
const TEXT_SAVE_DELAY = 700

// Time studied, the way into a study session, and the last few sessions.
function StudyCard({ topic, stats, sessions, style }) {
  const { activeSession } = useAppData()
  const [sheetOpen, setSheetOpen] = useState(false)
  const runningHere = isOpen(activeSession) && activeSession.topic === topic._id
  const runningElsewhere = isOpen(activeSession) && !runningHere

  return (
    <section className="card side-card rise-in" aria-labelledby="study-title" style={style}>
      <h2 className="side-title" id="study-title"><Timer size={15} aria-hidden="true" />Study sessions</h2>

      <div className="session-stats">
        <div>
          <span className="session-num">{stats ? stats.count : '–'}</span>
          <span className="session-label">sessions</span>
        </div>
        <div>
          <span className="session-num">{stats ? formatDuration(stats.seconds) : '–'}</span>
          <span className="session-label">studied</span>
        </div>
      </div>

      {runningHere ? (
        <Link to={`/focus/${activeSession._id}`} className="btn btn-cta btn-block session-live">
          <span className="live-dot" aria-hidden="true" />
          {activeSession.status === 'paused' ? 'Paused · return to study' : 'Running · return to study'}
        </Link>
      ) : runningElsewhere ? (
        <Link to={`/focus/${activeSession._id}`} className="btn btn-block">
          <span className="live-dot" aria-hidden="true" />Another session is running
        </Link>
      ) : (
        <motion.button type="button" className="btn btn-cta btn-block" onClick={() => setSheetOpen(true)}
          whileTap={{ scale: 0.97 }}>
          <Play size={15} aria-hidden="true" />Start study session
        </motion.button>
      )}
      <p className="study-hint">Opens the timer with this topic's videos and notes beside it.</p>

      {sessions.length > 0 && (
        <ul className="session-list">
          {sessions.slice(0, 5).map((s, i) => (
            <motion.li key={s._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}>
              <span className="session-when">{sessionWhen(s.startedAt)}</span>
              <span className="session-dur">{formatDuration(s.focusedSeconds)}</span>
            </motion.li>
          ))}
        </ul>
      )}

      {createPortal(
        <AnimatePresence>
          {sheetOpen && <StartSessionSheet topic={topic} onClose={() => setSheetOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  )
}

function TopicPage({ id }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { upsertTopic, removeTopic } = useAppData()

  const [topic, setTopic] = useState(null)
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [pickingIcon, setPickingIcon] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [toast, setToast] = useState(location.state?.created ? 'created' : null)

  const pending = useRef({})
  const timer = useRef(null)
  const lastSaved = useRef(null)
  const titleRef = useRef(null)
  const playerRef = useRef(null)
  const iconRef = useOutsideClose(pickingIcon, setPickingIcon)

  useEffect(() => {
    api.get(`/topics/${id}`)
      .then(({ data }) => {
        setTopic(data.topic)
        setSessions(data.sessions)
        setStats(data.stats)
        lastSaved.current = data.topic
      })
      .catch((err) => setLoadError(err.response?.status === 404 ? 'not-found' : getErrorMessage(err)))
  }, [id])

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
      const { data } = await api.patch(`/topics/${id}`, body)
      lastSaved.current = data.topic
      upsertTopic(data.topic)
      setSaveState(Object.keys(pending.current).length ? 'unsaved' : 'saved')
    } catch {
      pending.current = { ...body, ...pending.current }
      setSaveState('error')
    }
  }, [id, upsertTopic])

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
      api.patch(`/topics/${id}`, pending.current).then(({ data }) => upsertTopic(data.topic)).catch(() => {})
    }
  }, [id, upsertTopic])

  const update = (fields, delay = 0) => {
    setTopic((t) => ({ ...t, ...fields }))
    queueSave(fields, delay)
  }

  const handleDoc = useCallback((doc) => queueSave({ content: doc }, TEXT_SAVE_DELAY), [queueSave])

  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [topic?.title])

  const handleTitle = (e) => {
    const title = e.target.value.replace(/\n/g, '')
    setTopic((t) => ({ ...t, title }))
    if (title.trim()) queueSave({ title }, TEXT_SAVE_DELAY)
  }

  // Video changes come back with the whole topic; only take its videos, so typed notes aren't replaced.
  const takeVideos = (saved) => {
    setTopic((t) => ({ ...t, videos: saved.videos }))
    upsertTopic({ ...saved, title: topic.title, icon: topic.icon })
  }

  // A video's timestamped notes changed: swap in the saved video.
  const updateVideo = useCallback((video) => {
    setTopic((t) => ({ ...t, videos: t.videos.map((v) => (v._id === video._id ? video : v)) }))
  }, [])

  const play = (video) => {
    setPlayingId(video._id)
    requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const removeVideo = async (video) => {
    const before = topic.videos
    setTopic((t) => ({ ...t, videos: t.videos.filter((v) => v._id !== video._id) }))
    if (playingId === video._id) setPlayingId(null)
    try {
      const { data } = await api.delete(`/topics/${id}/videos/${video._id}`)
      takeVideos(data.topic)
    } catch (err) {
      setTopic((t) => ({ ...t, videos: before }))
      setLoadError(getErrorMessage(err))
    }
  }

  const deleteTopic = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3500)
      return
    }
    clearTimeout(timer.current)
    pending.current = {}
    try {
      await api.delete(`/topics/${id}`)
      removeTopic(id)
      navigate('/study', { replace: true })
    } catch (err) {
      setLoadError(getErrorMessage(err))
    }
  }

  if (loadError === 'not-found') {
    return (
      <Workspace title="Not found" folder="Study" status=" ">
        <div className="stagger">
          <h1 className="inline-title">This topic doesn't exist</h1>
          <p className="lede">It may have been deleted, or the link is wrong.</p>
          <Link to="/study" className="btn btn-large"><BookOpen size={16} aria-hidden="true" />All topics</Link>
        </div>
      </Workspace>
    )
  }

  if (!topic) {
    return (
      <Workspace title="Loading…" folder="Study" status="Loading…">
        {loadError ? (
          <div className="callout callout-error" role="alert"><p className="callout-title">{loadError}</p></div>
        ) : (
          <div className="goal-skeleton" aria-label="Loading topic"><span /><span /><span /><span /></div>
        )}
      </Workspace>
    )
  }

  const playing = topic.videos.find((v) => v._id === playingId) || null
  const saveLabel = { saved: 'Saved', unsaved: 'Editing…', saving: 'Saving…', error: 'Not saved, will retry' }[saveState]

  return (
    <Workspace title={topic.title.trim() || 'Untitled topic'} tabIcon={topic.icon} folder="Study" status={saveLabel} wide>
      <div className="goal-page">
        <header className="goal-header stagger">
          <div className="goal-icon-wrap" ref={iconRef}>
            <button type="button" className="goal-icon" onClick={() => setPickingIcon(!pickingIcon)}
              aria-label={`Icon: ${topic.icon}. Change icon`} aria-expanded={pickingIcon}>
              <motion.span key={topic.icon} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 22 }}>
                {topic.icon}
              </motion.span>
            </button>
            <AnimatePresence>
              {pickingIcon && (
                <motion.div className="popover icon-popover" role="group" aria-label="Choose an icon"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: EASE }}>
                  {STUDY_ICONS.map((icon) => (
                    <button key={icon} type="button" className={`icon-option ${topic.icon === icon ? 'is-selected' : ''}`}
                      onClick={() => { update({ icon }); setPickingIcon(false) }} aria-label={icon}>
                      {icon}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <textarea ref={titleRef} className="inline-title title-edit" value={topic.title} onChange={handleTitle} rows={1}
            aria-label="Topic name" placeholder="Untitled topic" maxLength={120}
            onBlur={() => !topic.title.trim() && setTopic((t) => ({ ...t, title: lastSaved.current.title }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), document.querySelector('.goal-doc')?.focus())} />
        </header>

        {loadError && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title">{loadError}</p>
          </div>
        )}

        <div className="goal-layout">
          <div className="topic-main">
            <AnimatePresence initial={false}>
              {playing && (
                <motion.section ref={playerRef} key="player" className="card topic-player" aria-label="Video player"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                  <div className="topic-player-inner">
                    <VideoPlayer key={playing._id} video={playing} autoplay onClose={() => setPlayingId(null)}
                      topicId={id} onVideo={updateVideo} />
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <section className="card goal-main rise-in" aria-labelledby="notes-title">
              <h2 className="topic-notes-title" id="notes-title"><NotebookPen size={15} aria-hidden="true" />Notes</h2>
              <GoalEditor content={topic.content} onChange={handleDoc} label="Topic notes" />
            </section>
          </div>

          <aside className="goal-side">
            <StudyCard topic={topic} stats={stats} sessions={sessions} style={{ animationDelay: '80ms' }} />

            <section className="card side-card rise-in" aria-labelledby="videos-title" style={{ animationDelay: '120ms' }}>
              <h2 className="side-title" id="videos-title">
                <CirclePlay size={15} aria-hidden="true" />Videos
                {topic.videos.length > 0 && <span className="sheet-count">{topic.videos.length}</span>}
              </h2>
              <AddVideoForm topicId={id} onAdded={(saved, video) => { takeVideos(saved); play(video) }}
                autoFocus={Boolean(location.state?.created)} />
              {topic.videos.length > 0 ? (
                <VideoList videos={topic.videos} activeId={playingId} onSelect={play} onRemove={removeVideo} />
              ) : (
                <p className="study-hint">Lectures, tutorials, explainers. Links with a timestamp start from that point.</p>
              )}
            </section>

            <button type="button" className={`btn btn-ghost btn-danger delete-goal ${confirmDelete ? 'is-armed' : ''}`}
              onClick={deleteTopic}>
              <Trash2 size={15} aria-hidden="true" />{confirmDelete ? 'Click again to delete' : 'Delete topic'}
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
            <span>Topic created. Paste a YouTube link to add your first video.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Workspace>
  )
}

// Remount per topic so state and pending saves never leak between topics.
export default function TopicRoute() {
  const { id } = useParams()
  return <TopicPage key={id} id={id} />
}
