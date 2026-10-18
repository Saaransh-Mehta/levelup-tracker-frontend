import { PASSWORD_RULES } from '../passwordRules'

function PasswordChecklist({ id, password }) {
  const touched = password.length > 0

  return (
    <ul id={id} className="pw-checklist">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        const state = met ? 'is-met' : touched ? 'is-unmet' : ''
        return (
          <li key={rule.id} className={`pw-rule ${state}`}>
            {/* Two bars that rearrange from a cross into a tick. */}
            <span className="pw-mark" aria-hidden="true">
              <span className="pw-bar pw-bar-a" />
              <span className="pw-bar pw-bar-b" />
            </span>
            <span>{rule.label}</span>
            <span className="sr-only">{met ? ', done' : ', not yet'}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default PasswordChecklist
