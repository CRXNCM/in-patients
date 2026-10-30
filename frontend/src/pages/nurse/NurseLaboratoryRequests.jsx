import LaboratoryOrderQueue from '@/components/workflow/LaboratoryOrderQueue'

export default function NurseLaboratoryRequests() {
  return (
    <LaboratoryOrderQueue
      title="Laboratory requests"
      description="Status of laboratory tests submitted from a patient record. A test is not billed until the laboratory releases it and reception approves the charge."
    />
  )
}
