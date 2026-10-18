import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, CornerDownLeft, Plus, Rocket, X } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import { useAppData } from '../context/appDataContext'
import { localToday } from '../habits'
import { CAMPAIGN_ICONS, DURATIONS, MAX_ITEMS, addDays, dayLabel, fromDay, plural, shortDate, toDay } from '../campaigns'

const STEPS = ['Name', 'Length', 'Goals', 'Distractions', 'Daily', 'Launch']
const EASE = [0.2, 0.8, 0.2, 1]
const MAX_CUSTOM_DAYS = 365

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -48 }),
}

const nextMonday = (today) => {
  const d = fromDay(today)
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7))
  return toDay(d)
}

// Rows of text where Enter adds a row below and Backspace on an empty row removes it.
function ListEditor({ rows, onChange, placeholders, label, tone }) {
  const refs = useRef([])
  const focusRow = useRef(null)
  const nextId = useRef(rows.length + 1)

  useLayoutEffect(() => {
    if (focusRow.current === null) return
    refs.current[focusRow.current]?.focus()
    focusRow.current = null
  })

  const setRow = (i, text) => onChange(rows.map((r, j) => (j === i ? { ...r, text } : r)))

  const add = (after = rows.length - 1) => {
    if (rows.length >= MAX_ITEMS) return
    const next = [...rows]
    next.splice(after + 1, 0, { id: `n${nextId.current++}`, text: '' })
    onChange(next)
    focusRow.current = after + 1
  }

  const remove = (i) => {
    if (rows.length === 1) return setRow(0, '')
    onChange(rows.filter((_, j) => j !== i))
    focusRow.current = Math.max(0, i - 1)
  }

  const keyDown = (e, i) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      add(i)
    } else if (e.key === 'Backspace' && !rows[i].text && rows.length > 1) {
      e.preventDefault()
      remove(i)
    }
  }

  return (
    <>
      <ol className={`milestone-list cw-list is-${tone}`}>
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.li key={r.id} className="milestone-row"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: EASE }}>
              <span className="milestone-num" aria-hidden="true">{i + 1}</span>
              <input ref={(el) => (refs.current[i] = el)} className="milestone-input" value={r.text} maxLength={200}
                onChange={(e) => setRow(i, e.target.value)} onKeyDown={(e) => keyDown(e, i)}
                placeholder={placeholders[i] || 'One more'} aria-label={`${label} ${i + 1}`}
                autoFocus={i === 0 && !r.text} />
              <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>
                <X size={14} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {rows.length < MAX_ITEMS && (
        <button type="button" className="add-row" onClick={() => add()}>
          <Plus size={16} aria-hidden="true" />Add another
        </button>
      )}
    </>
  )
}

// Full-screen countdown played once the campaign exists, then hands over to its page.
function LaunchOverlay({ name, onDone }) {
  const [count, setCount] = useState(3)
  const done = useRef(onDone)

  useEffect(() => {
    const t = setTimeout(() => (count > 0 ? setCount(count - 1) : done.current()), count > 0 ? 520 : 700)
    return () => clearTimeout(t)
  }, [count])

  return (
    <motion.div className="cw-launch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="status" aria-live="assertive">
      <motion.div className="cw-launch-ring" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }} />
      <AnimatePresence mode="popLayout">
        <motion.span key={count} className="cw-launch-count"
          initial={{ scale: 1.8, opacity: 0, filter: 'blur(8px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0.6, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
          {count > 0 ? count : 'GO'}
        </motion.span>
      </AnimatePresence>
      <motion.p className="cw-launch-name" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}>
        {name} starts now
      </motion.p>
    </motion.div>
  )
}

