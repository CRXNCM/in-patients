import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProviderWrapper } from '@/context/ToastContext'
import { AuthProvider } from '@/context/AuthContext'
import { PatientsProvider } from '@/context/PatientsContext'
import { BillingConfigProvider } from '@/context/BillingConfigContext'
import { ServiceEntriesProvider } from '@/context/ServiceEntriesContext'
import { LiveSyncProvider } from '@/context/LiveSyncContext'
import { WorkflowRequestsProvider } from '@/context/WorkflowRequestsContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequirePermission } from '@/components/auth/RequirePermission'
import LoginPage from '@/pages/LoginPage'

import ReceptionDashboard from '@/pages/reception/ReceptionDashboard'
import PatientsList from '@/pages/reception/PatientsList'
import PatientBilling from '@/pages/reception/PatientBilling'
import PendingApprovals from '@/pages/reception/PendingApprovals'
import ReceptionMedicineReturns from '@/pages/reception/ReceptionMedicineReturns'
import RecentlyApproved from '@/pages/reception/RecentlyApproved'
import AddPatient from '@/pages/reception/AddPatient'
import PendingDischarges from '@/pages/reception/PendingDischarges'
import DischargedPatients from '@/pages/reception/DischargedPatients'
import CriticalBalances from '@/pages/reception/CriticalBalances'
import ReceptionCreditPatients from '@/pages/reception/ReceptionCreditPatients'
import PendingInpatientAdmissions from '@/pages/reception/PendingInpatientAdmissions'

import NurseDashboard from '@/pages/nurse/NurseDashboard'
import NursePatientsList from '@/pages/nurse/NursePatientsList'
import PatientServiceEntry from '@/pages/nurse/PatientServiceEntry'
import NursePharmacyRequests from '@/pages/nurse/NursePharmacyRequests'
import NurseLaboratoryRequests from '@/pages/nurse/NurseLaboratoryRequests'
import NurseServiceHistory from '@/pages/nurse/NurseServiceHistory'
import PharmacyQueuePage from '@/pages/pharmacy/PharmacyQueuePage'
import MedicineReturnsPage from '@/pages/pharmacy/MedicineReturnsPage'
import LaboratoryQueuePage from '@/pages/laboratory/LaboratoryQueuePage'
import LaboratoryPatientsPage from '@/pages/laboratory/LaboratoryPatientsPage'
import { AdminLaboratoryRequests, AdminPharmacyRequests } from '@/pages/admin/AdminWorkflowRequests'

import AdminDashboard from '@/pages/admin/AdminDashboard'
import CatalogPage from '@/pages/admin/CatalogPage'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import RoomChargesPage from '@/pages/admin/RoomChargesPage'
import DoctorsPage from '@/pages/admin/DoctorsPage'
import UsersPage from '@/pages/admin/UsersPage'
import CreditCompaniesPage from '@/pages/admin/CreditCompaniesPage'
import SettingsPage from '@/pages/admin/SettingsPage'

import ManagerDashboard from '@/pages/manager/ManagerDashboard'
import ManagerDeposits from '@/pages/manager/ManagerDeposits'
import ManagerCharges from '@/pages/manager/ManagerCharges'
import ManagerOutstanding from '@/pages/manager/ManagerOutstanding'
import ManagerCreditPatients from '@/pages/manager/ManagerCreditPatients'
import ManagerDischarged from '@/pages/manager/ManagerDischarged'
import ManagerPharmacy from '@/pages/manager/ManagerPharmacy'
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
                <WorkflowRequestsProvider>
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
                        <Route element={<RequirePermission permission="credit.record_payment" />}>
                          <Route path="credit-patients" element={<ReceptionCreditPatients />} />
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
                        <Route element={<RequirePermission permission="admissions.convert_inpatient" />}>
                          <Route path="inpatient-admissions" element={<PendingInpatientAdmissions />} />
                        </Route>
                        <Route element={<RequirePermission permission="admissions.edit" />}>
                          <Route path="approvals" element={<PendingApprovals />} />
                          <Route path="medicine-returns" element={<ReceptionMedicineReturns />} />
                          <Route path="recently-approved" element={<RecentlyApproved />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="nurse" />}>
                      <Route path="/nurse" element={<AppLayout role="nurse" />}>
                        <Route index element={<NurseDashboard />} />
                        <Route element={<RequirePermission anyOf={['admissions.create', 'admissions.create_emergency']} />}>
                          <Route path="add-patient" element={<AddPatient />} />
                        </Route>
                        <Route path="patients" element={<NursePatientsList />} />
                        <Route path="patient/:patientId" element={<PatientServiceEntry />} />
                        <Route path="pharmacy" element={<NursePharmacyRequests />} />
                        <Route path="laboratory" element={<NurseLaboratoryRequests />} />
                        <Route element={<RequirePermission permission="patients.view" />}>
                          <Route path="service-history" element={<NurseServiceHistory />} />
                          <Route path="service-history/:patientId" element={<NurseServiceHistory />} />
                          <Route path="service-history/:patientId/:admissionId" element={<NurseServiceHistory />} />
                          <Route path="service-history/:patientId/:admissionId/receipt" element={<NurseServiceHistory />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="pharmacist" />}>
                      <Route path="/pharmacist" element={<AppLayout role="pharmacist" />}>
                        <Route index element={<PharmacyQueuePage />} />
                        <Route path="returns" element={<MedicineReturnsPage />} />
                        <Route path="queue" element={<Navigate to="/pharmacist" replace />} />
                      </Route>
                    </Route>

                    <Route element={<RequireAuth role="laboratory" />}>
                      <Route path="/laboratory" element={<AppLayout role="laboratory" />}>
                        <Route index element={<LaboratoryQueuePage />} />
                        <Route path="patients" element={<LaboratoryPatientsPage />} />
                        <Route path="queue" element={<Navigate to="/laboratory" replace />} />
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
                        <Route element={<RequirePermission permission="credit.manage_companies" />}>
                          <Route path="credit-companies" element={<CreditCompaniesPage />} />
                        </Route>
                        <Route element={<RequirePermission permission="patients.view" />}>
                          <Route path="pharmacy-requests" element={<AdminPharmacyRequests />} />
                          <Route path="laboratory-requests" element={<AdminLaboratoryRequests />} />
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
                          <Route path="pharmacy" element={<ManagerPharmacy />} />
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
                </WorkflowRequestsProvider>
                </LiveSyncProvider>
              </ServiceEntriesProvider>
            </BillingConfigProvider>
          </PatientsProvider>
        </AuthProvider>
      </ToastProviderWrapper>
    </ThemeProvider>
  )
}
