import * as React from 'react'
import { USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'

export const LIVE_SYNC_POLL_MS = 8000

const LiveSyncContext = React.createContext({
  subscribe: () => () => {},
})

export function LiveSyncProvider({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  const { refreshFromApi } = usePatients()
  const { refreshRecords } = useServiceEntries()
  const listenersRef = React.useRef(new Set())
  const inFlightRef = React.useRef(false)

  const subscribe = React.useCallback((listener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const tick = React.useCallback(async () => {
    if (!USE_API || inFlightRef.current) return
    inFlightRef.current = true
    try {
      await Promise.all([refreshRecords().catch(() => {}), refreshFromApi().catch(() => {})])
      listenersRef.current.forEach((listener) => {
        try {
          listener()
        } catch {
          /* dashboard reload errors stay on that hook */
        }
      })
    } finally {
      inFlightRef.current = false
    }
  }, [refreshFromApi, refreshRecords])

  React.useEffect(() => {
    if (!USE_API || !authReady || !isAuthenticated) return undefined

    const onFocus = () => {
      tick()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') tick()
    }, LIVE_SYNC_POLL_MS)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [authReady, isAuthenticated, tick])

  const value = React.useMemo(() => ({ subscribe, tick }), [subscribe, tick])

  return <LiveSyncContext.Provider value={value}>{children}</LiveSyncContext.Provider>
}

export function useLiveSync(onTick) {
  const { subscribe } = React.useContext(LiveSyncContext)

  React.useEffect(() => {
    if (!onTick) return undefined
    return subscribe(onTick)
  }, [onTick, subscribe])
}
