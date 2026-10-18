import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AtSign, Calendar, CircleAlert, Eye, EyeOff, Info, Lock, Phone, Users } from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import PasswordChecklist from '../components/PasswordChecklist'
import { passwordIsValid } from '../passwordRules'

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const FIELDS = ['email', 'phone', 'gender', 'dateOfBirth', 'password', 'confirmPassword']

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!passwordIsValid(form.password)) {
      // The checklist under the field shows what's missing.
      document.getElementById('password').focus()
      return
    }
    if (form.password !== form.confirmPassword) {
      // The inline hint under "confirm" already explains it.
      document.getElementById('confirmPassword').focus()
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('token', data.token)
      navigate('/onboarding')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const filled = FIELDS.filter((f) => form[f]).length
  const mismatch = form.confirmPassword && form.password !== form.confirmPassword
  const passwordType = showPassword ? 'text' : 'password'

  return (
    <Workspace title="Start leveling up" step="register" status={`${filled} of ${FIELDS.length} properties`}>
      <form className="stagger" onSubmit={handleSubmit}>
        <h1 className="inline-title">Start leveling up</h1>
        <p className="lede">Create your LevelUp account. It takes about a minute.</p>

        <section className="field-group" aria-labelledby="h-contact">
          <h2 id="h-contact">Contact</h2>
          <div className="property">
            <label htmlFor="email" className="property-key">
              <AtSign size={16} aria-hidden="true" />email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com"
              className="property-value" value={form.email} onChange={handleChange} required />
          </div>
          <div className="property">
            <label htmlFor="phone" className="property-key">
              <Phone size={16} aria-hidden="true" />phone
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+919876543210"
              className="property-value" value={form.phone} onChange={handleChange} required />
          </div>
        </section>

        <section className="field-group" aria-labelledby="h-about">
          <h2 id="h-about">About you</h2>
          <div className="property">
            <span id="gender-key" className="property-key">
              <Users size={16} aria-hidden="true" />gender
            </span>
            <div className="pills" role="radiogroup" aria-labelledby="gender-key">
              {GENDERS.map((g) => (
                <label key={g.value} className="pill">
                  <input type="radio" name="gender" value={g.value} checked={form.gender === g.value}
                    onChange={handleChange} required />
                  {g.label}
                </label>
              ))}
            </div>
          </div>
          <div className="property">
            <label htmlFor="dateOfBirth" className="property-key">
              <Calendar size={16} aria-hidden="true" />born
            </label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" max={today}
              className={`property-value ${form.dateOfBirth ? '' : 'is-empty'}`}
              value={form.dateOfBirth} onChange={handleChange} required />
          </div>
        </section>

        <section className="field-group" aria-labelledby="h-security">
          <h2 id="h-security">Security</h2>
          <div className="property">
            <label htmlFor="password" className="property-key">
              <Lock size={16} aria-hidden="true" />password
            </label>
            <div className="value-with-action">
              <input id="password" name="password" type={passwordType} minLength={8} autoComplete="new-password"
                placeholder="Create a password" className="property-value" aria-describedby="pw-rules"
                value={form.password} onChange={handleChange} required />
              <button type="button" className="icon-btn value-action" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <PasswordChecklist id="pw-rules" password={form.password} />
          <div className="property">
            <label htmlFor="confirmPassword" className="property-key">
              <Lock size={16} aria-hidden="true" />confirm
            </label>
            <input id="confirmPassword" name="confirmPassword" type={passwordType} minLength={8}
              autoComplete="new-password" placeholder="Repeat password"
              className="property-value" aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? 'confirm-hint' : undefined}
              value={form.confirmPassword} onChange={handleChange} required />
          </div>
          {mismatch && <p id="confirm-hint" className="property-hint">Doesn't match the password yet</p>}
        </section>

        <aside className="callout callout-info">
          <p className="callout-title">
            <Info size={16} aria-hidden="true" />What happens next
          </p>
          <ul>
            <li>We pick a username for you. You can rename it any time from your profile.</li>
            <li>Three quick questions set your session length and how reminders talk to you.</li>
          </ul>
        </aside>

        {error && (
          <div className="callout callout-error" role="alert">
            <p className="callout-title">
              <CircleAlert size={16} aria-hidden="true" />{error}
            </p>
          </div>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-cta btn-large" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </div>

        <p className="switch-auth">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </Workspace>
  )
}

export default Register
