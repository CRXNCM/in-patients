import * as React from 'react'
import { patients as initialPatients, depositHistory } from '@/data/mockData'

const PatientsContext = React.createContext(null)

function withRoomHistory(patient) {
  if (patient.roomHistory?.length) return patient
  return {
    ...patient,
    roomHistory: [
      {
        room: patient.room,
        bed: patient.bed,
        fromDate: patient.admissionDate,
        toDate: null,
      },
    ],
    disabledDoctorVisits: patient.disabledDoctorVisits || {},
  }
}

export function PatientsProvider({ children }) {
  const [patients, setPatients] = React.useState(() => initialPatients.map(withRoomHistory))
  const [deposits, setDeposits] = React.useState(depositHistory)

  const addPatient = React.useCallback((patientData) => {
    const id = `PAT-${String(Date.now()).slice(-6)}`
    const patient = withRoomHistory({
      id,
      status: 'admitted',
      pendingDischarge: false,
      disabledDoctorVisits: {},
      ...patientData,
      roomHistory: [
        {
          room: patientData.room,
          bed: patientData.bed,
          fromDate: patientData.admissionDate,
          toDate: null,
        },
      ],
    })
    setPatients((prev) => [patient, ...prev])

    if (patientData.initialDeposit > 0) {
      setDeposits((prev) => ({
        ...prev,
        [id]: [{
          id: Date.now(),
          date: patientData.admissionDate || new Date().toISOString().split('T')[0],
          amount: patientData.initialDeposit,
          method: patientData.depositType,
          receivedBy: 'Sara Bekele',
          isInitial: true,
        }],
      }))
    }

    return patient
  }, [])

  const getPatient = React.useCallback(
    (id) => patients.find((p) => p.id === id),
    [patients]
  )

  const getPatientDeposits = React.useCallback(
    (patientId) => deposits[patientId] || depositHistory[patientId] || [],
    [deposits]
  )

  const addDeposit = React.useCallback((patientId, { amount, method, receivedBy = 'Sara Bekele', isInitial = false }) => {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      amount: Number(amount),
      method,
      receivedBy,
      isInitial,
    }
    setDeposits((prev) => ({
      ...prev,
      [patientId]: [...(prev[patientId] || depositHistory[patientId] || []), entry],
    }))
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, deposit: p.deposit + Number(amount) } : p
      )
    )
    return entry
  }, [])

  const transferRoom = React.useCallback((patientId, { room, bed, fromDate }) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p
        const history = [...(p.roomHistory || [])]
        if (history.length) {
          const last = history[history.length - 1]
          if (!last.toDate) last.toDate = fromDate
        }
        history.push({ room, bed, fromDate, toDate: null })
        return { ...p, room, bed, roomHistory: history }
      })
    )
  }, [])

  const setDoctorVisitDisabled = React.useCallback((patientId, date, disabled) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p
        const map = { ...(p.disabledDoctorVisits || {}) }
        if (disabled) map[date] = true
        else delete map[date]
        return { ...p, disabledDoctorVisits: map }
      })
    )
  }, [])

  const getRoomForDate = React.useCallback((patient, date) => {
    const history = patient.roomHistory || []
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i]
      if (h.fromDate <= date && (!h.toDate || h.toDate > date)) {
        return { room: h.room, bed: h.bed }
      }
    }
    return { room: patient.room, bed: patient.bed }
  }, [])

  const getTotalDeposit = React.useCallback(
    (patientId) => {
      const p = patients.find((pt) => pt.id === patientId)
      return p?.deposit || 0
    },
    [patients]
  )

  return (
    <PatientsContext.Provider
      value={{
        patients,
        addPatient,
        getPatient,
        getPatientDeposits,
        addDeposit,
        getTotalDeposit,
        transferRoom,
        setDoctorVisitDisabled,
        getRoomForDate,
      }}
    >
      {children}
    </PatientsContext.Provider>
  )
}

export function usePatients() {
  const ctx = React.useContext(PatientsContext)
  if (!ctx) throw new Error('usePatients must be used within PatientsProvider')
  return ctx
}
