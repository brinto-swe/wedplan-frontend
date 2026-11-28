"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

export function HomeEntrance({ children, hero = false, className }: {
  children: ReactNode
  hero?: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const rest = { y: 0 }
  return <motion.div
    className={className ? `wp-home-entrance ${className}` : "wp-home-entrance"}
    initial={{ y: 10 }}
    animate={hero || reduced ? rest : undefined}
    whileInView={hero || reduced ? undefined : rest}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ duration: reduced ? 0 : 0.32, ease: "easeOut" }}
  >{children}</motion.div>
}
