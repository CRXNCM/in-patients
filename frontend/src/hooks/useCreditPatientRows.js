import { useMemo } from 'react'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { computeCreditState } from '@/lib/credit'

export function useCreditPatientRows({ includeDischarged = true } = {}) {
  const { patients, dischargedPatients } = usePatients()
  const { getPatientBalance } = useServiceEntries()

  return useMemo(() => {
    const source = includeDischarged ? [...patients, ...dischargedPatients] : patients
    const rows = source
      .filter((patient) => {
        const credit = computeCreditState(patient)
        return credit.isCreditPatient || credit.formerCreditPatient
      })
      .map((patient) => {
        const credit = computeCreditState(patient)
        const balance = getPatientBalance(patient)
        const outstanding = Math.max(0, (balance.totalCharges || 0) - (patient.deposit || 0))
        return {
          ...patient,
          creditStatus: credit.depositStatus,
          formerCreditPatient: credit.formerCreditPatient,
          isCreditPatient: credit.isCreditPatient,
          outstanding,
          remaining: balance.remainingBalance,
          companyName: patient.creditCompanyName || patient.formerCreditCompanyName || '',
        }
      })

    const active = rows.filter((row) => row.isCreditPatient && row.status !== 'discharged')
    const unpaid = active.filter((row) => row.creditStatus === 'unpaid')
    const partial = active.filter((row) => row.creditStatus === 'partially-paid')
    const settled = rows.filter((row) => row.formerCreditPatient && !row.isCreditPatient)
    const outstandingTotal = active.reduce((sum, row) => sum + (row.outstanding || 0), 0)
    const collected = active.reduce((sum, row) => sum + (Number(row.deposit) || 0), 0)
    const byCompany = new Map()
    for (const row of active) {
      const key = row.creditCompanyId || row.companyName || 'unrecorded'
      if (!byCompany.has(key)) {
        byCompany.set(key, { name: row.companyName || 'Company not recorded', patients: 0, outstanding: 0 })
      }
      const group = byCompany.get(key)
      group.patients += 1
      group.outstanding += row.outstanding || 0
    }

    return {
      rows,
      active,
      unpaid,
      partial,
      settled,
      outstandingTotal,
      collected,
      companies: [...byCompany.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [dischargedPatients, getPatientBalance, includeDischarged, patients])
}
