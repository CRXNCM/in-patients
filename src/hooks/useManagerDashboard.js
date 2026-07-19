import { useEffect, useState } from 'react'
import { api, USE_API } from '@/api/client'
import {
  patients as mockPatients,
  revenueByDepartment as mockRevenueByDept,
  dailyRevenueTrend as mockDailyTrend,
  topServices as mockTopServices,
  topMedicines as mockTopMedicines,
  getPatientBalanceStatus,
} from '@/data/mockData'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useBillingConfig } from '@/context/BillingConfigContext'

export function useManagerDashboard() {
  const { patients } = usePatients()
  const { records } = useServiceEntries()
  const { settings } = useBillingConfig()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(USE_API)

  useEffect(() => {
    if (USE_API) {
      api
        .getManagerDashboard()
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false))
      return undefined
    }

    const threshold = settings.lowBalanceThreshold ?? 3000
    const list = patients.length ? patients : mockPatients
    const totalDeposits = list.reduce((s, p) => s + (p.deposit || 0), 0)
    const outstandingBalance = list.reduce((s, p) => s + Math.max(0, (p.totalCharges || 0) - (p.deposit || 0)), 0)
    const nearLowBalance = list.filter((p) => getPatientBalanceStatus(p, threshold) !== 'sufficient').length

    const recentPatients = list
      .slice()
      .sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''))
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        deposit: p.deposit || 0,
        balance: (p.deposit || 0) - (p.totalCharges || 0),
        admissionDate: p.admissionDate,
        room: p.room,
        bed: p.bed,
      }))

    setData({
      stats: {
        todayRevenue: 59500,
        monthlyRevenue: 1203000,
        totalDeposits,
        outstandingBalance,
        inpatientCount: list.length,
        nearLowBalance,
      },
      revenueByDepartment: mockRevenueByDept,
      dailyRevenueTrend: mockDailyTrend,
      topServices: mockTopServices,
      topMedicines: mockTopMedicines,
      recentPatients,
      hospitalName: settings.name,
    })
    setLoading(false)
    return undefined
  }, [patients, records, settings])

  return { data, loading }
}
