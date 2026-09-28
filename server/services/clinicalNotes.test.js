import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeNoteText,
  canEditNote,
  authorLabel,
  createClinicalNote,
  updateClinicalNote,
  listClinicalNotes,
} from './clinicalNotes.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

function authFor(user, permissions) {
  return { user, role: roleWith(permissions) }
}

describe('clinical note text', () => {
  it('trims and rejects empty notes', () => {
    assert.equal(normalizeNoteText('  Patient slept well.  '), 'Patient slept well.')
    assert.throws(() => normalizeNoteText('   '), (err) => err.status === 400)
    assert.throws(() => normalizeNoteText('x'.repeat(4001)), (err) => err.status === 400)
  })
})

describe('clinical note authorship', () => {
  it('formats the populated user without storing a duplicate nurse name', () => {
    assert.equal(authorLabel({ name: 'Almaz Tsegaye', role: 'Nurse' }), 'Nurse Almaz Tsegaye')
  })

  it('lets a nurse edit only their own note while the stay is open', () => {
    const nurse = { _id: 'u1', name: 'Almaz', role: 'Nurse' }
    const note = { createdBy: 'u1', isVoided: false }
    const patient = { status: 'admitted' }
    assert.equal(canEditNote(note, authFor(nurse, ['clinicalNotes.editOwn']), patient), true)
    assert.equal(canEditNote(note, authFor({ _id: 'u2' }, ['clinicalNotes.editOwn']), patient), false)
    assert.equal(
      canEditNote(note, authFor({ _id: 'u2' }, ['clinicalNotes.manage']), patient),
      true
    )
    assert.equal(
      canEditNote(note, authFor(nurse, ['clinicalNotes.editOwn']), { status: 'discharged' }),
      false
    )
  })
})

describe('createClinicalNote', () => {
  it('uses the authenticated user and stay, ignoring client authorship fields', async () => {
    const patient = {
      _id: 'stay-1',
      patientId: 'PAT-1',
      status: 'admitted',
    }
    const created = []
    const deps = {
      Patient: { findOne: async () => patient },
      ClinicalNote: {
        create: async (doc) => {
          created.push(doc)
          return { ...doc, _id: 'note-1', createdAt: new Date(), updatedAt: new Date(), isEdited: false, editHistory: [] }
        },
        findById: () => ({
          populate() {
            return this
          },
          then(resolve) {
            resolve({
              _id: 'note-1',
              ...created[0],
              createdBy: { _id: 'nurse-1', name: 'Almaz Tsegaye', role: 'Nurse' },
              createdAt: new Date(),
              updatedAt: new Date(),
              isEdited: false,
              editHistory: [],
            })
          },
        }),
      },
    }

    const result = await createClinicalNote(
      authFor({ _id: 'nurse-1', name: 'Almaz' }, ['clinicalNotes.create']),
      'PAT-1',
      'stay-1',
      {
        note: '  Patient complained of mild abdominal pain.  ',
        createdBy: 'another-user-id',
        patient: 'forged',
        admission: 'forged',
      },
      deps
    )

    assert.equal(created[0].createdBy, 'nurse-1')
    assert.equal(created[0].patientId, 'PAT-1')
    assert.equal(created[0].admissionId, 'stay-1')
    assert.equal(created[0].note, 'Patient complained of mild abdominal pain.')
    assert.equal(result.createdById, 'nurse-1')
  })

  it('rejects notes after discharge', async () => {
    await assert.rejects(
      () =>
        createClinicalNote(
          authFor({ _id: 'nurse-1' }, ['clinicalNotes.create']),
          'PAT-1',
          'stay-1',
          { note: 'Still documenting' },
          {
            Patient: { findOne: async () => ({ _id: 'stay-1', patientId: 'PAT-1', status: 'discharged' }) },
          }
        ),
      (err) => err.status === 400 && /read-only/.test(err.message)
    )
  })
})

describe('updateClinicalNote', () => {
  it('stores the previous text in editHistory', async () => {
    const patient = { _id: 'stay-1', patientId: 'PAT-1', status: 'pending-discharge' }
    const noteDoc = {
      _id: 'note-1',
      patientId: 'PAT-1',
      admissionId: 'stay-1',
      note: 'Patient has abdominal pain.',
      createdBy: { _id: 'nurse-1', name: 'Almaz', role: 'Nurse' },
      isEdited: false,
      isVoided: false,
      editHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      async save() {
        return this
      },
    }
    const deps = {
      Patient: { findOne: async () => patient },
      ClinicalNote: {
        findById() {
          return {
            populate() {
              return this
            },
            then(resolve) {
              resolve(noteDoc)
            },
          }
        },
      },
    }

    const updated = await updateClinicalNote(
      authFor({ _id: 'nurse-1' }, ['clinicalNotes.editOwn']),
      'note-1',
      { note: 'Patient complained of mild abdominal pain.' },
      deps
    )

    assert.equal(noteDoc.note, 'Patient complained of mild abdominal pain.')
    assert.equal(noteDoc.isEdited, true)
    assert.equal(noteDoc.editHistory[0].previousNote, 'Patient has abdominal pain.')
    assert.equal(noteDoc.editHistory[0].editedBy, 'nurse-1')
    assert.equal(updated.isEdited, true)
  })

  it('rejects editing another nurse’s note', async () => {
    await assert.rejects(
      () =>
        updateClinicalNote(
          authFor({ _id: 'nurse-2' }, ['clinicalNotes.editOwn']),
          'note-1',
          { note: 'Changed' },
          {
            Patient: { findOne: async () => ({ _id: 'stay-1', patientId: 'PAT-1', status: 'admitted' }) },
            ClinicalNote: {
              findById() {
                return {
                  populate() {
                    return this
                  },
                  then(resolve) {
                    resolve({
                      _id: 'note-1',
                      patientId: 'PAT-1',
                      admissionId: 'stay-1',
                      note: 'Original',
                      createdBy: { _id: 'nurse-1', name: 'Almaz', role: 'Nurse' },
                      isVoided: false,
                      editHistory: [],
                    })
                  },
                }
              },
            },
          }
        ),
      (err) => err.status === 403
    )
  })
})

describe('listClinicalNotes', () => {
  it('does not mix notes from another admission id', async () => {
    await assert.rejects(
      () =>
        listClinicalNotes(authFor({ _id: 'n1' }, ['clinicalNotes.view']), 'PAT-1', 'other-stay', {
          Patient: { findOne: async () => ({ _id: 'stay-1', patientId: 'PAT-1', status: 'admitted' }) },
        }),
      (err) => err.status === 404
    )
  })
})
