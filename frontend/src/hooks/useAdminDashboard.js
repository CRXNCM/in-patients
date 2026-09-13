import { useCallback, useEffect, useState } from 'react'
import { api, USE_API } from '@/api/client'

export function useAdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!USE_API) {
      setData(null)
      setError('Admin dashboard requires the live API.')
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError(null)

    api
      .getAdminDashboard()
      .then((payload) => {
        if (cancelled) return
        setData(payload)
      })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        setError(err.message || 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  return { data, loading, error, reload }
}
