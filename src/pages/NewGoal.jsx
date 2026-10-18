import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, CornerDownLeft, Plus, X } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import { useAppData } from '../context/appDataContext'
import { AREAS, DEADLINES, QUICK_ICONS, areaOf, buildGoalDoc, formatDate, relativeDate } from '../goals'

const STEPS = ['What', 'Area', 'Why', 'When', 'Milestones', 'Review']
const MAX_MILESTONES = 10
const EASE = [0.2, 0.8, 0.2, 1]

// Steps slide in from the side you're heading towards.
const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -48 }),
}

function NewGoal() {
  const navigate = useNavigate()
  const { upsertGoal } = useAppData()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [draft, setDraft] = useState({
    title: '',
    icon: '🎯',
    area: '',
    why: '',
    deadline: '3m',
    customDate: '',
    milestones: [{ id: 1, text: '' }, { id: 2, text: '' }],
  })
  const [pickingIcon, setPickingIcon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const milestoneRefs = useRef([])
  const nextId = useRef(3)
  const titleRef = useRef(null)
  // Row to focus once it has rendered; set in key handlers, applied before the next keystroke.
  const focusRow = useRef(null)

  useLayoutEffect(() => {
    if (focusRow.current === null) return
    milestoneRefs.current[focusRow.current]?.focus()
    focusRow.current = null
  })

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const targetDate = draft.deadline === 'custom'
    ? draft.customDate || null
    : DEADLINES.find((d) => d.id === draft.deadline)?.date?.() || null

  const canContinue = [
    draft.title.trim().length > 0,
    Boolean(draft.area),
    true,
    draft.deadline !== 'custom' || Boolean(draft.customDate),
    true,
    true,
  ][step]

  const go = (to) => {
    setDir(to > step ? 1 : -1)
    setStep(to)
    setError('')
  }

  const create = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/goals', {
        title: draft.title,
        icon: draft.icon,
        area: draft.area,
        why: draft.why,
        targetDate,
        content: buildGoalDoc({ why: draft.why, milestones: draft.milestones.map((m) => m.text) }),
      })
      upsertGoal(data.goal)
      navigate(`/goals/${data.goal._id}`, { state: { created: true } })
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canContinue || saving) return
    if (step === STEPS.length - 1) create()
    else go(step + 1)
  }

  // Milestones: Enter adds a row below, Backspace on an empty row removes it.
  const setMilestone = (i, text) => set({ milestones: draft.milestones.map((m, j) => (j === i ? { ...m, text } : m)) })

  const addMilestone = (after = draft.milestones.length - 1) => {
    if (draft.milestones.length >= MAX_MILESTONES) return
    const next = [...draft.milestones]
    next.splice(after + 1, 0, { id: nextId.current++, text: '' })
    set({ milestones: next })
    focusRow.current = after + 1
  }

  const removeMilestone = (i) => {
    if (draft.milestones.length === 1) return setMilestone(0, '')
    set({ milestones: draft.milestones.filter((_, j) => j !== i) })
    focusRow.current = Math.max(0, i - 1)
  }

  const milestoneKeyDown = (e, i) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      addMilestone(i)
    } else if (e.key === 'Backspace' && !draft.milestones[i].text && draft.milestones.length > 1) {
      e.preventDefault()
      removeMilestone(i)
    }
  }

  const area = areaOf(draft.area)
  const filledMilestones = draft.milestones.map((m) => m.text.trim()).filter(Boolean)

  const stepBody = [
    // 1. What
    <>
      <h2 className="wizard-q">What do you want to achieve?</h2>
      <p className="wizard-help">Name it the way you'd say it to a friend. You can change it later.</p>
      <div className="title-row">
        <button type="button" className="icon-pick" onClick={() => setPickingIcon(!pickingIcon)}
          aria-label={`Icon: ${draft.icon}. Change icon`} aria-expanded={pickingIcon}>
          <motion.span key={draft.icon} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}>
            {draft.icon}
          </motion.span>
        </button>
        <input ref={titleRef} className="title-input" value={draft.title} onChange={(e) => set({ title: e.target.value })}
          placeholder="Run a half marathon" aria-label="Goal name" maxLength={200} autoFocus />
      </div>
      <AnimatePresence>
        {pickingIcon && (
          <motion.div className="icon-grid" role="group" aria-label="Choose an icon"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            {QUICK_ICONS.map((icon) => (
              <button key={icon} type="button" className={`icon-option ${draft.icon === icon ? 'is-selected' : ''}`}
                onClick={() => { set({ icon }); setPickingIcon(false); titleRef.current?.focus() }} aria-label={icon}>
                {icon}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>,

    // 2. Area
    <>
      <h2 className="wizard-q">Which part of life is this?</h2>
      <p className="wizard-help">Used to group your goals and, later, to suggest habits that support it.</p>
      <div className="area-grid" role="radiogroup" aria-label="Area">
        {AREAS.map((a, i) => {
          const Icon = a.icon
          return (
            <motion.label key={a.value} className="area-card"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: i * 0.03 }}>
              <input type="radio" name="area" value={a.value} checked={draft.area === a.value}
                onChange={() => set({ area: a.value })} autoFocus={i === 0 && !draft.area} />
              <Icon size={20} className="area-icon" aria-hidden="true" />
              <span className="area-label">{a.label}</span>
              <span className="area-hint">{a.hint}</span>
            </motion.label>
          )
        })}
      </div>
    </>,

    // 3. Why
    <>
      <h2 className="wizard-q">Why does it matter to you?</h2>
      <p className="wizard-help">This sits at the top of your goal, for the days motivation runs low. Optional.</p>
      <textarea className="why-input" value={draft.why} onChange={(e) => set({ why: e.target.value })}
        rows={4} maxLength={2000} autoFocus aria-label="Why it matters"
        placeholder="I want to feel strong again and prove I can finish something hard."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
        }} />
    </>,

    // 4. When
    <>
      <h2 className="wizard-q">When do you want to get there?</h2>
      <p className="wizard-help">A deadline turns a wish into a plan. Pick roughly; you can move it.</p>
      <div className="pills deadline-pills" role="radiogroup" aria-label="Deadline">
        {DEADLINES.map((d, i) => (
          <label key={d.id} className="pill">
            <input type="radio" name="deadline" value={d.id} checked={draft.deadline === d.id}
              onChange={() => set({ deadline: d.id })} autoFocus={i === 0} />
            {d.label}
          </label>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {draft.deadline === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }} className="custom-date">
            <input type="date" className="property-value" value={draft.customDate}
              min={new Date().toISOString().split('T')[0]} aria-label="Target date"
              onChange={(e) => set({ customDate: e.target.value })} />
          </motion.div>
        )}
      </AnimatePresence>
      <p className="deadline-summary" aria-live="polite">
        {targetDate ? (
          <><CalendarDays size={16} aria-hidden="true" />{formatDate(targetDate)}, {relativeDate(targetDate)}</>
        ) : draft.deadline === 'none' ? 'No deadline. You can add one any time.' : ' '}
      </p>
    </>,

    // 5. Milestones
    <>
      <h2 className="wizard-q">Break it into milestones</h2>
      <p className="wizard-help">
        Small, concrete steps. They become to-dos in your goal, and ticking them fills your progress bar.
      </p>
      <ol className="milestone-list">
        <AnimatePresence initial={false}>
          {draft.milestones.map((m, i) => (
            <motion.li key={m.id} className="milestone-row"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: EASE }}>
              <span className="milestone-num" aria-hidden="true">{i + 1}</span>
              <input ref={(el) => (milestoneRefs.current[i] = el)} className="milestone-input" value={m.text}
                onChange={(e) => setMilestone(i, e.target.value)} onKeyDown={(e) => milestoneKeyDown(e, i)}
                placeholder={['Run 5 km without stopping', 'Sign up for a race', 'Run 15 km'][i] || 'Next step'}
                aria-label={`Milestone ${i + 1}`} autoFocus={i === 0 && !m.text} />
              <button type="button" className="icon-btn" onClick={() => removeMilestone(i)}
                aria-label={`Remove milestone ${i + 1}`}>
                <X size={14} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {draft.milestones.length < MAX_MILESTONES && (
        <button type="button" className="add-row" onClick={() => addMilestone()}>
          <Plus size={16} aria-hidden="true" />Add milestone
        </button>
      )}
    </>,

    // 6. Review
    <>
      <h2 className="wizard-q">Looks good?</h2>
      <p className="wizard-help">This is how your goal will start. Everything stays editable.</p>
      <div className="review-card">
        <div className="review-title"><span aria-hidden="true">{draft.icon}</span>{draft.title}</div>
        <dl className="review-props">
          <div><dt>Area</dt><dd>{area?.label}</dd></div>
          <div><dt>Target</dt><dd>{targetDate ? `${formatDate(targetDate)} (${relativeDate(targetDate)})` : 'No deadline'}</dd></div>
          <div><dt>Milestones</dt><dd>{filledMilestones.length || 'None yet'}</dd></div>
        </dl>
        {draft.why.trim() && <blockquote className="review-why">{draft.why.trim()}</blockquote>}
        {filledMilestones.length > 0 && (
          <ul className="review-tasks">
            {filledMilestones.map((m, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.25 }}>
                <span className="review-box" aria-hidden="true" />{m}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </>,
  ]

  const optional = step === 2 || step === 4
  const isLast = step === STEPS.length - 1

  return (
    <Workspace title="New goal" status={`Step ${step + 1} of ${STEPS.length}`}>
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
            onClick={() => (step === 0 ? navigate('/goals') : go(step - 1))}>
            {step === 0 ? 'Cancel' : <><ArrowLeft size={16} aria-hidden="true" />Back</>}
          </button>
          <span className="wizard-hint" aria-hidden="true">
            {step === 4 ? 'Enter adds a row' : step === 2 ? 'Ctrl + Enter to continue' : <>Press Enter <CornerDownLeft size={13} /></>}
          </span>
          <button type="submit" className="btn btn-cta btn-large" disabled={!canContinue || saving}>
            {isLast ? (saving ? 'Creating…' : 'Create goal')
              : optional && !(step === 2 ? draft.why.trim() : filledMilestones.length) ? 'Skip'
              : <>Next<ArrowRight size={16} aria-hidden="true" /></>}
          </button>
        </div>
      </form>
    </Workspace>
  )
}

export default NewGoal
