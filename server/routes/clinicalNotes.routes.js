import { Router } from 'express'
import { authRequired, requirePermission } from '../middleware/auth.js'
import {
  listClinicalNotes,
  createClinicalNote,
  updateClinicalNote,
  voidClinicalNote,
} from '../services/clinicalNotes.js'

const router = Router()

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message })
  console.error(err)
  return res.status(500).json({ error: fallback })
}

router.get(
  '/patients/:patientId/admissions/:admissionId/clinical-notes',
  authRequired,
  requirePermission('clinicalNotes.view'),
  async (req, res) => {
    try {
      res.json(await listClinicalNotes(req.auth, req.params.patientId, req.params.admissionId))
    } catch (err) {
      sendError(res, err, 'Failed to load clinical notes')
    }
  }
)

router.post(
  '/patients/:patientId/admissions/:admissionId/clinical-notes',
  authRequired,
  requirePermission('clinicalNotes.create'),
  async (req, res) => {
    try {
      const note = await createClinicalNote(req.auth, req.params.patientId, req.params.admissionId, req.body)
      res.status(201).json(note)
    } catch (err) {
      sendError(res, err, 'Failed to save clinical note')
    }
  }
)

router.patch('/clinical-notes/:noteId', authRequired, async (req, res) => {
  try {
    res.json(await updateClinicalNote(req.auth, req.params.noteId, req.body))
  } catch (err) {
    sendError(res, err, 'Failed to update clinical note')
  }
})

router.patch(
  '/clinical-notes/:noteId/void',
  authRequired,
  requirePermission('clinicalNotes.manage'),
  async (req, res) => {
    try {
      res.json(await voidClinicalNote(req.auth, req.params.noteId, req.body))
    } catch (err) {
      sendError(res, err, 'Failed to void clinical note')
    }
  }
)

export default router
