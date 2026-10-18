import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, useSpring } from 'motion/react'

// The focus companion. Moods:
//   focus — open, glowing, following the pointer, blinking now and then
//   sleep — closed while the session is paused
//   glare — narrowed, red, staring straight out after the user left the app
//   happy — smiling arcs when the session is done
const EYES = [{ cx: 72 }, { cx: 188 }]
const CY = 62
const RX = 44
const OPEN_RY = { focus: 34, glare: 12, sleep: 2.5, happy: 2.5, idle: 30 }
const IRIS_R = 18
const MAX_LOOK = { x: 16, y: 10 }

function Eyes({ mood = 'focus' }) {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const [blinking, setBlinking] = useState(false)
  const lookX = useSpring(0, { stiffness: 140, damping: 18 })
  const lookY = useSpring(0, { stiffness: 140, damping: 18 })
  const pointerSeen = useRef(false)

  // Pupils follow the pointer; with no pointer (phones) they wander on their own.
  useEffect(() => {
    if (mood !== 'focus' || reduceMotion) {
      lookX.set(0)
      lookY.set(0)
      return
    }
    const onMove = (e) => {
      pointerSeen.current = true
      const box = ref.current?.getBoundingClientRect()
      if (!box) return
      const dx = e.clientX - (box.left + box.width / 2)
      const dy = e.clientY - (box.top + box.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      const pull = Math.min(1, dist / 320)
      lookX.set((dx / dist) * MAX_LOOK.x * pull)
      lookY.set((dy / dist) * MAX_LOOK.y * pull)
    }
    const wander = setInterval(() => {
      if (pointerSeen.current) return
      lookX.set((Math.random() - 0.5) * 2 * MAX_LOOK.x * 0.8)
      lookY.set((Math.random() - 0.5) * 2 * MAX_LOOK.y * 0.6)
    }, 2600)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      clearInterval(wander)
    }
  }, [mood, reduceMotion, lookX, lookY])

  // Blink every few seconds while awake.
  useEffect(() => {
    if (!['focus', 'idle'].includes(mood) || reduceMotion) return
    let timer
    const schedule = () => {
      timer = setTimeout(() => {
        setBlinking(true)
        timer = setTimeout(() => {
          setBlinking(false)
          schedule()
        }, 150)
      }, 2400 + Math.random() * 3800)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [mood, reduceMotion])

  const ry = blinking ? 2 : OPEN_RY[mood]
  const lidTransition = blinking
    ? { duration: 0.07 }
    : { type: 'spring', stiffness: 260, damping: mood === 'glare' ? 14 : 22 }

  return (
    <div className={`eyes eyes-${mood}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 260 124" className="eyes-svg">
        <defs>
          <radialGradient id="iris-focus" cx="40%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#d6cfff" />
            <stop offset="45%" stopColor="#8a7cf4" />
            <stop offset="100%" stopColor="#3c2f9e" />
          </radialGradient>
          <radialGradient id="iris-glare" cx="40%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#ffd0cf" />
            <stop offset="45%" stopColor="#fb464c" />
            <stop offset="100%" stopColor="#7a0f14" />
          </radialGradient>
          {EYES.map((eye, i) => (
            <clipPath key={i} id={`eye-clip-${i}`}>
              <motion.ellipse cx={eye.cx} cy={CY} rx={RX} initial={{ ry: 2 }} animate={{ ry }} transition={lidTransition} />
            </clipPath>
          ))}
        </defs>

        {/* Brows slant down towards the middle when glaring. */}
        <AnimatePresence>
          {mood === 'glare' && EYES.map((eye, i) => (
            <motion.path
              key={`brow-${i}`}
              className="eye-brow"
              d={i === 0
                ? `M ${eye.cx - 36} 12 L ${eye.cx + 30} 28`
                : `M ${eye.cx - 30} 28 L ${eye.cx + 36} 12`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            />
          ))}
        </AnimatePresence>

        {EYES.map((eye, i) => (
          <g key={i}>
            <g clipPath={`url(#eye-clip-${i})`}>
              <ellipse className="eye-white" cx={eye.cx} cy={CY} rx={RX} ry={36} />
              <motion.g style={{ x: lookX, y: lookY }} initial={false}
                animate={{ opacity: mood === 'happy' ? 0 : 1 }} transition={{ duration: 0.2 }}>
                <circle cx={eye.cx} cy={CY} r={IRIS_R} fill={`url(#iris-${mood === 'glare' ? 'glare' : 'focus'})`} />
                <motion.circle cx={eye.cx} cy={CY} className="eye-pupil" initial={false}
                  animate={{ r: mood === 'glare' ? 5 : 8 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} />
                <circle cx={eye.cx - 9} cy={CY - 9} r={3.2} className="eye-shine" />
                <circle cx={eye.cx + 9} cy={CY + 8} r={1.6} className="eye-shine" />
              </motion.g>
            </g>
            <motion.ellipse className="eye-rim" cx={eye.cx} cy={CY} rx={RX} initial={{ ry: 2 }} animate={{ ry }}
              transition={lidTransition} />
          </g>
        ))}

        {/* Smiling arcs when the session is done. */}
        <AnimatePresence>
          {mood === 'happy' && EYES.map((eye, i) => (
            <motion.path
              key={`smile-${i}`}
              className="eye-smile"
              d={`M ${eye.cx - 30} ${CY + 6} Q ${eye.cx} ${CY - 30} ${eye.cx + 30} ${CY + 6}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>
      </svg>

      <AnimatePresence>
        {mood === 'sleep' && (
          <motion.span className="eyes-z" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span>z</span><span>z</span><span>z</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Eyes
