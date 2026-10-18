import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import Burst from './Burst'

const EASE = [0.2, 0.8, 0.2, 1]
const SPRING = { type: 'spring', stiffness: 520, damping: 30 }

// Round to-do check: fills green, draws a tick and pops confetti when ticked.
function CheckButton({ done, label, onToggle }) {
  const reduceMotion = useReducedMotion()
  const [pops, setPops] = useState(0)

  const click = () => {
    if (!done) setPops((n) => n + 1)
    onToggle()
  }

  return (
    <motion.button type="button" className={`habit-check ${done ? 'is-done' : ''}`} onClick={click}
      aria-pressed={done} aria-label={done ? `Untick ${label}` : `Tick off ${label}`}
      whileTap={{ scale: 0.82 }} whileHover={{ scale: 1.06 }} transition={SPRING}>
      <motion.span className="habit-check-fill" initial={false} animate={{ scale: done ? 1 : 0 }} transition={SPRING} />
      <svg viewBox="0 0 24 24" className="habit-check-mark" aria-hidden="true">
        <motion.path d="M6 12.5l4 4 8-9" initial={false} animate={{ pathLength: done ? 1 : 0 }}
          transition={{ duration: 0.28, ease: EASE, delay: done ? 0.08 : 0 }} />
      </svg>
      {!reduceMotion && pops > 0 && <Burst key={pops} count={14} spread={120} height={56} />}
    </motion.button>
  )
}

export default CheckButton
