import * as React from 'react'
import {
  patients as initialPatients,
  depositHistory,
  hospitalRooms as initialHospitalRooms,
  initialRoomAssignments,
  getRoomById,
  getBedById,
  getRoomAssignmentForDate as findAssignmentForDate,
  getServiceNameForRoomType,
} from '@/data/mockData'
import { api, USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'

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
  const { isAuthenticated, authReady } = useAuth()
  const [patients, setPatients] = React.useState(() => (USE_API ? [] : initialPatients.map(withRoomHistory)))
  const [dischargedPatients, setDischargedPatients] = React.useState([])
  const [deposits, setDeposits] = React.useState(() => (USE_API ? {} : depositHistory))
  const [rooms, setRooms] = React.useState(() => (USE_API ? [] : initialHospitalRooms))
  const [roomAssignments, setRoomAssignments] = React.useState(() => (USE_API ? [] : initialRoomAssignments))
  const [loading, setLoading] = React.useState(USE_API)

  const refreshFromApi = React.useCallback(async () => {
    const [data, discharged] = await Promise.all([
      api.getPatientsFull(),
      api.getDischargedPatients().catch(() => []),
    ])
    setPatients(data.patients.map(withRoomHistory))
    setDischargedPatients((discharged || []).map(withRoomHistory))
    setDeposits(data.deposits)
    setRoomAssignments(data.assignments)
    setRooms(data.rooms)
    return data
  }, [])

  React.useEffect(() => {
    if (!USE_API || !authReady) return undefined
    if (!isAuthenticated) {
      setPatients([])
      setDischargedPatients([])
      setDeposits({})
      setRoomAssignments([])
      setRooms([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    refreshFromApi()
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshFromApi, isAuthenticated, authReady])

  const addPatient = React.useCallback(
    async (patientData) => {
      if (USE_API) {
        let bedLabel = patientData.bed
        if (!bedLabel) {
          const room = rooms.find((r) => r.roomType === patientData.room)
          const avail = room?.beds.find((b) => b.status === 'available')
          if (!avail) throw new Error('No available bed for selected room type')
          bedLabel = avail.label
        }
        const admissionDate = patientData.admissionDate || new Date().toISOString().split('T')[0]
        const res = await api.createPatient({
          name: patientData.name,
          age: patientData.age,
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          phone: patientData.phone,
          address: patientData.address,
          mrn: patientData.mrn,
          nationalId: patientData.nationalId,
          admissionDate,
          bedId: bedLabel,
          depositAmount: patientData.initialDeposit ?? patientData.deposit ?? 0,
          depositMethod: patientData.depositType || 'Cash',
          referenceNumber: patientData.referenceNumber,
        })
        const patient = withRoomHistory(res.patient)
        setPatients((prev) => [patient, ...prev])
        if (res.rooms) setRooms(res.rooms)
        if (patientData.initialDeposit > 0) {
          setDeposits((prev) => ({
            ...prev,
            [patient.id]: [
              {
                id: Date.now(),
                date: admissionDate,
                amount: patientData.initialDeposit,
                method: patientData.depositType,
                receivedBy: 'Reception',
                isInitial: true,
              },
            ],
          }))
        }
        return patient
      }

      const id = `PAT-${String(Date.now()).slice(-6)}`
      const admissionDate = patientData.admissionDate || new Date().toISOString().split('T')[0]
      const roomConfig = initialHospitalRooms.find((r) => r.roomType === patientData.room)
      let bedLabel = patientData.bed
      if (!bedLabel && roomConfig) {
        const avail = roomConfig.beds.find((b) => b.status === 'available')
        bedLabel = avail?.label || `${roomConfig.roomType === 'General Ward' ? 'GW' : 'PR'}-01`
      }
      const bedId = `BED-${bedLabel}`

      const patient = withRoomHistory({
        id,
        status: 'admitted',
        pendingDischarge: false,
        disabledDoctorVisits: {},
        ...patientData,
        admissionDate,
        bed: bedLabel,
        deposit: patientData.deposit ?? patientData.initialDeposit ?? 0,
        roomHistory: [
          {
            room: patientData.room,
            bed: bedLabel,
            fromDate: admissionDate,
            toDate: null,
          },
        ],
      })

      setPatients((prev) => [patient, ...prev])

      if (roomConfig) {
        setRoomAssignments((prev) => [
          ...prev,
          {
            id: `RA-${id}-001`,
            admission_id: id,
            room_id: roomConfig.id,
            bed_id: bedId,
            start_date: admissionDate,
            end_date: null,
            daily_rate: roomConfig.dailyRate,
            transfer_reason: 'Initial admission',
            assigned_by: 'Sara Bekele',
          },
        ])
        setRooms((prev) =>
          prev.map((room) =>
            room.id === roomConfig.id
              ? {
                  ...room,
                  beds: room.beds.map((b) =>
                    b.id === bedId ? { ...b, status: 'occupied', patientId: id } : b
                  ),
                }
              : room
          )
        )
      }

      if (patientData.initialDeposit > 0) {
        setDeposits((prev) => ({
          ...prev,
          [id]: [{
            id: Date.now(),
            date: admissionDate,
            amount: patientData.initialDeposit,
            method: patientData.depositType,
            receivedBy: 'Sara Bekele',
            isInitial: true,
          }],
        }))
      }

      return patient
    },
    [rooms]
  )

  const getPatient = React.useCallback(
    (id) => patients.find((p) => p.id === id) || dischargedPatients.find((p) => p.id === id),
    [patients, dischargedPatients]
  )

  const getPatientDeposits = React.useCallback(
    (patientId) => deposits[patientId] || depositHistory[patientId] || [],
    [deposits]
  )

  const addDeposit = React.useCallback(
    async (patientId, { amount, method, referenceNumber, receivedBy = 'Sara Bekele', isInitial = false }) => {
      if (USE_API) {
        const entry = await api.addDeposit(patientId, {
          amount,
          method,
          referenceNumber,
        })
        setDeposits((prev) => ({
          ...prev,
          [patientId]: [...(prev[patientId] || []), { ...entry, receivedBy: entry.receivedBy || receivedBy }],
        }))
        setPatients((prev) =>
          prev.map((p) => (p.id === patientId ? { ...p, deposit: p.deposit + Number(amount) } : p))
        )
        return entry
      }

      const entry = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        amount: Number(amount),
        method,
        referenceNumber: referenceNumber || '',
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
    },
    []
  )

  const getRoomAssignments = React.useCallback(
    (admissionId) => roomAssignments.filter((a) => a.admission_id === admissionId),
    [roomAssignments]
  )

  const getRoomAssignmentForDate = React.useCallback(
    (admissionId, date) => findAssignmentForDate(roomAssignments, admissionId, date),
    [roomAssignments]
  )

  const transferPatientRoom = React.useCallback(
    async (patientId, { roomId, bedId, transferDate, transferReason, assignedBy = 'Sara Bekele' }) => {
      if (USE_API) {
        const bedLabel = String(bedId).replace(/^BED-/, '')
        const res = await api.transferRoom(patientId, {
          bedId: bedLabel,
          transferDate,
          transferReason,
        })
        setPatients((prev) =>
          prev.map((p) => (p.id === patientId ? withRoomHistory(res.patient) : p))
        )
        setRoomAssignments(res.assignments)
        setRooms(res.rooms)
        return {
          assignment: res.assignments[res.assignments.length - 1],
          roomType: res.roomType,
          bedLabel: res.bedLabel,
          dailyRate: res.dailyRate,
        }
      }

      const patient = patients.find((p) => p.id === patientId)
      if (!patient || patient.status === 'discharged' || patient.status === 'pending-discharge') return null

      const target = getBedById(rooms, bedId)
      if (!target || target.bed.status !== 'available' || target.room.id !== roomId) return null

      const currentAssignment = roomAssignments.find(
        (a) => a.admission_id === patientId && a.end_date === null
      )
      if (!currentAssignment) return null

      const newAssignment = {
        id: `RA-${patientId}-${Date.now()}`,
        admission_id: patientId,
        room_id: roomId,
        bed_id: bedId,
        start_date: transferDate,
        end_date: null,
        daily_rate: target.room.dailyRate,
        transfer_reason: transferReason,
        assigned_by: assignedBy,
      }

      setRoomAssignments((prev) =>
        prev.map((a) =>
          a.id === currentAssignment.id ? { ...a, end_date: transferDate } : a
        ).concat(newAssignment)
      )

      setRooms((prev) =>
        prev.map((room) => ({
          ...room,
          beds: room.beds.map((bed) => {
            if (bed.id === currentAssignment.bed_id) {
              return { ...bed, status: 'available', patientId: null }
            }
            if (bed.id === bedId) {
              return { ...bed, status: 'occupied', patientId }
            }
            return bed
          }),
        }))
      )

      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== patientId) return p
          const history = [...(p.roomHistory || [])]
          if (history.length) {
            const last = history[history.length - 1]
            if (!last.toDate) last.toDate = transferDate
          }
          history.push({
            room: target.room.roomType,
            bed: target.bed.label,
            fromDate: transferDate,
            toDate: null,
          })
          return {
            ...p,
            room: target.room.roomType,
            bed: target.bed.label,
            roomHistory: history,
          }
        })
      )

      return {
        assignment: newAssignment,
        roomType: target.room.roomType,
        bedLabel: target.bed.label,
        dailyRate: target.room.dailyRate,
      }
    },
    [patients, rooms, roomAssignments]
  )

  const transferRoom = React.useCallback(
    async (patientId, { room, bed, fromDate, transferReason = 'Room transfer', assignedBy = 'Sara Bekele' }) => {
      const roomConfig = rooms.find((r) => r.roomType === room)
      const bedId = `BED-${bed}`
      if (!roomConfig) return null
      return transferPatientRoom(patientId, {
        roomId: roomConfig.id,
        bedId,
        transferDate: fromDate,
        transferReason,
        assignedBy,
      })
    },
    [rooms, transferPatientRoom]
  )

  const setDoctorVisitDisabled = React.useCallback(async (patientId, date, disabled) => {
    if (USE_API) {
      const updated = await api.setDoctorVisit(patientId, date, disabled)
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId
            ? { ...p, disabledDoctorVisits: updated.disabledDoctorVisits }
            : p
        )
      )
      return
    }

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

  const getRoomForDate = React.useCallback(
    (patient, date) => {
      const assignment = findAssignmentForDate(roomAssignments, patient.id, date)
      if (assignment) {
        const room = getRoomById(rooms, assignment.room_id)
        const bed = room?.beds.find((b) => b.id === assignment.bed_id)
        return {
          room: room?.roomType || patient.room,
          bed: bed?.label || patient.bed,
          dailyRate: assignment.daily_rate,
          serviceName: getServiceNameForRoomType(room?.roomType || patient.room),
          assignmentId: assignment.id,
        }
      }
      const history = patient.roomHistory || []
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i]
        if (h.fromDate <= date && (!h.toDate || h.toDate > date)) {
          return {
            room: h.room,
            bed: h.bed,
            dailyRate: getRoomById(rooms, rooms.find((r) => r.roomType === h.room)?.id)?.dailyRate,
            serviceName: getServiceNameForRoomType(h.room),
          }
        }
      }
      return {
        room: patient.room,
        bed: patient.bed,
        dailyRate: getRoomById(rooms, rooms.find((r) => r.roomType === patient.room)?.id)?.dailyRate,
        serviceName: getServiceNameForRoomType(patient.room),
      }
    },
    [roomAssignments, rooms]
  )

  const applyPatientUpdate = React.useCallback((updated) => {
    const mapped = withRoomHistory(updated)
    setPatients((prev) => {
      if (mapped.status === 'discharged') return prev.filter((p) => p.id !== mapped.id)
      const exists = prev.some((p) => p.id === mapped.id)
      return exists ? prev.map((p) => (p.id === mapped.id ? { ...p, ...mapped } : p)) : [mapped, ...prev]
    })
    setDischargedPatients((prev) => {
      if (mapped.status !== 'discharged') return prev.filter((p) => p.id !== mapped.id)
      const exists = prev.some((p) => p.id === mapped.id)
      return exists ? prev.map((p) => (p.id === mapped.id ? { ...p, ...mapped } : p)) : [mapped, ...prev]
    })
    return mapped
  }, [])

  const requestDischarge = React.useCallback(
    async (patientId, { notes = '' } = {}) => {
      if (USE_API) {
        const updated = await api.requestDischarge(patientId, { notes })
        return applyPatientUpdate(updated)
      }

      const patient = patients.find((p) => p.id === patientId)
      if (!patient || patient.status !== 'admitted') {
        throw new Error(
          patient?.status === 'pending-discharge'
            ? 'A discharge request is already pending.'
            : patient?.status === 'discharged'
              ? 'Patient is already discharged.'
              : 'Discharge can only be requested for admitted patients.'
        )
      }
      const now = new Date().toISOString()
      const updated = {
        ...patient,
        status: 'pending-discharge',
        pendingDischarge: true,
        discharge: {
          ...(patient.discharge || {}),
          requestedBy: 'Nurse Almaz Tsegaye',
          requestedAt: now,
          requestNotes: notes,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: '',
          events: [
            ...((patient.discharge?.events) || []),
            { action: 'requested', by: 'Nurse Almaz Tsegaye', at: now, note: notes || 'Discharge requested' },
          ],
        },
      }
      return applyPatientUpdate(updated)
    },
    [applyPatientUpdate, patients]
  )

  const rejectDischarge = React.useCallback(
    async (patientId, reason) => {
      const trimmed = String(reason || '').trim()
      if (!trimmed) throw new Error('Rejection reason is required.')

      if (USE_API) {
        const updated = await api.rejectDischarge(patientId, trimmed)
        return applyPatientUpdate(updated)
      }

      const patient = patients.find((p) => p.id === patientId)
      if (!patient || patient.status !== 'pending-discharge') {
        throw new Error('Patient does not have a pending discharge request.')
      }
      const now = new Date().toISOString()
      const updated = {
        ...patient,
        status: 'admitted',
        pendingDischarge: false,
        discharge: {
          ...(patient.discharge || {}),
          rejectedBy: 'Sara Bekele',
          rejectedAt: now,
          rejectionReason: trimmed,
          events: [
            ...((patient.discharge?.events) || []),
            { action: 'rejected', by: 'Sara Bekele', at: now, note: trimmed },
          ],
        },
      }
      return applyPatientUpdate(updated)
    },
    [applyPatientUpdate, patients]
  )

  const approveDischarge = React.useCallback(
    async (patientId) => {
      if (USE_API) {
        const res = await api.approveDischarge(patientId)
        applyPatientUpdate(res.patient)
        if (res.assignments) setRoomAssignments(res.assignments)
        if (res.rooms) setRooms(res.rooms)
        return res.patient
      }

      const patient = patients.find((p) => p.id === patientId)
      if (!patient || patient.status !== 'pending-discharge') {
        throw new Error(
          patient?.status === 'discharged'
            ? 'Patient is already discharged.'
            : 'Patient does not have a pending discharge request.'
        )
      }

      const currentAssignment = roomAssignments.find((a) => a.admission_id === patientId && a.end_date === null)
      if (!currentAssignment) throw new Error('No active room assignment. Cannot complete discharge.')

      const dischargeDate = new Date().toISOString().split('T')[0]
      const now = new Date().toISOString()
      const updated = {
        ...patient,
        status: 'discharged',
        pendingDischarge: false,
        roomHistory: (patient.roomHistory || []).map((h, i, arr) =>
          i === arr.length - 1 && !h.toDate ? { ...h, toDate: dischargeDate } : h
        ),
        discharge: {
          ...(patient.discharge || {}),
          completedBy: 'Sara Bekele',
          completedAt: now,
          finalRoom: patient.room,
          finalBed: patient.bed,
          finalCharges: patient.totalCharges,
          finalDeposits: patient.deposit,
          finalBalance: (patient.deposit || 0) - (patient.totalCharges || 0),
          events: [
            ...((patient.discharge?.events) || []),
            { action: 'approved', by: 'Sara Bekele', at: now, note: 'Discharge completed' },
          ],
        },
      }

      setRoomAssignments((prev) =>
        prev.map((a) => (a.id === currentAssignment.id ? { ...a, end_date: dischargeDate } : a))
      )
      setRooms((prev) =>
        prev.map((room) => ({
          ...room,
          beds: room.beds.map((bed) =>
            bed.id === currentAssignment.bed_id || bed.label === patient.bed
              ? { ...bed, status: 'available', patientId: null }
              : bed
          ),
        }))
      )
      return applyPatientUpdate(updated)
    },
    [applyPatientUpdate, patients, roomAssignments]
  )

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
        dischargedPatients,
        rooms,
        roomAssignments,
        loading,
        refreshFromApi,
        addPatient,
        getPatient,
        getPatientDeposits,
        addDeposit,
        getTotalDeposit,
        transferRoom,
        transferPatientRoom,
        getRoomAssignments,
        getRoomAssignmentForDate,
        setDoctorVisitDisabled,
        getRoomForDate,
        requestDischarge,
        rejectDischarge,
        approveDischarge,
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
