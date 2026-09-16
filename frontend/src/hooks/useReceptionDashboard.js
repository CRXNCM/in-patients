import { api } from '@/api/client'
import { useDashboardResource } from '@/hooks/useDashboardResource'

export function useReceptionDashboard() {
  return useDashboardResource(api.getReceptionDashboard, 'Reception dashboard requires the live API.')
}
