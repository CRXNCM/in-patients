import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * Renders print-only content as a direct child of <body>. Keeping the sheet out
 * of the app layout lets it flow across as many pages as it needs.
 */
export function PrintPortal({ className, children }) {
  const [host, setHost] = useState(null)

  useEffect(() => {
    const node = document.createElement('div')
    node.className = 'print-only'
    document.body.appendChild(node)
    setHost(node)
    return () => node.remove()
  }, [])

  useEffect(() => {
    if (host) host.className = cn('print-only', className)
  }, [host, className])

  if (!host) return null
  return createPortal(children, host)
}
