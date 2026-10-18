import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AtSign, CircleAlert, Eye, EyeOff, Lock } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'

// How long each success beat stays on screen before the next one.
const SUCCESS_HOLD_MS = 650
const REDIRECT_MS = 1300

function DrawnCheck() {
  return (
    <svg className="check-draw" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  // idle → loading → success → (welcome view)
  const [phase, setPhase] = useState('idle')
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (phase !== 'success') return
    const t = setTimeout(() => setPhase('welcome'), SUCCESS_HOLD_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'welcome') return
    const t = setTimeout(() => navigate(user.onboardingCompleted ? '/goals' : '/onboarding'), REDIRECT_MS)
    return () => clearTimeout(t)
  }, [phase, user, navigate])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setPhase('loading')
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.token)
      setUser(data.user)
      setPhase('success')
    } catch (err) {
      setError(getErrorMessage(err))
      setShake(true)
      setPhase('idle')
    }
  }

  if (phase === 'welcome') {
    const setupPending = !user.onboardingCompleted
    return (
      <Workspace title="Log in" step="login" status="Signed in">
        <div className="stagger" role="status">
          <h1 className="inline-title">
            Welcome back, <span className="accent-text">{user.username}</span>
          </h1>
          <p className="lede">
            {setupPending ? "Your setup isn't finished yet. Taking you there now." : 'Opening your goals.'}
          </p>
          <div className="level-bar" aria-hidden="true"><span /></div>
        </div>
      </Workspace>
    )
  }

  const busy = phase !== 'idle'
  const invalid = Boolean(error) || undefined

  return (
    <Workspace title="Log in" step="login" status={busy ? 'Checking…' : 'Not signed in'}>
      <form className="stagger" onSubmit={handleSubmit}>
        <h1 className="inline-title">Welcome back</h1>
        <p className="lede">Log in to pick up where you left off.</p>

        <div className="field-group">
          <div className={shake ? 'shake' : undefined} onAnimationEnd={() => setShake(false)}>
            <div className="property">
              <label htmlFor="identifier" className="property-key">
                <AtSign size={16} aria-hidden="true" />email or phone
              </label>
              <input id="identifier" name="identifier" type="text" autoComplete="username" inputMode="email"
                placeholder="you@example.com" className="property-value" aria-invalid={invalid}
                value={form.identifier} onChange={handleChange} disabled={busy} required autoFocus />
            </div>
            <div className="property">
              <label htmlFor="password" className="property-key">
                <Lock size={16} aria-hidden="true" />password
              </label>
              <div className="value-with-action">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="Your password" className="property-value"
                  aria-invalid={invalid} value={form.password} onChange={handleChange} disabled={busy} required />
                <button type="button" className="icon-btn value-action" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="forgot-row">
            <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
          </div>
        </div>

        {error && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title">
              <CircleAlert size={16} aria-hidden="true" />{error}
            </p>
          </div>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-cta btn-large btn-submit" data-state={phase} disabled={busy}>
            {phase === 'success' ? (
              <><DrawnCheck />Signed in</>
            ) : phase === 'loading' ? 'Checking…' : 'Log in'}
          </button>
        </div>

        <p className="switch-auth">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </Workspace>
  )
}

export default Login
