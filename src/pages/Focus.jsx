import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft, AppWindow, BookOpen, Eye, ExternalLink, Maximize, Minimize, NotebookPen, Pause, Play, Plus, RotateCcw,
  Square, X,
} from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Eyes from '../components/focus/Eyes'
import TimerDigits from '../components/focus/TimerDigits'
import GoalEditor from '../components/editor/GoalEditor'
import { AddVideoForm, VideoList, VideoPlayer } from '../components/study/Videos'
import { useAppData } from '../context/appDataContext'
import { focusedAt, formatClock, formatDuration, isOpen } from '../sessions'
import { localToday } from '../habits'

const NOTES_SAVE_DELAY = 800
const GLARE_MS = 3800
// A leave within this long after opening an allowed app isn't a distraction.
const ALLOWED_LEAVE_MS = 8000
const EASE = [0.2, 0.8, 0.2, 1]

// A short two-note chime from the Web Audio API, so no sound file is needed.
const chime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.3)
    })
  } catch {
    // No audio available; the screen still shows the session is done.
  }
}

function Focus() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me, setActiveSession, refreshGoals, refreshTopics } = useAppData()

  const [session, setSession] = useState(null)
  const [goal, setGoal] = useState(null)
  const [todo, setTodo] = useState(null)
  // A study session's topic: its videos play and its notes are edited beside the timer.
  const [topic, setTopic] = useState(null)
  const [videoId, setVideoId] = useState(null)
  const [addingVideo, setAddingVideo] = useState(false)
  const [topicState, setTopicState] = useState('saved')
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [notesState, setNotesState] = useState('saved')
  const [panel, setPanel] = useState(null)
  const [glaring, setGlaring] = useState(false)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))
  const [busy, setBusy] = useState(false)

  const notesTimer = useRef(null)
  const topicTimer = useRef(null)
  const topicDoc = useRef(null)
  const allowedLeaveAt = useRef(0)
  const leftWhileRunning = useRef(false)
  const finishing = useRef(false)
  const live = useRef({ session: null, notes: '' })

  useEffect(() => {
    live.current = { session, notes }
  })

  const apply = useCallback((data) => {
    setSession(data.session)
    setOffset(data.serverNow - Date.now())
    setActiveSession(isOpen(data.session) ? data.session : null)
  }, [setActiveSession])

  useEffect(() => {
    api.get(`/sessions/${id}`)
      .then(({ data }) => {
        apply(data)
        setGoal(data.goal)
        setTodo(data.todo)
        setTopic(data.topic)
        setVideoId(data.topic?.videos[0]?._id || null)
        if (data.topic && isOpen(data.session)) setPanel('study')
        setNotes(data.session.notes)
      })
      .catch((err) => setError(err.response?.status === 404 ? 'This session no longer exists.' : getErrorMessage(err)))
  }, [id, apply])

  const patch = useCallback(async (body) => {
    const { data } = await api.patch(`/sessions/${id}`, body)
    apply(data)
    return data.session
  }, [id, apply])

  // Clock tick while running.
  const running = session?.status === 'running'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [running])

  const focused = focusedAt(session, offset, now)
  const remaining = session ? session.plannedSeconds - focused : 0
  const done = session && !isOpen(session)
  const title = goal?.title || topic?.title || session?.label || 'Free focus'
  const backTo = session?.goal
    ? `/goals/${session.goal}`
    : session?.campaign ? `/campaigns/${session.campaign}` : session?.topic ? `/study/${session.topic}` : '/sessions'
  const topicId = session?.topic || null
  const notesPanel = topicId ? 'study' : 'notes'

  // Topic notes save on their own timer, straight to the topic.
  const saveTopicDoc = useCallback(() => {
    clearTimeout(topicTimer.current)
    topicTimer.current = null
    const doc = topicDoc.current
    if (!doc || !topicId) return Promise.resolve()
    topicDoc.current = null
    setTopicState('saving')
    return api.patch(`/topics/${topicId}`, { content: doc })
      .then(() => setTopicState(topicDoc.current ? 'unsaved' : 'saved'))
      .catch(() => {
        topicDoc.current ??= doc
        setTopicState('error')
      })
  }, [topicId])

  const handleTopicDoc = useCallback((doc) => {
    topicDoc.current = doc
    setTopic((t) => ({ ...t, content: doc }))
    setTopicState('unsaved')
    clearTimeout(topicTimer.current)
    topicTimer.current = setTimeout(saveTopicDoc, NOTES_SAVE_DELAY)
  }, [saveTopicDoc])

  // Save unsaved topic notes when leaving.
  useEffect(() => () => {
    if (topicId && topicDoc.current) {
      clearTimeout(topicTimer.current)
      api.patch(`/topics/${topicId}`, { content: topicDoc.current }).catch(() => {})
    }
  }, [topicId])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    setBusy(true)
    try {
      clearTimeout(notesTimer.current)
      await Promise.all([patch({ action: 'finish', notes: live.current.notes }), saveTopicDoc()])
      chime()
      // The summary sits under the study panel on a phone, so get it out of the way.
      if (window.matchMedia('(max-width: 800px)').matches) setPanel((p) => (p === 'study' ? null : p))
      refreshGoals()
      if (topicId) refreshTopics()
    } catch (err) {
      setError(getErrorMessage(err))
      finishing.current = false
    } finally {
      setBusy(false)
    }
  }, [patch, refreshGoals, refreshTopics, saveTopicDoc, topicId])

  // Time's up.
  useEffect(() => {
    if (running && remaining <= 0) finish()
  }, [running, remaining, finish])

  const togglePause = useCallback(async () => {
    if (!session || done || busy) return
    setBusy(true)
    try {
      await patch({ action: session.status === 'running' ? 'pause' : 'resume' })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [session, done, busy, patch])

  // Leaving the app while the clock runs counts as a distraction, unless an allowed app was just opened.
  useEffect(() => {
    const onVisibility = () => {
      const s = live.current.session
      if (document.visibilityState === 'hidden') {
        leftWhileRunning.current = s?.status === 'running' && Date.now() - allowedLeaveAt.current > ALLOWED_LEAVE_MS
        return
      }
      if (!leftWhileRunning.current || !s) return
      leftWhileRunning.current = false
      setGlaring(true)
      patch({ distractions: s.distractions + 1 }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [patch])

  useEffect(() => {
    if (!glaring) return
    const t = setTimeout(() => setGlaring(false), GLARE_MS)
    return () => clearTimeout(t)
  }, [glaring])

  // Keep the screen awake while focusing.
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return
    let lock = null
    let cancelled = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then((l) => {
        if (cancelled) l.release()
        else lock = l
      }).catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [running])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Leave fullscreen when leaving the focus screen.
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  // The tab shows the clock.
  useEffect(() => {
    if (!session) return
    const previous = document.title
    document.title = done ? 'Session complete · LevelUp' : `${formatClock(remaining)} · ${title}`
    return () => {
      document.title = previous
    }
  })

  const handleNotes = (e) => {
    setNotes(e.target.value)
    setNotesState('unsaved')
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      setNotesState('saving')
      api.patch(`/sessions/${id}`, { notes: e.target.value })
        .then(() => setNotesState('saved'))
        .catch(() => setNotesState('error'))
    }, NOTES_SAVE_DELAY)
  }

  // Save unsaved notes when leaving.
  useEffect(() => () => {
    if (notesTimer.current) {
      clearTimeout(notesTimer.current)
      api.patch(`/sessions/${id}`, { notes: live.current.notes }).catch(() => {})
    }
  }, [id])

  // Space pauses, N opens notes (or the study panel), F toggles fullscreen — unless typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('textarea, input, [contenteditable="true"]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'n') {
        // Stop the key from also landing in the notes box that opens.
        e.preventDefault()
        setPanel((p) => (p === notesPanel ? null : notesPanel))
      } else if (e.key === 'f') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePause, notesPanel])

  const startAnother = async () => {
    setBusy(true)
    try {
      const minutes = Math.round(session.plannedSeconds / 60)
      const { data } = session.goal
        ? await api.post(`/goals/${session.goal}/sessions`, { minutes })
        : todo
          ? await api.post(`/campaigns/${todo.campaign._id}/days/${todo.date}/todos/${todo._id}/sessions`, { minutes, today: localToday() })
          : session.topic
            ? await api.post(`/topics/${session.topic}/sessions`, { minutes })
            : await api.post('/sessions', { minutes, label: session.label })
      finishing.current = false
      setActiveSession(data.session)
      navigate(`/focus/${data.session._id}`, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Ticks the campaign to-do this session was spent on, straight from the summary.
  const toggleTodo = async () => {
    const done = !todo.done
    setTodo({ ...todo, done })
    try {
      await api.patch(`/campaigns/${todo.campaign._id}/days/${todo.date}/todos/${todo._id}`, { done })
    } catch (err) {
      setTodo({ ...todo, done: !done })
      setError(getErrorMessage(err))
    }
  }

  if (error && !session) {
    return (
      <div className="focus">
        <main className="focus-center">
          <p className="focus-status">{error}</p>
          <Link to="/sessions" className="btn btn-large"><ArrowLeft size={16} aria-hidden="true" />Back to sessions</Link>
        </main>
      </div>
    )
  }

  const mood = !session ? 'idle' : done ? 'happy' : glaring ? 'glare' : session.status === 'paused' ? 'sleep' : 'focus'
  const statusText = {
    idle: 'Getting ready…',
    focus: 'Focusing',
    sleep: 'Paused. The eyes are resting until you are back.',
    glare: 'You left focus. Back to it.',
    happy: 'Session complete',
  }[mood]
  const apps = me?.focusApps || []
  const endsAt = running ? new Date(now + remaining * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null
  const pct = session ? Math.min(1, focused / session.plannedSeconds) : 0
  const studyOpen = panel === 'study'
  const playingVideo = topic?.videos.find((v) => v._id === videoId) || topic?.videos[0] || null

  return (
    <div className={`focus mood-${mood} ${panel ? 'has-panel' : ''} ${studyOpen ? 'has-study' : ''}`}>
      <div className="focus-ambient" aria-hidden="true" />

      <header className="focus-top">
        <Link to={backTo} className="focus-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="focus-goal">
            {(goal || todo?.campaign || topic) && (
              <span className="focus-goal-icon" aria-hidden="true">{(goal || todo?.campaign || topic).icon}</span>
            )}
            {title}
          </span>
        </Link>
        <div className="focus-tools">
          {session && (
            <span className={`focus-chip ${session.distractions ? 'is-warn' : ''}`}
              title="Times you left the app during this session">
              <Eye size={14} aria-hidden="true" />{session.distractions} left
            </span>
          )}
          {topic ? (
            <button type="button" className={`focus-icon-btn ${studyOpen ? 'is-on' : ''}`}
              onClick={() => setPanel(studyOpen ? null : 'study')} aria-pressed={studyOpen}
              aria-label="Videos and notes (N)" title="Videos and notes (N)">
              <BookOpen size={18} />
            </button>
          ) : (
            <button type="button" className={`focus-icon-btn ${panel === 'notes' ? 'is-on' : ''}`}
              onClick={() => setPanel(panel === 'notes' ? null : 'notes')} aria-pressed={panel === 'notes'}
              aria-label="Session notes (N)" title="Session notes (N)">
              <NotebookPen size={18} />
            </button>
          )}
          <button type="button" className={`focus-icon-btn ${panel === 'apps' ? 'is-on' : ''}`}
            onClick={() => setPanel(panel === 'apps' ? null : 'apps')} aria-pressed={panel === 'apps'}
            aria-label="Allowed apps" title="Allowed apps">
            <AppWindow size={18} />
          </button>
          <button type="button" className="focus-icon-btn" onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      <main className="focus-center">
        <Eyes mood={mood} />

        <AnimatePresence mode="wait">
          <motion.p key={mood} className="focus-status" role="status"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}>
            {statusText}
          </motion.p>
        </AnimatePresence>

        {session && !done && (
          <>
            <TimerDigits value={formatClock(remaining)} label={`${formatClock(remaining)} left`} />
            <p className="focus-meta">
              {formatDuration(session.plannedSeconds)} session{endsAt ? ` · ends at ${endsAt}` : ' · paused'}
            </p>
            <div className="focus-controls">
              <motion.button type="button" className="focus-main-btn" onClick={togglePause} disabled={busy}
                whileTap={{ scale: 0.92 }} aria-label={running ? 'Pause (Space)' : 'Resume (Space)'}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={running ? 'pause' : 'play'} initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.15 }}>
                    {running ? <Pause size={28} /> : <Play size={28} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <button type="button" className="btn btn-ghost focus-end" onClick={finish} disabled={busy}>
                <Square size={14} aria-hidden="true" />End session
              </button>
            </div>
          </>
        )}

        {done && (
          <motion.div className="focus-summary" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}>
            <div className="summary-stats">
              <div><span className="summary-num">{formatDuration(session.focusedSeconds)}</span><span>focused</span></div>
              <div><span className="summary-num">{session.distractions}</span><span>times you left</span></div>
              {topic ? (
                <div><span className="summary-num">{topicState === 'error' ? 'Not saved' : 'Saved'}</span><span>topic notes</span></div>
              ) : (
                <div><span className="summary-num">{notes.trim() ? 'Saved' : 'None'}</span><span>notes</span></div>
              )}
            </div>
            {session.status === 'abandoned' && (
              <p className="focus-meta">Sessions under a minute aren't counted.</p>
            )}
            {todo && (
              <motion.button type="button" className={`focus-todo ${todo.done ? 'is-done' : ''}`} onClick={toggleTodo}
                aria-pressed={todo.done} whileTap={{ scale: 0.96 }}>
                <span className="focus-todo-box" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <motion.path d="M6 12.5l4 4 8-9" initial={false} animate={{ pathLength: todo.done ? 1 : 0 }}
                      transition={{ duration: 0.3, ease: EASE }} />
                  </svg>
                </span>
                <span className="focus-todo-text">{todo.done ? 'Done: ' : 'Mark done: '}{todo.text}</span>
              </motion.button>
            )}
            <div className="focus-controls">
              <button type="button" className="btn btn-cta btn-large" onClick={startAnother} disabled={busy}>
                <RotateCcw size={16} aria-hidden="true" />Another {formatDuration(session.plannedSeconds)}
              </button>
              <Link to={backTo} className="btn btn-large">
                {session.goal ? 'Back to goal' : session.campaign ? 'Back to campaign' : session.topic ? 'Back to topic' : 'Back to sessions'}
              </Link>
            </div>
          </motion.div>
        )}

        {error && session && <p className="focus-error" role="alert">{error}</p>}
      </main>

      {/* Stays mounted while hidden, so a video keeps playing with the panel closed. */}
      {topic && (
        <motion.aside className="focus-panel study-panel" aria-label="Videos and notes" inert={!studyOpen}
          initial={false} animate={studyOpen ? { x: 0, opacity: 1 } : { x: 40, opacity: 0 }}
          style={{ pointerEvents: studyOpen ? 'auto' : 'none' }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <div className="focus-panel-head">
            <h2>Videos & notes</h2>
            {/* On a phone the panel covers the timer, so a small copy of it sits here. */}
            {session && !done && (
              <button type="button" className="study-clock" onClick={togglePause} disabled={busy}
                aria-label={running ? 'Pause (Space)' : 'Resume (Space)'}>
                {running ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                {formatClock(remaining)}
              </button>
            )}
            <span className="focus-panel-state">
              {{ saved: 'Saved', unsaved: 'Editing…', saving: 'Saving…', error: 'Not saved' }[topicState]}
            </span>
            <button type="button" className="focus-icon-btn" onClick={() => setPanel(null)} aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
          <div className="study-scroll">
            {playingVideo && (
              <VideoPlayer video={playingVideo} onOpenOutside={() => { allowedLeaveAt.current = Date.now() }}
                topicId={topic._id}
                onVideo={(video) => setTopic((t) => ({ ...t, videos: t.videos.map((v) => (v._id === video._id ? video : v)) }))} />
            )}
            <div className="study-videos">
              {topic.videos.length > 0 && (
                <VideoList videos={topic.videos} activeId={playingVideo?._id} onSelect={(v) => setVideoId(v._id)} strip />
              )}
              {topic.videos.length === 0 || addingVideo ? (
                <AddVideoForm topicId={topic._id} autoFocus={addingVideo}
                  onAdded={(saved, video) => {
                    setTopic((t) => ({ ...t, videos: saved.videos }))
                    setVideoId(video._id)
                    setAddingVideo(false)
                  }} />
              ) : (
                <button type="button" className="link-btn study-add-link" onClick={() => setAddingVideo(true)}>
                  <Plus size={14} aria-hidden="true" />Add a video
                </button>
              )}
            </div>
            <div className="study-notes">
              <GoalEditor content={topic.content} onChange={handleTopicDoc} label="Topic notes" />
            </div>
          </div>
        </motion.aside>
      )}

      <AnimatePresence>
        {panel && panel !== 'study' && (
          <motion.aside className="focus-panel" key="panel" aria-label={panel === 'notes' ? 'Session notes' : 'Allowed apps'}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <div className="focus-panel-head">
              <h2>{panel === 'notes' ? 'Session notes' : 'Allowed apps'}</h2>
              {panel === 'notes' && (
                <span className="focus-panel-state">
                  {{ saved: 'Saved', unsaved: 'Editing…', saving: 'Saving…', error: 'Not saved' }[notesState]}
                </span>
              )}
              <button type="button" className="focus-icon-btn" onClick={() => setPanel(null)} aria-label="Close panel">
                <X size={16} />
              </button>
            </div>
            {panel === 'notes' ? (
              <textarea className="focus-notes" value={notes} onChange={handleNotes} autoFocus
                placeholder="Thoughts, blockers, what to do next. Saved with this session." aria-label="Session notes" />
            ) : (
              <div className="focus-apps">
                {apps.length === 0 ? (
                  <p className="text-muted">
                    No apps allowed. Add up to two when you start a session.
                  </p>
                ) : (
                  apps.map((app) => (
                    <a key={app.url} href={app.url} target="_blank" rel="noreferrer" className="focus-app"
                      onClick={() => { allowedLeaveAt.current = Date.now() }}>
                      <span className="focus-app-initial" aria-hidden="true">{app.name[0]}</span>
                      <span className="focus-app-text">
                        <span>{app.name}</span>
                        <span className="focus-app-url">{new URL(app.url).hostname}</span>
                      </span>
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  ))
                )}
                <p className="focus-apps-note">
                  Opening these doesn't count as leaving. Anything else does, and the eyes will notice.
                </p>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="focus-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${pct})` }} />
      </div>
    </div>
  )
}

export default function FocusRoute() {
  const { id } = useParams()
  return <Focus key={id} />
}
