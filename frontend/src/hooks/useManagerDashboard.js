import { api } from '@/api/client'
import { useDashboardResource } from '@/hooks/useDashboardResource'

export function useManagerDashboard() {
  return useDashboardResource(api.getManagerDashboard, 'Manager dashboard requires the live API.')
}
