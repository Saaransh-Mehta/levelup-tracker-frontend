import { useEffect, useState } from 'react'
import { AtSign, Calendar, CircleAlert, CircleCheck, Fingerprint, Lock, LogOut, Phone, User } from 'lucide-react'
import api, { getErrorMessage, signOut } from '../api'
import Workspace from '../components/Workspace'
import NewPasswordFields from '../components/NewPasswordFields'
import { useAppData } from '../context/appDataContext'
import { passwordIsValid } from '../passwordRules'

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/

// A callout under a form: what just saved, or why it didn't.
function Result({ result }) {
  if (!result) return null
  const Icon = result.ok ? CircleCheck : CircleAlert
  return (
    <div className={`callout ${result.ok ? 'callout-success' : 'callout-error'} callout-enter`} role={result.ok ? 'status' : 'alert'}>
      <p className="callout-title"><Icon size={16} aria-hidden="true" />{result.message}</p>
    </div>
  )
}

function UsernameForm({ me, setMe }) {
  const [username, setUsername] = useState(me.username)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const changed = username.trim() !== me.username
  const valid = USERNAME_RE.test(username.trim())

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return setResult({ ok: false, message: 'Use 3 to 24 letters, numbers or _' })
    setSaving(true)
    try {
      const { data } = await api.put('/users/username', { username: username.trim() })
      setMe(data.user)
      setUsername(data.user.username)
      setResult({ ok: true, message: 'Username saved' })
    } catch (err) {
      setResult({ ok: false, message: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="property">
        <label htmlFor="username" className="property-key"><User size={16} aria-hidden="true" />username</label>
        <div className="property-inline-form">
          <input id="username" name="username" type="text" autoComplete="nickname" maxLength={24}
            className="property-value" aria-invalid={(changed && !valid) || undefined} value={username}
            onChange={(e) => { setUsername(e.target.value); setResult(null) }} disabled={saving} />
          <button type="submit" className="btn" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <Result result={result} />
    </form>
  )
}

const EMPTY_PASSWORDS = { currentPassword: '', password: '', confirmPassword: '' }

function PasswordForm() {
  const [form, setForm] = useState(EMPTY_PASSWORDS)
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setResult(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!passwordIsValid(form.password)) return document.getElementById('password').focus()
    if (form.password !== form.confirmPassword) return document.getElementById('confirmPassword').focus()
    setSaving(true)
    try {
      const { data } = await api.put('/users/password', form)
      // The old token stops working, so this device moves to the new one.
      localStorage.setItem('token', data.token)
      setForm(EMPTY_PASSWORDS)
      setResult({ ok: true, message: 'Password changed. Other devices have been signed out.' })
    } catch (err) {
      setResult({ ok: false, message: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="property">
        <label htmlFor="currentPassword" className="property-key"><Lock size={16} aria-hidden="true" />current</label>
        <input id="currentPassword" name="currentPassword" type={show ? 'text' : 'password'}
          autoComplete="current-password" placeholder="Your current password" className="property-value"
          value={form.currentPassword} onChange={handleChange} disabled={saving} required />
      </div>
      <NewPasswordFields password={form.password} confirmPassword={form.confirmPassword} onChange={handleChange}
        show={show} onToggleShow={() => setShow(!show)} disabled={saving} />
      <Result result={result} />
      <div className="actions">
        <button type="submit" className="btn btn-cta" disabled={saving}>{saving ? 'Changing…' : 'Change password'}</button>
      </div>
    </form>
  )
}

const joined = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

function Profile() {
  const { me, setMe } = useAppData()

  useEffect(() => {
    document.title = 'Profile · LevelUp'
  }, [])

  return (
    <Workspace title="Profile" folder="Account" status={me ? me.userId : 'Loading…'}>
      <div className="stagger">
        <h1 className="inline-title">Profile</h1>
        <p className="lede">Your account, your username and your password.</p>

        {!me ? (
          <p className="lede">Loading your account…</p>
        ) : (
          <>
            <section className="field-group" aria-labelledby="h-account">
              <h2 id="h-account">Account</h2>
              <UsernameForm key={me.username} me={me} setMe={setMe} />
              <div className="property">
                <span className="property-key"><AtSign size={16} aria-hidden="true" />email</span>
                <span className="property-static">{me.email}</span>
              </div>
              <div className="property">
                <span className="property-key"><Phone size={16} aria-hidden="true" />phone</span>
                <span className="property-static">{me.phone}</span>
              </div>
              <div className="property">
                <span className="property-key"><Fingerprint size={16} aria-hidden="true" />user id</span>
                <span className="property-static mono">{me.userId}</span>
              </div>
              <div className="property">
                <span className="property-key"><Calendar size={16} aria-hidden="true" />joined</span>
                <span className="property-static">{joined(me.createdAt)}</span>
              </div>
            </section>

            <section className="field-group" aria-labelledby="h-password">
              <h2 id="h-password">Password</h2>
              <PasswordForm />
            </section>

            <section className="field-group" aria-labelledby="h-session">
              <h2 id="h-session">This device</h2>
              <p className="lede">Logging out forgets your account on this device. Your data stays saved.</p>
              <div className="actions">
                <button type="button" className="btn" onClick={signOut}><LogOut size={16} aria-hidden="true" />Log out</button>
              </div>
            </section>
          </>
        )}
      </div>
    </Workspace>
  )
}

export default Profile
