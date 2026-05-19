import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'

export function useScrollReveal() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  useEffect(() => {
    if (isInView && ref.current) {
      ref.current.classList.add('animate-fade-up')
    }
  }, [isInView])

  return ref
}