import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import NewPasswordFields from '../components/NewPasswordFields'
import { passwordIsValid } from '../passwordRules'

// Opened from the link in the reset email: /reset-password?token=…
function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!passwordIsValid(form.password)) return document.getElementById('password').focus()
    if (form.password !== form.confirmPassword) return document.getElementById('confirmPassword').focus()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/reset-password', { token, ...form })
      localStorage.setItem('token', data.token)
      navigate(data.user.onboardingCompleted ? '/goals' : '/onboarding', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <Workspace title="Reset password" step="login" status="Not signed in">
        <div className="stagger">
          <h1 className="inline-title">This link is incomplete</h1>
          <p className="lede">Open the link from the email again, or ask for a new one.</p>
          <div className="actions">
            <Link to="/forgot-password" className="btn btn-cta btn-large">Send a new link</Link>
          </div>
        </div>
      </Workspace>
    )
  }

  return (
    <Workspace title="Reset password" step="login" status={loading ? 'Saving…' : 'Not signed in'}>
      <form className="stagger" onSubmit={handleSubmit}>
        <h1 className="inline-title">Choose a new password</h1>
        <p className="lede">This signs you out everywhere else and logs you in here.</p>

        <div className="field-group">
          <NewPasswordFields {...form} onChange={handleChange} show={show} onToggleShow={() => setShow(!show)}
            disabled={loading} />
        </div>

        {error && (
          <div className="callout callout-error callout-enter" role="alert">
            <p className="callout-title"><CircleAlert size={16} aria-hidden="true" />{error}</p>
            {/expired|already used|incomplete/i.test(error) && (
              <ul><li><Link to="/forgot-password" className="accent-text">Send a new link</Link></li></ul>
            )}
          </div>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-cta btn-large" disabled={loading}>
            {loading ? 'Saving…' : 'Save and log in'}
          </button>
        </div>
      </form>
    </Workspace>
  )
}

export default ResetPassword
