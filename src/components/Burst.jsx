import { useState } from 'react'
import { motion } from 'motion/react'

const BURST_COLORS = ['#8a7cf4', '#44cf6e', '#b4abfa', '#e0b44c', '#dadada']

// Confetti that pops out of its parent and falls away. Remount (change key) to fire again.
function Burst({ count = 24, spread = 300, height = 110 }) {
  const [bits] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * spread,
      y: -height * 0.45 - Math.random() * height,
      rotate: (Math.random() - 0.5) * 600,
      size: 4 + Math.random() * 4,
      delay: Math.random() * 0.08,
      color: BURST_COLORS[i % BURST_COLORS.length],
    })),
  )
  return (
    <span className="burst" aria-hidden="true">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="burst-bit"
          style={{ background: b.color, width: b.size, height: b.size * 1.6 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + height], opacity: [1, 1, 0], rotate: b.rotate }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: b.delay }}
        />
      ))}
    </span>
  )
}

export default Burst
