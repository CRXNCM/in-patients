import { api } from '@/api/client'
import { useDashboardResource } from '@/hooks/useDashboardResource'

export function useNurseDashboard() {
  return useDashboardResource(api.getNurseDashboard, 'Nurse dashboard requires the live API.')
}
