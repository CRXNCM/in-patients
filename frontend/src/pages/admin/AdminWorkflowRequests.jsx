import PharmacyQueue from '@/components/workflow/PharmacyQueue'
import LaboratoryOrderQueue from '@/components/workflow/LaboratoryOrderQueue'

export function AdminPharmacyRequests() {
  return (
    <PharmacyQueue
      title="Pharmacy requests"
      description="Medicine requests routed from patient records. This view does not hand over medicine or change a bill."
    />
  )
}

export function AdminLaboratoryRequests() {
  return (
    <LaboratoryOrderQueue
      title="Laboratory requests"
      description="Ward laboratory requests. Laboratory staff release them to reception. This view does not approve a charge."
    />
  )
}
