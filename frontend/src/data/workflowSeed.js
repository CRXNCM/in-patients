import {
  acceptLaboratoryRequest,
  approvePharmacyRequest,
  buildLaboratoryRequest,
  buildPharmacyRequest,
  cancelWorkflowRequest,
  completeLaboratoryRequest,
  rejectPharmacyRequest,
} from '../services/workflowRequests.js'

const almaz = { id: 'seed-nurse-almaz', name: 'Nurse Almaz Tsegaye' }
const bethlehem = { id: 'seed-nurse-bethlehem', name: 'Nurse Bethlehem Haile' }
const helen = { id: 'seed-nurse-helen', name: 'Nurse Helen Bekele' }
const pharmacist = { id: 'seed-pharmacist-dawit', name: 'Dawit Lemma' }
const labTech = { id: 'seed-lab-bethlehem', name: 'Bethlehem Assefa' }

const stays = {
  aster: {
    patientId: 'DEMO-PAT-01',
    patientName: 'Aster Bekele',
    admissionId: 'DEMO-ADM-2401',
    ward: 'Medical Ward',
    room: 'MW-12',
    bed: 'Bed 2',
    demonstration: true,
  },
  yonas: {
    patientId: 'DEMO-PAT-02',
    patientName: 'Yonas Desta',
    admissionId: 'DEMO-ADM-2402',
    ward: 'Surgical Ward',
    room: 'SW-04',
    bed: 'Bed 1',
    demonstration: true,
  },
  selam: {
    patientId: 'DEMO-PAT-03',
    patientName: 'Selam Worku',
    admissionId: 'DEMO-ADM-2403',
    ward: 'Maternity Ward',
    room: 'MAT-02',
    bed: 'Bed 1',
    demonstration: true,
  },
  dawit: {
    patientId: 'DEMO-PAT-04',
    patientName: 'Kebede Lemma',
    admissionId: 'DEMO-ADM-2404',
    ward: 'ICU',
    room: 'ICU-02',
    bed: 'Bed 1',
    demonstration: true,
  },
  hanna: {
    patientId: 'DEMO-PAT-05',
    patientName: 'Hanna Tadesse',
    admissionId: 'DEMO-ADM-2405',
    ward: 'Medical Ward',
    room: 'MW-03',
    bed: 'Bed 4',
    demonstration: true,
  },
  meron: {
    patientId: 'DEMO-PAT-06',
    patientName: 'Meron Getachew',
    admissionId: 'DEMO-ADM-2406',
    ward: 'Medical Ward',
    room: 'MW-08',
    bed: 'Bed 1',
    demonstration: true,
  },
  bereket: {
    patientId: 'DEMO-PAT-07',
    patientName: 'Bereket Hailu',
    admissionId: 'DEMO-ADM-2407',
    ward: 'Surgical Ward',
    room: 'SW-01',
    bed: 'Bed 3',
    demonstration: true,
  },
}

function must(result) {
  if (!result?.request) throw new Error(result?.error || 'Could not build a demonstration request.')
  return result.request
}

function pharmacy(id, stay, actor, at, fields, then) {
  let request = must(buildPharmacyRequest({ ...stay, ...fields }, actor, id, at))
  if (then) request = then(request)
  return request
}

function laboratory(id, stay, actor, at, fields, then) {
  let request = must(buildLaboratoryRequest({ ...stay, priority: 'routine', ...fields }, actor, id, at))
  if (then) request = then(request)
  return request
}

/**
 * Sample ward requests for the frontend prototype.
 * Patient ids use the DEMO- prefix so they stay separate from live admissions.
 */
