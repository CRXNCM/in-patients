import {
  AlertTriangle,
  Archive,
  Bed,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  History,
  CreditCard,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Pill,
  Receipt,
  RotateCcw,
  Scale,
  Settings,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { hasAllPermissions, hasAnyPermission, hasPermission, isCreditReceptionUser } from '@/lib/permissions'

/**
 * Single source of truth for role home-page navigation.
 * Paths and permission keys match App.jsx / RequirePermission. No invented routes.
 */
export const NAVIGATION = {
  reception: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'reception-home', label: 'Dashboard', path: '/reception', icon: LayoutDashboard, end: true },
        {
          id: 'reception-patients',
          label: 'Patients',
          path: '/reception/patients',
          icon: Users,
          permission: 'patients.view',
          match: ['/reception/patient'],
          hideForCreditDesk: true,
        },
        { id: 'reception-admit', label: 'Add Patient', path: '/reception/add-patient', icon: UserPlus, permission: 'admissions.create' },
        {
          id: 'reception-credit',
          label: 'Credit Patients',
          path: '/reception/credit-patients',
          icon: CreditCard,
          permission: 'credit.view',
        },
      ],
    },
    {
      id: 'admissions',
      label: 'Admissions',
      items: [
        {
          id: 'reception-critical-balances',
          label: 'Critical Balances',
          path: '/reception/critical-balances',
          icon: AlertTriangle,
          allOf: ['patients.view', 'payments.view'],
          hideForCreditDesk: true,
        },
        {
          id: 'reception-inpatient-admissions',
          label: 'Inpatient Admissions',
          path: '/reception/inpatient-admissions',
          icon: Bed,
          permission: 'admissions.convert_inpatient',
        },
        {
          id: 'reception-approvals',
          label: 'Pending Approvals',
          path: '/reception/approvals',
          icon: ClipboardCheck,
          permission: 'admissions.edit',
          badge: 'pendingApprovals',
        },
        {
          id: 'reception-medicine-returns',
          label: 'Medicine Returns',
          path: '/reception/medicine-returns',
          icon: RotateCcw,
          permission: 'admissions.edit',
        },
        {
          id: 'reception-recently-approved',
          label: 'Recently Approved',
          path: '/reception/recently-approved',
          icon: CheckCircle2,
          permission: 'admissions.edit',
        },
        {
          id: 'reception-pending-discharge',
          label: 'Pending Discharges',
          path: '/reception/pending-discharges',
          icon: LogOut,
          permission: 'admissions.discharge',
        },
        {
          id: 'reception-discharged',
          label: 'Discharged',
          path: '/reception/discharged',
          icon: Archive,
          permission: 'patients.view',
          hideForCreditDesk: true,
        },
      ],
    },
  ],
  nurse: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'nurse-home', label: 'Dashboard', path: '/nurse', icon: LayoutDashboard, end: true },
        {
          id: 'nurse-patients',
          label: 'Patients',
          path: '/nurse/patients',
          icon: Users,
          permission: 'patients.view',
          match: ['/nurse/patient'],
        },
        {
          id: 'nurse-admit',
          label: 'Emergency Admission',
          path: '/nurse/add-patient',
          icon: UserPlus,
          anyOf: ['admissions.create', 'admissions.create_emergency'],
        },
        {
          id: 'nurse-pharmacy',
          label: 'Pharmacy Requests',
          path: '/nurse/pharmacy',
          icon: Pill,
        },
        {
          id: 'nurse-laboratory',
          label: 'Laboratory Requests',
          path: '/nurse/laboratory',
          icon: FlaskConical,
        },
        {
          id: 'nurse-service-history',
          label: 'Patient Service History',
          path: '/nurse/service-history',
          icon: History,
          permission: 'patients.view',
        },
      ],
    },
  ],
  pharmacist: [
    {
      id: 'main',
      label: 'Pharmacy',
      items: [
        {
          id: 'pharmacist-queue',
          label: 'Request Queue',
          path: '/pharmacist',
          icon: Pill,
          end: true,
          badge: 'pharmacyPending',
        },
        {
          id: 'pharmacist-returns',
          label: 'Medicine Returns',
          path: '/pharmacist/returns',
          icon: RotateCcw,
        },
      ],
    },
  ],
  laboratory: [
    {
      id: 'main',
      label: 'Laboratory',
      items: [
        {
          id: 'laboratory-queue',
          label: 'Request Queue',
          path: '/laboratory',
          icon: FlaskConical,
          end: true,
          badge: 'laboratoryPending',
        },
        {
          id: 'laboratory-patients',
          label: 'Patients',
          path: '/laboratory/patients',
          icon: Users,
        },
      ],
    },
  ],
  admin: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'admin-home', label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true }],
    },
    {
      id: 'clinical',
      label: 'Clinical',
      items: [
        { id: 'admin-doctors', label: 'Doctors', path: '/admin/doctors', icon: Stethoscope, anyOf: ['doctors.view', 'doctors.manage'] },
        { id: 'admin-pharmacy-requests', label: 'Pharmacy Requests', path: '/admin/pharmacy-requests', icon: Pill, permission: 'patients.view' },
        { id: 'admin-laboratory-requests', label: 'Laboratory Requests', path: '/admin/laboratory-requests', icon: FlaskConical, permission: 'patients.view' },
        {
          id: 'admin-setup',
          label: 'Hospital Setup',
          path: '/admin/departments',
          icon: Building2,
          anyOf: ['departments.view', 'wards.view', 'rooms.view', 'beds.view'],
        },
      ],
    },
    {
      id: 'catalog',
      label: 'Catalog',
      items: [
        { id: 'admin-catalog', label: 'Catalog', path: '/admin/catalog', icon: ClipboardList, anyOf: ['system.view_settings', 'system.modify_settings'] },
        {
          id: 'admin-room-charges',
          label: 'Room Charges',
          path: '/admin/room-charges',
          icon: Bed,
          anyOf: ['rooms.manage_rooms', 'system.modify_settings'],
        },
      ],
    },
    {
      id: 'administration',
      label: 'Administration',
      items: [
        { id: 'admin-users', label: 'Users & Roles', path: '/admin/users', icon: UserCog, permission: 'users.view' },
        { id: 'admin-credit-companies', label: 'Credit Companies', path: '/admin/credit-companies', icon: Building2, permission: 'credit.manage_companies' },
        { id: 'admin-settings', label: 'Settings', path: '/admin/settings', icon: Settings, anyOf: ['system.view_settings', 'system.modify_settings'] },
      ],
    },
  ],
  manager: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'manager-home', label: 'Dashboard', path: '/manager', icon: LayoutDashboard, end: true },
        { id: 'manager-reports', label: 'Reports', path: '/manager/reports', icon: FileText, permission: 'reports.view' },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        { id: 'manager-deposits', label: 'Deposits', path: '/manager/deposits', icon: Wallet, permission: 'payments.view' },
        { id: 'manager-charges', label: 'Revenue & Charges', path: '/manager/charges', icon: Receipt, permission: 'payments.view' },
        { id: 'manager-outstanding', label: 'Outstanding Balances', path: '/manager/outstanding', icon: Scale, permission: 'payments.view' },
        { id: 'manager-credit', label: 'Credit Patients', path: '/manager/credit-patients', icon: CreditCard, permission: 'credit.view' },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        {
          id: 'manager-pharmacy',
          label: 'Pharmacy usage',
          path: '/manager/pharmacy',
          icon: Pill,
          permission: 'reports.view',
        },
        {
          id: 'manager-discharged',
          label: 'Discharged Patients',
          path: '/manager/discharged-patients',
          icon: Archive,
          permission: 'payments.view',
        },
      ],
    },
  ],
}

