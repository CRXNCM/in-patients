import LaboratoryOrderQueue from '@/components/workflow/LaboratoryOrderQueue'

export default function NurseLaboratoryRequests() {
  return (
    <LaboratoryOrderQueue
      title="Laboratory requests"
      description="Status of laboratory tests submitted from a patient record. Emergency OPD results return here to the Emergency Nurse. Inpatient tests still go to reception after the laboratory releases them."
    />
  )
}
