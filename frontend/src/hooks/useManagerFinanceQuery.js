import { useCallback, useEffect, useState } from 'react'
import { USE_API } from '@/api/client'

export function useManagerFinanceQuery(fetcher, params, requiresApiMessage) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const serialized = JSON.stringify(params)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!USE_API) {
      setData(null)
      setError(requiresApiMessage)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError(null)

    fetcher(JSON.parse(serialized))
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        setError(err.message || 'Failed to load report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetcher, serialized, reloadToken, requiresApiMessage])

  return { data, loading, error, reload }
}
