import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'

const QUESTIONS = [
  {
    key: 'workStyle',
    question: 'How do you prefer to work?',
    options: [
      { value: 'short_sprints', label: 'Short focused sprints (25 min)' },
      { value: 'medium_blocks', label: 'Medium blocks (1 hr)' },
      { value: 'deep_work', label: 'Long deep-work sessions (2+ hrs)' },
    ],
  },
  {
    key: 'motivation',
    question: 'What motivates you the most?',
    options: [
      { value: 'streaks_stats', label: 'Seeing streaks and stats' },
      { value: 'levelling_rewards', label: 'Levelling up and rewards' },
      { value: 'accountability', label: 'Accountability and reminders' },
      { value: 'prove_myself', label: 'Proving it to myself' },
    ],
  },
  {
    key: 'blocker',
    question: 'What usually stops you?',
    options: [
      { value: 'procrastination', label: 'Procrastination' },
      { value: 'losing_motivation', label: 'Losing motivation midway' },
      { value: 'too_many_things', label: 'Too many things at once' },
      { value: 'forgetting', label: 'Forgetting' },
      { value: 'burnout', label: 'Burnout' },
    ],
  },
]

function Onboarding() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!localStorage.getItem('token')) {
    return <Navigate to="/register" replace />
  }

  const current = QUESTIONS[step]
  const isLast = step === QUESTIONS.length - 1

  const handleNext = async () => {
    if (!isLast) {
      setStep(step + 1)
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.put('/users/personality', answers)
      setDone(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Workspace title="Setup" step="done" status="Setup complete">
        <h1 className="inline-title">Setup</h1>
        <p className="lede">Your profile is ready. Time to set your first goal.</p>
        <div className="callout callout-success" role="status">
          <p className="callout-title">
            <CircleCheck size={16} aria-hidden="true" />Your answers are saved
          </p>
        </div>
        <div className="actions">
          <Link to="/goals" className="btn btn-cta btn-large">Go to your goals</Link>
        </div>
      </Workspace>
    )
  }

  return (
    <Workspace title="Setup" step="setup" status={`Question ${step + 1} of ${QUESTIONS.length}`}>
      <h1 className="inline-title">Setup</h1>
      <p className="lede">Three questions so sessions and reminders fit how you work.</p>

      <fieldset className="question" key={current.key}>
        <legend className="question-title">{current.question}</legend>
        <div className="task-list">
          {current.options.map((opt) => (
            <label key={opt.value} className="task">
              <input
                type="radio"
                name={current.key}
                value={opt.value}
                checked={answers[current.key] === opt.value}
                onChange={() => setAnswers({ ...answers, [current.key]: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div className="callout callout-error" role="alert">
          <p className="callout-title">
            <CircleAlert size={16} aria-hidden="true" />{error}
          </p>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-large" onClick={() => setStep(step - 1)} disabled={step === 0}>
          Back
        </button>
        <button type="button" className="btn btn-cta btn-large" onClick={handleNext} disabled={!answers[current.key] || loading}>
          {isLast ? (loading ? 'Saving…' : 'Finish') : 'Next'}
        </button>
      </div>
    </Workspace>
  )
}

export default Onboarding
