import PharmacyQueue from '@/components/workflow/PharmacyQueue'

export default function PharmacyQueuePage() {
  return (
    <PharmacyQueue
      canFulfill
      title="Pharmacy queue"
      description="Medicine requests grouped by the nurse's record and admission. Open a request to hand over each medicine."
    />
  )
}