export function isNavItemVisible(user, item) {
  if (item.roles?.length && user?.roleKey && !item.roles.includes(user.roleKey)) return false
  if (item.hideForCreditDesk && isCreditReceptionUser(user)) return false
  if (item.permission && !hasPermission(user, item.permission)) return false
  if (item.anyOf?.length && !hasAnyPermission(user, item.anyOf)) return false
  if (item.allOf?.length && !hasAllPermissions(user, item.allOf)) return false
  return true
}

export function isNavItemActive(pathname, item) {
  if (item.end) return pathname === item.path
  const prefixes = [item.path, ...(item.match || [])]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function visibleNavSections(roleKey, user) {
  const sections = NAVIGATION[roleKey] || []
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isNavItemVisible(user, item)),
    }))
    .filter((section) => section.items.length > 0)
}

export function flattenNavItems(roleKey) {
  return (NAVIGATION[roleKey] || []).flatMap((section) => section.items)
}

export function getPageContext(pathname, roleKey, extras = {}) {
  const sections = NAVIGATION[roleKey] || []
  let active = null
  for (const section of sections) {
    for (const item of section.items) {
      if (isNavItemActive(pathname, item)) active = item
    }
  }

  const stay = pathname.match(/\/patients\/([^/]+)$/) || pathname.match(/\/patient\/([^/]+)$/)
  if (pathname.startsWith('/nurse/service-history')) {
    const parts = pathname.split('/').filter(Boolean)
    const crumbs = [{ label: 'Patient Service History', to: '/nurse/service-history' }]
    if (parts[2]) crumbs.push({ label: extras.entityLabel || parts[2], to: `/nurse/service-history/${parts[2]}` })
    if (parts[4]) crumbs.push({ label: 'Receipt' })
    return { crumbs }
  }

  if (pathname.match(/^\/patients\/[^/]+$/)) {
    const name = extras.entityLabel || stay?.[1]
    return { crumbs: [{ label: 'Patient Profile' }, { label: name }] }
  }

  if (stay && active) {
    const name = extras.entityLabel || stay[1]
    return {
      crumbs: [
        { label: active.label, to: active.path },
        { label: name },
      ],
    }
  }

  if (active?.path?.endsWith('/add-patient')) {
    return {
      crumbs: [{ label: 'Admissions' }, { label: 'New Admission' }],
    }
  }

  if (active) {
    return { crumbs: [{ label: active.label, to: active.path }] }
  }

  return { crumbs: [{ label: 'Dashboard' }] }
}
