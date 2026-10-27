import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleAlert, ExternalLink, Link2, Pencil, Play, Plus, X } from 'lucide-react'
import api, { getErrorMessage } from '../../api'
import { embedUrl, loadYouTubeApi, thumbnailUrl, watchUrl } from '../../study'
import { formatClock } from '../../sessions'

const PLAYING = 1
const TIME_POLL_MS = 500

// Notes pinned to moments in the video. Typing a note grabs the current time and pauses the
// video; saving (or Escape) resumes it. Clicking a time jumps there.
function MomentNotes({ topicId, video, controls, onVideo }) {
  const [now, setNow] = useState(null)
  const [draft, setDraft] = useState('')
  const [at, setAt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const resumeAfter = useRef(false)
  const base = `/topics/${topicId}/videos/${video._id}/notes`

  // The live position, for the time chip and to mark the note the video is at.
  useEffect(() => {
    const t = setInterval(() => setNow(controls.time()), TIME_POLL_MS)
    return () => clearInterval(t)
  }, [controls])

  const capture = () => {
    setAt(Math.floor(controls.time() ?? 0))
    resumeAfter.current = controls.playing()
    controls.pause()
  }

  const close = () => {
    setDraft('')
    setAt(null)
    setError('')
    if (resumeAfter.current) controls.play()
    resumeAfter.current = false
  }

  const handleDraft = (e) => {
    if (at === null && e.target.value) capture()
    setDraft(e.target.value)
    if (!e.target.value) close()
  }

  const save = async (e) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      const { data } = await api.post(base, { at: at ?? Math.floor(controls.time() ?? 0), text: draft.trim() })
      onVideo(data.video)
      close()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    const text = editing.text.trim()
    const note = video.notes.find((n) => n._id === editing.id)
    setEditing(null)
    if (!text || text === note?.text) return
    try {
      const { data } = await api.patch(`${base}/${editing.id}`, { text })
      onVideo(data.video)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const remove = async (note) => {
    onVideo({ ...video, notes: video.notes.filter((n) => n._id !== note._id) })
    try {
      const { data } = await api.delete(`${base}/${note._id}`)
      onVideo(data.video)
    } catch (err) {
      onVideo(video)
      setError(getErrorMessage(err))
    }
  }

  const notes = [...(video.notes || [])].sort((a, b) => a.at - b.at)
  // The last note at or before where the video is.
  const currentId = now === null ? null : notes.filter((n) => n.at <= now + 0.5).at(-1)?._id

  return (
    <div className="moments">
      <form className="moment-add" onSubmit={save}>
        <button type="button" className={`moment-time ${at !== null ? 'is-held' : ''}`}
          onClick={capture} title="Use the video's current time">
          {formatClock(at ?? now ?? 0)}
        </button>
        <input className="property-value" value={draft} onChange={handleDraft} maxLength={2000}
          placeholder="Note at this moment… (the video pauses while you type)" aria-label="Note at this moment"
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())} />
        <button type="submit" className="btn" disabled={!draft.trim() || busy}>{busy ? 'Saving…' : 'Add'}</button>
      </form>
      {error && <p className="yt-add-error" role="alert"><CircleAlert size={14} aria-hidden="true" />{error}</p>}

      {notes.length > 0 && (
        <ol className="moment-list">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.li key={n._id} layout className={n._id === currentId ? 'is-current' : ''}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
                <button type="button" className="moment-time" onClick={() => controls.seek(n.at)}
                  title={`Play from ${formatClock(n.at)}`}>
                  {formatClock(n.at)}
                </button>
                {editing?.id === n._id ? (
                  <input className="property-value moment-edit" value={editing.text} autoFocus maxLength={2000}
                    aria-label="Edit note" onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) }
                    }} />
                ) : (
                  <span className="moment-text">{n.text}</span>
                )}
                <span className="moment-actions">
                  {editing?.id === n._id ? (
                    <button type="button" className="icon-btn" aria-label="Save note" onMouseDown={(e) => e.preventDefault()}
                      onClick={saveEdit}><Check size={14} /></button>
                  ) : (
                    <button type="button" className="icon-btn" aria-label="Edit note" title="Edit"
                      onClick={() => setEditing({ id: n._id, text: n.text })}><Pencil size={13} /></button>
                  )}
                  <button type="button" className="icon-btn moment-remove" aria-label="Delete note" title="Delete"
                    onClick={() => remove(n)}><X size={14} /></button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  )
}

