import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProviderWrapper } from '@/context/ToastContext'
import { PatientsProvider } from '@/context/PatientsContext'
import { BillingConfigProvider } from '@/context/BillingConfigContext'
import { ServiceEntriesProvider } from '@/context/ServiceEntriesContext'
import { AppLayout } from '@/components/layout/AppLayout'
import RoleSelector from '@/pages/RoleSelector'

import ReceptionDashboard from '@/pages/reception/ReceptionDashboard'
import PatientsList from '@/pages/reception/PatientsList'
import PatientBilling from '@/pages/reception/PatientBilling'
import PendingApprovals from '@/pages/reception/PendingApprovals'
import AddPatient from '@/pages/reception/AddPatient'

import NurseDashboard from '@/pages/nurse/NurseDashboard'
import NursePatientsList from '@/pages/nurse/NursePatientsList'
import PatientServiceEntry from '@/pages/nurse/PatientServiceEntry'

import AdminDashboard from '@/pages/admin/AdminDashboard'
import ServicesPage from '@/pages/admin/ServicesPage'
import MedicinesPage from '@/pages/admin/MedicinesPage'
import DepartmentsPage from '@/pages/admin/DepartmentsPage'
import RoomChargesPage from '@/pages/admin/RoomChargesPage'
import DoctorsPage from '@/pages/admin/DoctorsPage'
import UsersPage from '@/pages/admin/UsersPage'
import SettingsPage from '@/pages/admin/SettingsPage'

import ManagerDashboard from '@/pages/manager/ManagerDashboard'
import ReportsPage from '@/pages/manager/ReportsPage'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProviderWrapper>
        <PatientsProvider>
          <BillingConfigProvider>
          <ServiceEntriesProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<RoleSelector />} />

                <Route path="/reception" element={<AppLayout role="reception" />}>
                  <Route index element={<ReceptionDashboard />} />
                  <Route path="patients" element={<PatientsList />} />
                  <Route path="add-patient" element={<AddPatient />} />
                  <Route path="approvals" element={<PendingApprovals />} />
                  <Route path="patient/:patientId" element={<PatientBilling />} />
                </Route>

                <Route path="/nurse" element={<AppLayout role="nurse" />}>
                  <Route index element={<NurseDashboard />} />
                  <Route path="patients" element={<NursePatientsList />} />
                  <Route path="patient/:patientId" element={<PatientServiceEntry />} />
                </Route>

                <Route path="/admin" element={<AppLayout role="admin" />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="medicines" element={<MedicinesPage />} />
                  <Route path="departments" element={<DepartmentsPage />} />
                  <Route path="room-charges" element={<RoomChargesPage />} />
                  <Route path="doctors" element={<DoctorsPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                <Route path="/manager" element={<AppLayout role="manager" />}>
                  <Route index element={<ManagerDashboard />} />
                  <Route path="reports" element={<ReportsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ServiceEntriesProvider>
          </BillingConfigProvider>
        </PatientsProvider>
      </ToastProviderWrapper>
    </ThemeProvider>
  )
}
