import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BellOff, CircleAlert, Plus, Timer, X } from 'lucide-react'
import api, { getErrorMessage } from '../../api'
import { useAppData } from '../../context/appDataContext'
import { APP_SUGGESTIONS, DURATION_PRESETS, defaultMinutes } from '../../sessions'
import { localToday } from '../../habits'

const MAX_APPS = 2

// Sets up a focus session: length, allowed apps, and a reminder to silence the device.
// Without a goal it starts a free session, with an optional label. With a campaign to-do
// ({ campaign, date, _id, text, icon }) the time goes to that to-do. With a study topic it starts
// a study session, which opens the topic's videos and notes beside the timer.
function StartSessionSheet({ goal = null, todo = null, topic = null, onClose }) {
  const navigate = useNavigate()
  const { me, setMe, setActiveSession } = useAppData()
  const [minutes, setMinutes] = useState(() => defaultMinutes(me?.personality?.workStyle))
  const [custom, setCustom] = useState(() => !DURATION_PRESETS.includes(defaultMinutes(me?.personality?.workStyle)))
  const [apps, setApps] = useState(me?.focusApps || [])
  const [draft, setDraft] = useState({ name: '', url: '' })
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveApps = async (next) => {
    setError('')
    try {
      const { data } = await api.put('/users/focus-apps', { apps: next })
      setApps(data.user.focusApps)
      setMe(data.user)
      return true
    } catch (err) {
      setError(getErrorMessage(err))
      return false
    }
  }

  const addApp = async (app) => {
    if (apps.length >= MAX_APPS) return
    const url = /^https?:\/\//i.test(app.url) ? app.url : `https://${app.url}`
    if (await saveApps([...apps, { name: app.name.trim(), url: url.trim() }])) setDraft({ name: '', url: '' })
  }

  const start = async () => {
    setStarting(true)
    setError('')
    // Fullscreen needs this click as its trigger, so request it before the network call.
    document.documentElement.requestFullscreen?.().catch(() => {})
    try {
      const { data } = goal
        ? await api.post(`/goals/${goal._id}/sessions`, { minutes })
        : todo
          ? await api.post(`/campaigns/${todo.campaign}/days/${todo.date}/todos/${todo._id}/sessions`, { minutes, today: localToday() })
          : topic
            ? await api.post(`/topics/${topic._id}/sessions`, { minutes })
            : await api.post('/sessions', { minutes, label })
      setActiveSession(data.session)
      navigate(`/focus/${data.session._id}`)
    } catch (err) {
      if (err.response?.status === 409 && err.response.data.session) {
        navigate(`/focus/${err.response.data.session._id}`)
        return
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      setError(getErrorMessage(err))
      setStarting(false)
    }
  }

  const suggestions = APP_SUGGESTIONS.filter((s) => !apps.some((a) => new URL(a.url).hostname === new URL(s.url).hostname))
  const validMinutes = Number.isInteger(minutes) && minutes >= 1 && minutes <= 240

  return (
    <motion.div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <div className="sheet-head">
          <div>
            <h2 id="sheet-title">{goal ? 'Start a focus session' : todo ? 'Focus on this to-do' : topic ? 'Start a study session' : 'Start a free session'}</h2>
            <p className="text-muted">
              {goal
                ? <><span className="sheet-goal-icon" aria-hidden="true">{goal.icon}</span>{goal.title}</>
                : todo
                  ? <><span className="sheet-goal-icon" aria-hidden="true">{todo.icon}</span>{todo.text}</>
                  : topic
                    ? <><span className="sheet-goal-icon" aria-hidden="true">{topic.icon}</span>{topic.title}</>
                    : 'Not tied to a goal. Good for deep work, study or clearing a backlog.'}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {!goal && !todo && !topic && (
          <section className="sheet-section">
            <label htmlFor="session-label" className="sheet-label">What are you working on? <span className="text-faint">Optional</span></label>
            <input id="session-label" className="property-value" value={label} maxLength={80} autoFocus
              placeholder="Deep work" onChange={(e) => setLabel(e.target.value)} />
          </section>
        )}

        <section className="sheet-section" aria-labelledby="len-title">
          <h3 id="len-title"><Timer size={15} aria-hidden="true" />How long?</h3>
          <div className="pills" role="radiogroup" aria-labelledby="len-title">
            {DURATION_PRESETS.map((m) => (
              <label key={m} className="pill">
                <input type="radio" name="minutes" checked={!custom && minutes === m}
                  onChange={() => { setCustom(false); setMinutes(m) }} />
                {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}
              </label>
            ))}
            <label className="pill">
              <input type="radio" name="minutes" checked={custom} onChange={() => setCustom(true)} />
              Custom
            </label>
          </div>
          <AnimatePresence initial={false}>
            {custom && (
              <motion.div className="custom-minutes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}>
                <input type="number" min={1} max={240} className="property-value" value={minutes || ''}
                  onChange={(e) => setMinutes(parseInt(e.target.value, 10))} aria-label="Minutes" autoFocus />
                <span className="text-muted">minutes (1 to 240)</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="sheet-section" aria-labelledby="apps-title">
          <h3 id="apps-title">Allowed apps <span className="sheet-count">{apps.length}/{MAX_APPS}</span></h3>
          <p className="sheet-help">Opening these during the session doesn't count as leaving focus.</p>
          <ul className="sheet-apps">
            <AnimatePresence initial={false}>
              {apps.map((app) => (
                <motion.li key={app.url} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                  <span className="focus-app-initial" aria-hidden="true">{app.name[0]}</span>
                  <span className="sheet-app-name">{app.name}</span>
                  <span className="sheet-app-url">{new URL(app.url).hostname}</span>
                  <button type="button" className="icon-btn" aria-label={`Remove ${app.name}`}
                    onClick={() => saveApps(apps.filter((a) => a.url !== app.url))}><X size={14} /></button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {apps.length < MAX_APPS && (
            <>
              <form className="sheet-add" onSubmit={(e) => { e.preventDefault(); if (draft.name && draft.url) addApp(draft) }}>
                <input className="property-value" placeholder="Name" value={draft.name} maxLength={40} aria-label="App name"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <input className="property-value" placeholder="docs.google.com" value={draft.url} aria-label="App link"
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
                <button type="submit" className="btn" disabled={!draft.name || !draft.url}><Plus size={15} aria-hidden="true" />Add</button>
              </form>
              {suggestions.length > 0 && (
                <div className="sheet-suggest">
                  {suggestions.map((s) => (
                    <button key={s.url} type="button" className="chip chip-button" onClick={() => addApp(s)}>
                      <Plus size={12} aria-hidden="true" />{s.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <div className="callout callout-info sheet-dnd">
          <p className="callout-title"><BellOff size={16} aria-hidden="true" />Turn on Do Not Disturb</p>
          <p className="sheet-dnd-text">
            A browser can't silence other apps, so switch on Do Not Disturb or a Focus mode on your phone or computer.
            LevelUp goes fullscreen, keeps your screen awake and counts every time you leave.
          </p>
        </div>

        {error && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title"><CircleAlert size={16} aria-hidden="true" />{error}</p>
          </div>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn btn-large btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-cta btn-large" onClick={start} disabled={starting || !validMinutes}>
            {starting ? 'Starting…' : `Enter focus · ${validMinutes ? minutes : '–'} min`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default StartSessionSheet
