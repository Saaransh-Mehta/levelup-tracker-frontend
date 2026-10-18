import { Eye, EyeOff, Lock } from 'lucide-react'
import PasswordChecklist from './PasswordChecklist'

// New password and its confirmation, with the rules checklist. Fields are named password and
// confirmPassword, so one onChange handler can write them straight into a form object.
function NewPasswordFields({ password, confirmPassword, onChange, show, onToggleShow, disabled }) {
  const mismatch = confirmPassword && password !== confirmPassword
  const type = show ? 'text' : 'password'

  return (
    <>
      <div className="property">
        <label htmlFor="password" className="property-key">
          <Lock size={16} aria-hidden="true" />new password
        </label>
        <div className="value-with-action">
          <input id="password" name="password" type={type} minLength={8} autoComplete="new-password"
            placeholder="Create a password" className="property-value" aria-describedby="pw-rules"
            value={password} onChange={onChange} disabled={disabled} required />
          <button type="button" className="icon-btn value-action" onClick={onToggleShow}
            aria-label={show ? 'Hide passwords' : 'Show passwords'} aria-pressed={show}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <PasswordChecklist id="pw-rules" password={password} />
      <div className="property">
        <label htmlFor="confirmPassword" className="property-key">
          <Lock size={16} aria-hidden="true" />confirm
        </label>
        <input id="confirmPassword" name="confirmPassword" type={type} minLength={8}
          autoComplete="new-password" placeholder="Repeat password"
          className="property-value" aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? 'confirm-hint' : undefined}
          value={confirmPassword} onChange={onChange} disabled={disabled} required />
      </div>
      {mismatch && <p id="confirm-hint" className="property-hint">Doesn't match the password yet</p>}
    </>
  )
}

export default NewPasswordFields
