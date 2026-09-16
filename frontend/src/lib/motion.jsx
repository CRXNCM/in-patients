import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

export const EASE_OUT_SOFT = [0.2, 0.8, 0.2, 1]

export const fadeUp = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
}

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export function enterTransition(reduced) {
  return { duration: reduced ? 0.01 : 0.22, ease: EASE_OUT_SOFT }
}

export function revealTransition(reduced) {
  return { duration: reduced ? 0.01 : 0.18, ease: EASE_OUT_SOFT }
}

export function microTransition(reduced) {
  return { duration: reduced ? 0.01 : 0.14, ease: EASE_OUT_SOFT }
}

export function hoverLift(reduced) {
  return reduced ? undefined : { y: -1 }
}

export function tapPress(reduced) {
  return reduced ? undefined : { y: 1 }
}

export function MotionPage({ children, className, ...props }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={enterTransition(reduced)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function MotionReveal({ children, className, ...props }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={revealTransition(reduced)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export { motion, AnimatePresence, useReducedMotion }
