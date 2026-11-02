import PharmacyQueue from '@/components/workflow/PharmacyQueue'

export default function NursePharmacyRequests() {
  return (
    <PharmacyQueue
      title="Pharmacy requests"
      description="Status of medicine requests submitted from a patient record. Emergency OPD handovers return here to the Emergency Nurse. Inpatient requests still go to reception after pharmacy releases them."
    />
  )
}
