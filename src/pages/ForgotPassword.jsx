import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, CircleAlert, MailCheck } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  // idle → loading → sent
  const [phase, setPhase] = useState('idle')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setPhase('loading')
    try {
      await api.post('/auth/forgot-password', { email })
      setPhase('sent')
    } catch (err) {
      setError(getErrorMessage(err))
      setPhase('idle')
    }
  }

  if (phase === 'sent') {
    return (
      <Workspace title="Reset password" step="login" status="Email sent">
        <div className="stagger" role="status">
          <h1 className="inline-title">Check your email</h1>
          <p className="lede">
            If <span className="accent-text">{email}</span> has a LevelUp account, a link to choose a new
            password is on its way. It works once and expires in 30 minutes.
          </p>
          <div className="callout callout-info">
            <p className="callout-title"><MailCheck size={16} aria-hidden="true" />Nothing after a few minutes?</p>
            <ul>
              <li>Look in spam or promotions.</li>
              <li>Make sure it's the email you signed up with, or <button type="button" className="link-btn" onClick={() => setPhase('idle')}>try another one</button>.</li>
            </ul>
          </div>
          <p className="switch-auth"><Link to="/login">Back to log in</Link></p>
        </div>
      </Workspace>
    )
  }

  const busy = phase === 'loading'

  return (
    <Workspace title="Reset password" step="login" status={busy ? 'Sending…' : 'Not signed in'}>
      <form className="stagger" onSubmit={handleSubmit}>
        <h1 className="inline-title">Forgot your password?</h1>
        <p className="lede">Enter the email you signed up with and we'll send you a link to choose a new one.</p>

        <div className="field-group">
          <div className="property">
            <label htmlFor="email" className="property-key">
              <AtSign size={16} aria-hidden="true" />email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com"
              className="property-value" aria-invalid={Boolean(error) || undefined} value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }} disabled={busy} required autoFocus />
          </div>
        </div>

        {error && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title"><CircleAlert size={16} aria-hidden="true" />{error}</p>
          </div>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-cta btn-large" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </div>

        <p className="switch-auth">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </Workspace>
  )
}

export default ForgotPassword
