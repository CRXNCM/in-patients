import * as React from 'react'
import {
  serviceCategories as initialCategories,
  hospitalSettings as initialSettings,
  BILLING_TYPES,
} from '@/data/mockData'

const BillingConfigContext = React.createContext(null)

export function BillingConfigProvider({ children }) {
  const [categories, setCategories] = React.useState(initialCategories)
  const [settings, setSettings] = React.useState({ ...initialSettings })

  const updateCategoryBillingType = React.useCallback((categoryId, billingType) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, billingType } : c))
    )
  }, [])

  const updateSettings = React.useCallback((partial) => {
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