function NewCampaign() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const { upsertCampaign } = useAppData()
  const [today] = useState(localToday)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [draft, setDraft] = useState({
    name: '',
    icon: CAMPAIGN_ICONS[0],
    mission: '',
    start: 'today',
    length: 30,
    customLength: '',
    goals: [{ id: 'g1', text: '' }],
    distractions: [{ id: 'd1', text: '' }],
    rituals: [{ id: 'r1', text: '' }],
  })
  const [pickingIcon, setPickingIcon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [launched, setLaunched] = useState(null)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const custom = parseInt(draft.customLength, 10)
  const length = draft.length === 'custom'
    ? (Number.isInteger(custom) && custom >= 1 && custom <= MAX_CUSTOM_DAYS ? custom : 0)
    : draft.length
  const startDate = { today, tomorrow: addDays(today, 1), monday: nextMonday(today) }[draft.start]
  const endDate = length ? addDays(startDate, length - 1) : null

  const filled = (rows) => rows.map((r) => r.text.trim()).filter(Boolean)
  const goals = filled(draft.goals)
  const distractions = filled(draft.distractions)
  const rituals = filled(draft.rituals)

  const canContinue = [draft.name.trim().length > 0, length > 0, true, true, true, true][step]
  const optionalEmpty = [false, false, !goals.length, !distractions.length, !rituals.length, false][step]
  const isLast = step === STEPS.length - 1

  const go = (to) => {
    setDir(to > step ? 1 : -1)
    setStep(to)
    setError('')
  }

  const create = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/campaigns', {
        name: draft.name,
        icon: draft.icon,
        mission: draft.mission,
        startDate,
        endDate,
        goals: goals.map((text) => ({ text })),
        distractions: distractions.map((text) => ({ text })),
        rituals: rituals.map((text) => ({ text })),
        today,
      })
      upsertCampaign(data.campaign)
      if (reduceMotion) navigate(`/campaigns/${data.campaign._id}`)
      else setLaunched(data.campaign)
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canContinue || saving) return
    if (isLast) create()
    else go(step + 1)
  }

  const startOptions = [
    { id: 'today', label: 'Today', date: today },
    { id: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    { id: 'monday', label: 'Next Monday', date: nextMonday(today) },
  ]

  const stepBody = [
    <>
      <h2 className="wizard-q">Name your campaign</h2>
      <p className="wizard-help">A campaign is a set stretch of days where you go all in. Give it a name worth showing up for.</p>
      <div className="title-row">
        <button type="button" className="icon-pick" onClick={() => setPickingIcon(!pickingIcon)}
          aria-label={`Icon: ${draft.icon}. Change icon`} aria-expanded={pickingIcon}>
          <motion.span key={draft.icon} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}>
            {draft.icon}
          </motion.span>
        </button>
        <input className="title-input" value={draft.name} onChange={(e) => set({ name: e.target.value })}
          placeholder="Operation Deep Work" aria-label="Campaign name" maxLength={120} autoFocus />
      </div>
      <AnimatePresence>
        {pickingIcon && (
          <motion.div className="icon-grid" role="group" aria-label="Choose an icon"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            {CAMPAIGN_ICONS.map((icon) => (
              <button key={icon} type="button" className={`icon-option ${draft.icon === icon ? 'is-selected' : ''}`}
                onClick={() => { set({ icon }); setPickingIcon(false) }} aria-label={icon}>
                {icon}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <label className="cw-mission">
        <span className="property-key">Mission <span className="cw-optional">optional</span></span>
        <input className="property-value" value={draft.mission} maxLength={500}
          onChange={(e) => set({ mission: e.target.value })}
          placeholder="Ship my portfolio and get my first freelance client" />
      </label>
    </>,

    <>
      <h2 className="wizard-q">How long will it run?</h2>
      <p className="wizard-help">Long enough to change something, short enough to stay sharp.</p>
      <div className="cw-durations" role="radiogroup" aria-label="Length">
        {DURATIONS.map((d, i) => (
          <motion.label key={d.days} className="area-card cw-duration"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: i * 0.04 }}>
            <input type="radio" name="length" checked={draft.length === d.days} onChange={() => set({ length: d.days })}
              autoFocus={i === 1} />
            <span className="cw-duration-num">{d.days}</span>
            <span className="area-label">days</span>
            <span className="area-hint">{d.hint}</span>
          </motion.label>
        ))}
        <motion.label className="area-card cw-duration" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE, delay: 0.16 }}>
          <input type="radio" name="length" checked={draft.length === 'custom'} onChange={() => set({ length: 'custom' })} />
          <span className="cw-duration-num">…</span>
          <span className="area-label">Custom</span>
          <span className="area-hint">Up to a year</span>
        </motion.label>
      </div>
      <AnimatePresence initial={false}>
        {draft.length === 'custom' && (
          <motion.div className="custom-date" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <input type="number" className="property-value" min={1} max={MAX_CUSTOM_DAYS} inputMode="numeric" autoFocus
              value={draft.customLength} onChange={(e) => set({ customLength: e.target.value })}
              placeholder="Number of days" aria-label="Number of days" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="cw-start">
        <span className="property-key">Starts</span>
        <div className="pills" role="radiogroup" aria-label="Start date">
          {startOptions.map((o) => (
            <label key={o.id} className="pill pill-small">
              <input type="radio" name="start" checked={draft.start === o.id} onChange={() => set({ start: o.id })} />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <p className="deadline-summary" aria-live="polite">
        {endDate ? (
          <><CalendarDays size={16} aria-hidden="true" />{shortDate(startDate)} → {dayLabel(endDate)}</>
        ) : 'Enter a number of days between 1 and 365.'}
      </p>
    </>,

    <>
      <h2 className="wizard-q">What are you fighting for?</h2>
      <p className="wizard-help">The goals this campaign should get you. Tick them off on the campaign page when you hit them.</p>
      <ListEditor rows={draft.goals} onChange={(rows) => set({ goals: rows })} label="Goal" tone="goal"
        placeholders={['Finish the portfolio site', 'Land one paying client', 'Read 4 books']} />
    </>,

    <>
      <h2 className="wizard-q">Name your distractions</h2>
      <p className="wizard-help">The things that steal your days. Every day you'll mark whether you held the line against each one.</p>
      <ListEditor rows={draft.distractions} onChange={(rows) => set({ distractions: rows })} label="Distraction" tone="enemy"
        placeholders={['Instagram reels', 'YouTube rabbit holes', 'Gaming past midnight']} />
    </>,

    <>
      <h2 className="wizard-q">What will you do every day?</h2>
      <p className="wizard-help">Your daily protocol. Do all of it and hold the line, and the day counts as won.</p>
      <ListEditor rows={draft.rituals} onChange={(rows) => set({ rituals: rows })} label="Daily action" tone="ritual"
        placeholders={['2 hours of deep work', 'Workout 30 min', 'Plan tomorrow before bed']} />
    </>,

    <>
      <h2 className="wizard-q">Ready to launch?</h2>
      <p className="wizard-help">Everything stays editable. Day one is {dayLabel(startDate)}.</p>
      <div className="review-card cw-review">
        <div className="review-title"><span aria-hidden="true">{draft.icon}</span>{draft.name}</div>
        {draft.mission.trim() && <blockquote className="review-why">{draft.mission.trim()}</blockquote>}
        <dl className="review-props">
          <div><dt>Runs</dt><dd>{plural(length, 'day')} · {shortDate(startDate)} → {endDate && shortDate(endDate)}</dd></div>
        </dl>
        <div className="cw-review-cols">
          {[
            ['Goals', goals, 'goal'],
            ['Distractions', distractions, 'enemy'],
            ['Every day', rituals, 'ritual'],
          ].map(([title, list, tone], col) => (
            <div key={title} className={`cw-review-col is-${tone}`}>
              <span className="cw-review-head">{title}<span>{list.length}</span></span>
              <ul>
                {list.length ? list.map((t, i) => (
                  <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + col * 0.08 + i * 0.04, duration: 0.25 }}>
                    {t}
                  </motion.li>
                )) : <li className="cw-review-none">None yet</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>,
  ]

  return (
    <Workspace title="New campaign" folder="Campaigns" status={`Step ${step + 1} of ${STEPS.length}`}>
      <form className="wizard" onSubmit={handleSubmit}>
        <ol className="stepper" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className={`stepper-item ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`}>
              <button type="button" className="stepper-btn" onClick={() => i < step && go(i)}
                disabled={i >= step} aria-current={i === step ? 'step' : undefined}>
                <span className="stepper-bar">
                  <motion.span className="stepper-fill" initial={false}
                    animate={{ scaleX: i < step ? 1 : i === step ? 0.5 : 0 }}
                    transition={{ duration: 0.45, ease: EASE }} />
                </span>
                <span className="stepper-label">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="wizard-stage">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.28, ease: EASE }} className="wizard-step">
              {stepBody[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title"><CircleAlert size={16} aria-hidden="true" />{error}</p>
          </div>
        )}

        <div className="wizard-footer">
          <button type="button" className="btn btn-large btn-ghost"
            onClick={() => (step === 0 ? navigate('/campaigns') : go(step - 1))}>
            {step === 0 ? 'Cancel' : <><ArrowLeft size={16} aria-hidden="true" />Back</>}
          </button>
          <span className="wizard-hint" aria-hidden="true">
            {step >= 2 && step <= 4 ? 'Enter adds a row' : <>Press Enter <CornerDownLeft size={13} /></>}
          </span>
          <button type="submit" className="btn btn-cta btn-large" disabled={!canContinue || saving}>
            {isLast ? (saving ? 'Launching…' : <><Rocket size={16} aria-hidden="true" />Launch campaign</>)
              : optionalEmpty ? 'Skip'
              : <>Next<ArrowRight size={16} aria-hidden="true" /></>}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {launched && (
          <LaunchOverlay name={launched.name} onDone={() => navigate(`/campaigns/${launched._id}`, { state: { launched: true } })} />
        )}
      </AnimatePresence>
    </Workspace>
  )
}

export default NewCampaign
