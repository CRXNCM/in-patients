import PharmacyQueue from '@/components/workflow/PharmacyQueue'

export default function NursePharmacyRequests() {
  return (
    <PharmacyQueue
      title="Pharmacy requests"
      description="Status of medicine requests submitted from a patient record. Nurses cannot hand over or return medicine."
    />
  )
}