export function createSeedWorkflowRequests() {
  return [
    pharmacy('PHR-2401', stays.aster, almaz, '2026-10-25T06:15:00.000Z', {
      itemName: 'Ceftriaxone 1g',
      quantity: 2,
      unit: 'vial',
      dosage: '1 g IV every 12 hours',
      note: 'From the morning round sheet.',
    }),
    pharmacy('PHR-2402', stays.yonas, bethlehem, '2026-10-22T08:05:00.000Z', {
      itemName: 'Paracetamol 500mg',
      quantity: 10,
      unit: 'tablet',
      dosage: '500 mg every 8 hours if needed for pain',
      note: 'Pain after dressing change.',
    }),
    pharmacy('PHR-2403', stays.selam, almaz, '2026-10-24T07:20:00.000Z', {
      itemName: 'Amoxicillin 500mg',
      quantity: 21,
      unit: 'capsule',
      dosage: '500 mg every 8 hours for 7 days',
      note: 'Ward antibiotic request.',
    }, (request) => must(approvePharmacyRequest(request, pharmacist, '2026-10-24T07:45:00.000Z'))),
    pharmacy('PHR-2404', stays.dawit, helen, '2026-10-24T11:10:00.000Z', {
      itemName: 'Dopamine IV',
      quantity: 1,
      unit: 'vial',
      dosage: 'Infusion as charted on the ICU sheet',
      note: 'Requested during the ICU round.',
    }, (request) => must(rejectPharmacyRequest(
      request,
      pharmacist,
      'Not dispensed. The ward request does not match a current written order.',
      '2026-10-24T11:25:00.000Z'
    ))),
    pharmacy('PHR-2405', stays.hanna, bethlehem, '2026-10-23T09:00:00.000Z', {
      itemName: 'Omeprazole 20mg',
      quantity: 7,
      unit: 'capsule',
      dosage: '20 mg once daily',
      note: 'Morning dose.',
    }, (request) => must(cancelWorkflowRequest(
      request,
      bethlehem,
      'Patient could not take the planned dose. The ward will send a new request.',
      '2026-10-23T09:20:00.000Z'
    ))),
    pharmacy('PHR-2406', stays.meron, helen, '2026-10-25T04:10:00.000Z', {
      itemName: 'Metformin 500mg',
      quantity: 14,
      unit: 'tablet',
      dosage: '500 mg with breakfast and supper',
      note: 'Continue the home dose while admitted.',
    }),
    pharmacy('PHR-2407', stays.bereket, almaz, '2026-10-18T06:40:00.000Z', {
      itemName: 'IV Normal Saline 500ml',
      quantity: 4,
      unit: 'bag',
      dosage: 'One bag every 8 hours',
      note: 'Post-operative fluids.',
    }, (request) => must(approvePharmacyRequest(request, pharmacist, '2026-10-18T07:05:00.000Z'))),

    laboratory('LAB-2401', stays.aster, almaz, '2026-10-25T05:50:00.000Z', {
      itemName: 'Complete Blood Count (CBC)',
      priority: 'urgent',
      note: 'Fever overnight. Please process this morning.',
    }),
    laboratory('LAB-2402', stays.yonas, bethlehem, '2026-10-21T08:30:00.000Z', {
      itemName: 'Liver Function Test',
      priority: 'routine',
      note: 'Pre-operative baseline.',
    }),
    laboratory('LAB-2403', stays.selam, almaz, '2026-10-24T06:10:00.000Z', {
      itemName: 'Blood Sugar (FBS)',
      priority: 'routine',
      note: 'Fasting sample already at the ward.',
    }, (request) => must(acceptLaboratoryRequest(request, labTech, '2026-10-24T06:25:00.000Z'))),
    laboratory('LAB-2404', stays.hanna, helen, '2026-10-23T10:00:00.000Z', {
      itemName: 'Urinalysis',
      priority: 'routine',
      note: 'Suspected urinary infection.',
    }, (request) => {
      const accepted = must(acceptLaboratoryRequest(request, labTech, '2026-10-23T10:20:00.000Z'))
      return must(completeLaboratoryRequest(
        accepted,
        labTech,
        'Worksheet LAB-DEMO-18 filed. This prototype does not store a laboratory report.',
        '2026-10-23T13:05:00.000Z'
      ))
    }),
    laboratory('LAB-2405', stays.meron, bethlehem, '2026-10-22T07:40:00.000Z', {
      itemName: 'HIV Test',
      priority: 'routine',
      note: 'Admission screening.',
    }, (request) => must(cancelWorkflowRequest(
      request,
      bethlehem,
      'Sample was not collected. The ward cancelled the request.',
      '2026-10-22T08:10:00.000Z'
    ))),
    laboratory('LAB-2406', stays.dawit, helen, '2026-10-25T03:30:00.000Z', {
      itemName: 'Arterial Blood Gas',
      priority: 'urgent',
      note: 'ICU sample to follow the nurse to the bench.',
    }, (request) => must(acceptLaboratoryRequest(request, labTech, '2026-10-25T03:42:00.000Z'))),
    laboratory('LAB-2407', stays.bereket, almaz, '2026-10-18T09:15:00.000Z', {
      itemName: 'Kidney Function Test',
      priority: 'routine',
      note: 'Post-operative check.',
    }, (request) => {
      const accepted = must(acceptLaboratoryRequest(request, labTech, '2026-10-18T09:30:00.000Z'))
      return must(completeLaboratoryRequest(
        accepted,
        labTech,
        'Run finished and the worksheet was returned to the ward folder.',
        '2026-10-18T12:10:00.000Z'
      ))
    }),
  ]
}
