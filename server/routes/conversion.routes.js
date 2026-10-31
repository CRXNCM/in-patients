import { Router } from 'express'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { loadResolvedSettings } from '../utils/settings.js'
import { Bed } from '../models/Bed.js'
import { RoomAssignment } from '../models/RoomAssignment.js'
import { toFrontendPatient, buildRoomHistory, buildRoomsFromBeds } from '../utils/mappers.js'
import {
  actorFromReq,
  cancelConversionRequest,
  completeReceptionConversion,
  completeSelfConversion,
  listPatientConversionRequests,
  listReceptionConversionQueue,
  rejectConversionRequest,
  requestInpatientAdmission,
  resubmitConversionRequest,
  returnConversionRequest,
  toFrontendConversionRequest,
} from '../services/conversionRequests.js'

const router = Router()

function mapConvertedPatient(result) {
  return {
    ...toFrontendPatient(result.patient, result.balance),
    assignedDoctors: result.assignedDoctors || [],
  }
}

router.get(
  '/conversion-requests',
  authRequired,
  requirePermission('admissions.convert_inpatient'),
  async (_req, res) => {
    try {
      const requests = await listReceptionConversionQueue()
      res.json({ requests })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load inpatient admission requests' })
    }
  }
)

router.get(
  '/patients/:id/conversion-requests',
  authRequired,
  requireAnyPermission('admissions.request_inpatient', 'admissions.convert_inpatient', 'admissions.convert_inpatient_self', 'patients.view'),
  async (req, res) => {
    try {
      const requests = await listPatientConversionRequests(req.params.id)
      const active = requests.find((row) => ['pending', 'returned', 'resubmitted'].includes(row.status)) || null
      res.json({ requests, active, latest: requests[0] || null })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to load conversion requests' })
    }
  }
)

router.post(
  '/patients/:id/conversion-requests',
  authRequired,
  requirePermission('admissions.request_inpatient'),
  async (req, res) => {
    try {
      const request = await requestInpatientAdmission({
        patientId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
      })
      res.status(201).json({ request: toFrontendConversionRequest(request) })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to submit inpatient admission request' })
    }
  }
)

router.post(
  '/conversion-requests/:id/resubmit',
  authRequired,
  requirePermission('admissions.request_inpatient'),
  async (req, res) => {
    try {
      const { request } = await resubmitConversionRequest({
        requestId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
      })
      res.json({ request: toFrontendConversionRequest(request) })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to resubmit conversion request' })
    }
  }
)

router.post(
  '/conversion-requests/:id/return',
  authRequired,
  requirePermission('admissions.convert_inpatient'),
  async (req, res) => {
    try {
      const request = await returnConversionRequest({
        requestId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
      })
      res.json({ request: toFrontendConversionRequest(request) })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to return conversion request' })
    }
  }
)

router.post(
  '/conversion-requests/:id/reject',
  authRequired,
  requirePermission('admissions.convert_inpatient'),
  async (req, res) => {
    try {
      const request = await rejectConversionRequest({
        requestId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
      })
      res.json({ request: toFrontendConversionRequest(request) })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to reject conversion request' })
    }
  }
)

router.post(
  '/conversion-requests/:id/cancel',
  authRequired,
  requireAnyPermission('admissions.request_inpatient', 'admissions.convert_inpatient'),
  async (req, res) => {
    try {
      const request = await cancelConversionRequest({
        requestId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
      })
      res.json({ request: toFrontendConversionRequest(request) })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to cancel conversion request' })
    }
  }
)

router.post(
  '/conversion-requests/:id/complete',
  authRequired,
  requirePermission('admissions.convert_inpatient'),
  async (req, res) => {
    try {
      const rules = await loadResolvedSettings(HospitalSettings)
      const result = await completeReceptionConversion({
        requestId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
        userName: req.user.name,
        rules,
      })
      const assignments = await RoomAssignment.find({ patientId: result.patient.patientId }).sort({ startDate: 1 })
      const beds = await Bed.find()
      res.json({
        request: toFrontendConversionRequest(result.request, result.patient),
        patient: {
          ...mapConvertedPatient(result),
          roomHistory: buildRoomHistory(assignments),
        },
        rooms: buildRoomsFromBeds(beds),
      })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to complete inpatient admission' })
    }
  }
)

router.post(
  '/patients/:id/convert-to-inpatient/self',
  authRequired,
  requirePermission('admissions.convert_inpatient_self'),
  async (req, res) => {
    try {
      const rules = await loadResolvedSettings(HospitalSettings)
      const result = await completeSelfConversion({
        patientId: req.params.id,
        body: req.body,
        actor: actorFromReq(req),
        userName: req.user.name,
        rules,
      })
      const assignments = await RoomAssignment.find({ patientId: req.params.id }).sort({ startDate: 1 })
      const beds = await Bed.find()
      res.json({
        request: toFrontendConversionRequest(result.request, result.patient),
        patient: {
          ...mapConvertedPatient(result),
          roomHistory: buildRoomHistory(assignments),
        },
        rooms: buildRoomsFromBeds(beds),
      })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error(err)
      res.status(500).json({ error: 'Failed to complete self-conversion' })
    }
  }
)

export default router