// The embedded YouTube player for one video, driven through YouTube's IFrame API so notes can
// read the time and seek. With topicId and onVideo it shows the video's timestamped notes.
export function VideoPlayer({ video, autoplay = false, onOpenOutside, onClose, topicId, onVideo }) {
  const frameRef = useRef(null)
  const player = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (!cancelled && frameRef.current) player.current = new YT.Player(frameRef.current)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      player.current = null
    }
  }, [video._id])

  // Every call is a no-op until the player is ready, or if YouTube's API didn't load.
  const controls = useMemo(() => {
    const call = (fn, fallback) => {
      try {
        return typeof player.current?.getPlayerState === 'function' ? fn(player.current) : fallback
      } catch {
        return fallback
      }
    }
    return {
      time: () => call((p) => p.getCurrentTime(), null),
      playing: () => call((p) => p.getPlayerState() === PLAYING, false),
      pause: () => call((p) => p.pauseVideo()),
      play: () => call((p) => p.playVideo()),
      seek: (seconds) => call((p) => { p.seekTo(seconds, true); p.playVideo() }),
    }
  }, [])

  return (
    <div className="yt-player">
      <div className="yt-frame">
        <iframe ref={frameRef} key={video._id} src={embedUrl(video, { autoplay })} title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>
      <div className="yt-caption">
        <span className="yt-caption-title">{video.title}</span>
        <a href={watchUrl(video)} target="_blank" rel="noreferrer" className="yt-outside" onClick={onOpenOutside}>
          YouTube<ExternalLink size={13} aria-hidden="true" />
        </a>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close player" title="Close player">
            <X size={15} />
          </button>
        )}
      </div>
      {topicId && onVideo && <MomentNotes key={video._id} topicId={topicId} video={video} controls={controls} onVideo={onVideo} />}
    </div>
  )
}

// Paste a YouTube link to save it to the topic. Calls onAdded with the updated topic and the new video.
export function AddVideoForm({ topicId, onAdded, autoFocus = false }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/topics/${topicId}/videos`, { url: url.trim() })
      setUrl('')
      onAdded(data.topic, data.video)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="yt-add" onSubmit={submit}>
      <div className="yt-add-row">
        <span className="yt-add-field">
          <Link2 size={15} aria-hidden="true" />
          <input className="property-value" value={url} onChange={(e) => { setUrl(e.target.value); setError('') }}
            placeholder="Paste a YouTube link" aria-label="YouTube link" autoFocus={autoFocus}
            aria-invalid={Boolean(error)} inputMode="url" />
        </span>
        <button type="submit" className="btn" disabled={!url.trim() || busy}>
          {busy ? 'Adding…' : <><Plus size={15} aria-hidden="true" />Add</>}
        </button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p className="yt-add-error" role="alert" initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CircleAlert size={14} aria-hidden="true" />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  )
}

// The topic's videos as rows (topic page) or a horizontal strip (study panel).
// Picking one calls onSelect; the playing one is marked.
export function VideoList({ videos, activeId, onSelect, onRemove, strip = false }) {
  return (
    <ul className={`yt-list ${strip ? 'yt-strip' : ''}`}>
      <AnimatePresence initial={false}>
        {videos.map((v) => (
          <motion.li key={v._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={v._id === activeId ? 'is-playing' : ''}>
            <button type="button" className="yt-item" onClick={() => onSelect(v)} title={v.title}
              aria-current={v._id === activeId ? 'true' : undefined}>
              <span className="yt-thumb">
                <img src={thumbnailUrl(v)} alt="" loading="lazy" />
                <span className="yt-thumb-play" aria-hidden="true">
                  <Play size={16} />
                </span>
                {v.start > 0 && <span className="yt-start">{formatClock(v.start)}</span>}
              </span>
              <span className="yt-text">
                <span className="yt-title">{v.title}</span>
                {!strip && (v.channel || v.notes?.length > 0) && (
                  <span className="yt-channel">
                    {[v.channel, v.notes?.length && `${v.notes.length} note${v.notes.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
            {onRemove && (
              <button type="button" className="icon-btn yt-remove" onClick={() => onRemove(v)}
                aria-label={`Remove ${v.title}`} title="Remove video">
                <X size={14} />
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
