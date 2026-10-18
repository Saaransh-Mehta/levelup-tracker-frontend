// Keep in sync with PASSWORD_RULES in backend/src/controllers/authController.js
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export const passwordIsValid = (p) => PASSWORD_RULES.every((r) => r.test(p))
