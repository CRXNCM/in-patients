import { api } from '@/api/client'
import { useDashboardResource } from '@/hooks/useDashboardResource'

export function useAdminDashboard() {
  return useDashboardResource(api.getAdminDashboard, 'Admin dashboard requires the live API.')
}
