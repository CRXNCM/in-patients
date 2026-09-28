import { useEffect, useMemo, useState } from 'react'
import { api, USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { uniqueSorted } from '@/lib/patientLocation'

export function usePatientLocationLookup(patients = []) {
  const { hasPermission } = useAuth()
  const [beds, setBeds] = useState([])
  const [wards, setWards] = useState([])

  const canReadBeds = hasPermission('rooms.view') || hasPermission('beds.view')
  const canReadWards = hasPermission('wards.view')

  useEffect(() => {
    if (!USE_API) return undefined
    let cancelled = false

    if (canReadBeds) {
      api.getSetupBeds()
        .then((rows) => {
          if (!cancelled) setBeds(Array.isArray(rows) ? rows : [])
        })
        .catch(() => {
          if (!cancelled) setBeds([])
        })
    }

    if (canReadWards) {
      api.getWards()
        .then((rows) => {
          if (!cancelled) setWards(Array.isArray(rows) ? rows.filter((row) => row.active !== false) : [])
        })
        .catch(() => {
          if (!cancelled) setWards([])
        })
    }

    return () => {
      cancelled = true
    }
  }, [canReadBeds, canReadWards])

  const bedsByLabel = useMemo(
    () => Object.fromEntries(beds.filter((bed) => bed.label).map((bed) => [bed.label, bed])),
    [beds]
  )

  const roomTypeOptions = useMemo(() => {
    const fromBeds = beds.map((bed) => bed.roomType)
    const fromPatients = patients.map((patient) => patient.room)
    return uniqueSorted([...fromBeds, ...fromPatients])
  }, [beds, patients])

  const wardOptions = useMemo(() => {
    if (wards.length) {
      return wards
        .map((ward) => ({ id: ward.id, name: ward.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    const fromBeds = beds
      .filter((bed) => bed.wardName)
      .map((bed) => ({ id: bed.wardId || bed.wardName, name: bed.wardName }))
    const seen = new Map()
    for (const row of fromBeds) {
      if (!seen.has(row.name)) seen.set(row.name, row)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [beds, wards])

  return { bedsByLabel, roomTypeOptions, wardOptions }
}
