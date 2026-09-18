import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProviderWrapper } from '@/context/ToastContext'
import { AuthProvider } from '@/context/AuthContext'
import { PatientsProvider } from '@/context/PatientsContext'
import { BillingConfigProvider } from '@/context/BillingConfigContext'
import { ServiceEntriesProvider } from '@/context/ServiceEntriesContext'
import { LiveSyncProvider } from '@/context/LiveSyncContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequirePermission } from '@/components/auth/RequirePermission'
import LoginPage from '@/pages/LoginPage'

import ReceptionDashboard from '@/pages/reception/ReceptionDashboard'
import PatientsList from '@/pages/reception/PatientsList'
import PatientBilling from '@/pages/reception/PatientBilling'
import PendingApprovals from '@/pages/reception/PendingApprovals'
import RecentlyApproved from '@/pages/reception/RecentlyApproved'
import AddPatient from '@/pages/reception/AddPatient'
import PendingDischarges from '@/pages/reception/PendingDischarges'
import DischargedPatients from '@/pages/reception/DischargedPatients'
import CriticalBalances from '@/pages/reception/CriticalBalances'

import NurseDashboard from '@/pages/nurse/NurseDashboard'
import NursePatientsList from '@/pages/nurse/NursePatientsList'
import PatientServiceEntry from '@/pages/nurse/PatientServiceEntry'

import AdminDashboard from '@/pages/admin/AdminDashboard'
import CatalogPage from '@/pages/admin/CatalogPage'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import RoomChargesPage from '@/pages/admin/RoomChargesPage'
import DoctorsPage from '@/pages/admin/DoctorsPage'
import UsersPage from '@/pages/admin/UsersPage'
import SettingsPage from '@/pages/admin/SettingsPage'

import ManagerDashboard from '@/pages/manager/ManagerDashboard'
import ManagerDeposits from '@/pages/manager/ManagerDeposits'
import ManagerCharges from '@/pages/manager/ManagerCharges'
import ManagerOutstanding from '@/pages/manager/ManagerOutstanding'
import ManagerCreditPatients from '@/pages/manager/ManagerCreditPatients'
import ManagerDischarged from '@/pages/manager/ManagerDischarged'
import ReportsPage from '@/pages/manager/ReportsPage'
import PatientProfile from '@/pages/shared/PatientProfile'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProviderWrapper>
        <AuthProvider>
          <PatientsProvider>
            <BillingConfigProvider>
              <ServiceEntriesProvider>
                <LiveSyncProvider>
                  <BrowserRouter>
                    <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    <Route element={<RequireAuth role="reception" />}>
                      <Route path="/reception" element={<AppLayout role="reception" />}>
                        <Route index element={<ReceptionDashboard />} />
                        <Route element={<RequirePermission permission="patients.view" />}>
                          <Route path="patients" element={<PatientsList />} />
                          <Route path="discharged" element={<DischargedPatients />} />
                          <Route path="patient/:patientId" element={<PatientBilling />} />
                        </Route>
                        <Route element={<RequirePermission allOf={['patients.view', 'payments.view']} />}>
                          <Route path="critical-balances" element={<CriticalBalances />} />
                        </Route>
                        <Route element={<RequirePermission permission="admissions.discharge" />}>
                          <Route path="pending-discharges" element={<PendingDischarges />} />
                        </Route>
                        <Route element={<RequirePermission permission="admissions.create" />}>
                          <Route path="add-patient" element={<AddPatient />} />
                        </Route>
                        <Route element={<RequirePermission permission="admissions.edit" />}>
                          <Route path="approvals" element={<PendingApprovals />} />
                          <Route path="recently-approved" element={<RecentlyApproved />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="nurse" />}>
                      <Route path="/nurse" element={<AppLayout role="nurse" />}>
                        <Route index element={<NurseDashboard />} />
                        <Route path="patients" element={<NursePatientsList />} />
                        <Route path="patient/:patientId" element={<PatientServiceEntry />} />
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="admin" />}>
                      <Route path="/admin" element={<AppLayout role="admin" />}>
                        <Route index element={<AdminDashboard />} />
                        <Route element={<RequirePermission anyOf={['system.view_settings', 'system.modify_settings']} />}>
                          <Route path="catalog" element={<CatalogPage />} />
                          <Route path="services" element={<Navigate to="/admin/catalog" replace />} />
                          <Route path="medicines" element={<Navigate to="/admin/catalog" replace />} />
                          <Route path="settings" element={<SettingsPage />} />
                        </Route>
                        <Route element={<RequirePermission anyOf={['departments.view', 'wards.view', 'rooms.view', 'beds.view']} />}>
                          <Route path="departments" element={<DepartmentsPage />} />
                        </Route>
                        <Route element={<RequirePermission anyOf={['rooms.manage_rooms', 'system.modify_settings']} />}>
                          <Route path="room-charges" element={<RoomChargesPage />} />
                        </Route>
                        <Route element={<RequirePermission anyOf={['doctors.view', 'doctors.manage']} />}>
                          <Route path="doctors" element={<DoctorsPage />} />
                        </Route>
                        <Route element={<RequirePermission permission="users.view" />}>
                          <Route path="users" element={<UsersPage />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="manager" />}>
                      <Route path="/manager" element={<AppLayout role="manager" />}>
                        <Route index element={<ManagerDashboard />} />
                        <Route element={<RequirePermission allOf={['reports.view', 'payments.view']} />}>
                          <Route path="deposits" element={<ManagerDeposits />} />
                          <Route path="charges" element={<ManagerCharges />} />
                          <Route path="outstanding" element={<ManagerOutstanding />} />
                          <Route path="discharged-patients" element={<ManagerDischarged />} />
                        </Route>
                        <Route element={<RequirePermission allOf={['reports.view', 'credit.view']} />}>
                          <Route path="credit-patients" element={<ManagerCreditPatients />} />
                        </Route>
                        <Route element={<RequirePermission permission="reports.view" />}>
                          <Route path="reports" element={<ReportsPage />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route element={<RequireAuth />}>
                      <Route path="/patients/:patientId" element={<AppLayout />}>
                        <Route element={<RequirePermission permission="patients.view" />}>
                          <Route index element={<PatientProfile />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                  </BrowserRouter>
                </LiveSyncProvider>
              </ServiceEntriesProvider>
            </BillingConfigProvider>
          </PatientsProvider>
        </AuthProvider>
      </ToastProviderWrapper>
    </ThemeProvider>
  )
}
