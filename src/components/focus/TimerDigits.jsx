import { AnimatePresence, motion } from 'motion/react'

// A clock whose digits roll when they change. Each position keeps a fixed width so nothing shifts.
function TimerDigits({ value, label }) {
  const chars = value.split('')
  return (
    <div className="timer" role="timer" aria-label={label}>
      {chars.map((ch, i) =>
        ch === ':' ? (
          <span key={`sep-${i}`} className="timer-sep" aria-hidden="true">:</span>
        ) : (
          <span key={`slot-${chars.length - i}`} className="timer-slot" aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="timer-digit"
                initial={{ y: '-60%', opacity: 0, filter: 'blur(4px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: '60%', opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ),
      )}
    </div>
  )
}

export default TimerDigits
