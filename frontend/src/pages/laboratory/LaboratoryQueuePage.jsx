import LaboratoryOrderQueue from '@/components/workflow/LaboratoryOrderQueue'

export default function LaboratoryQueuePage() {
  return (
    <LaboratoryOrderQueue
      canProcess
      title="Laboratory queue"
      description="Review tests from the nurse record. Approving a test sends it to reception. That does not approve the charge."
    />
  )
}
