import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, ExternalLink, Link2, Play, Plus, X } from 'lucide-react'
import api, { getErrorMessage } from '../../api'
import { embedUrl, thumbnailUrl, watchUrl } from '../../study'
import { formatClock } from '../../sessions'

// The embedded YouTube player for one video. Remounts per video so switching starts fresh.
export function VideoPlayer({ video, autoplay = false, onOpenOutside, onClose }) {
  return (
    <div className="yt-player">
      <div className="yt-frame">
        <iframe key={video._id} src={embedUrl(video, { autoplay })} title={video.title}
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
                {!strip && v.channel && <span className="yt-channel">{v.channel}</span>}
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
