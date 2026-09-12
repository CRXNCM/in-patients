import * as React from 'react'
import {
  serviceCategories as initialCategories,
  hospitalSettings as initialSettings,
  BILLING_TYPES,
} from '@/data/mockData'
import { api, USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

const BillingConfigContext = React.createContext(null)

export function BillingConfigProvider({ children }) {
  const { isAuthenticated, authReady } = useAuth()
  const [categories, setCategories] = React.useState(initialCategories)
  const [settings, setSettings] = React.useState({ ...initialSettings })
  const [loading, setLoading] = React.useState(USE_API)

  React.useEffect(() => {
    if (!USE_API || !authReady) return undefined
    if (!isAuthenticated) {
      setSettings({ ...initialSettings })
      setCategories(initialCategories)
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    Promise.all([api.getSettings(), api.getCategories()])
      .then(([s, c]) => {
        if (cancelled) return
        setSettings({ ...initialSettings, ...s })
        setCategories(c)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authReady])

  const updateCategoryBillingType = React.useCallback(async (categoryId, billingType) => {
    if (USE_API) {
      const updated = await api.updateCategoryBillingType(categoryId, billingType)
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, billingType: updated.billingType } : c))
      )
      return
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, billingType } : c))
    )
  }, [])

  const updateSettings = React.useCallback(async (partial) => {
    if (USE_API) {
      const updated = await api.updateSettings(partial)
      setSettings((prev) => ({ ...prev, ...updated }))
      return
    }
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  const getCategory = React.useCallback(
    (nameOrId) => categories.find((c) => c.name === nameOrId || c.id === nameOrId),
    [categories]
  )

  const getManualCategories = React.useCallback(
    () => categories.filter((c) => c.billingType !== BILLING_TYPES.AUTOMATIC_DAILY),
    [categories]
  )

  const getQuantityCategories = React.useCallback(
    () => categories.filter((c) => c.billingType === BILLING_TYPES.QUANTITY),
    [categories]
  )

  const getSelectionCategories = React.useCallback(
    () => categories.filter((c) => c.billingType === BILLING_TYPES.SELECTION),
    [categories]
  )

  const getAutomaticCategories = React.useCallback(
    () => categories.filter((c) => c.billingType === BILLING_TYPES.AUTOMATIC_DAILY),
    [categories]
  )

  return (
    <BillingConfigContext.Provider
      value={{
        categories,
        settings,
        loading,
        updateCategoryBillingType,
        updateSettings,
        setCategories,
        getCategory,
        getManualCategories,
        getQuantityCategories,
        getSelectionCategories,
        getAutomaticCategories,
      }}
    >
      {children}
    </BillingConfigContext.Provider>
  )
}

export function useBillingConfig() {
  const ctx = React.useContext(BillingConfigContext)
  if (!ctx) throw new Error('useBillingConfig must be used within BillingConfigProvider')
  return ctx
}
