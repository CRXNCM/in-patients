import { useCallback, useEffect, useRef, useState } from 'react'
import { USE_API } from '@/api/client'
import { useLiveSync } from '@/context/LiveSyncContext'

export function useDashboardResource(fetcher, requiresApiMessage) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const hasDataRef = useRef(false)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useLiveSync(reload)

  useEffect(() => {
    let cancelled = false

    if (!USE_API) {
      setData(null)
      setError(requiresApiMessage)
      setLoading(false)
      return undefined
    }

    if (!hasDataRef.current) setLoading(true)
    setError(null)

    fetcher()
      .then((payload) => {
        if (cancelled) return
        hasDataRef.current = true
        setData(payload)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (!hasDataRef.current) setData(null)
        setError(err.message || 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetcher, reloadToken, requiresApiMessage])

  return { data, loading, error, reload }
}
