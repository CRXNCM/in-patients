import {
  Archive,
  Bed,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Pill,
  Settings,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { hasAnyPermission, hasPermission } from '@/lib/permissions'

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
        },
        { id: 'reception-admit', label: 'Add Patient', path: '/reception/add-patient', icon: UserPlus, permission: 'admissions.create' },
      ],
    },
    {
      id: 'admissions',
      label: 'Admissions',
      items: [
        {
          id: 'reception-approvals',
          label: 'Pending Approvals',
          path: '/reception/approvals',
          icon: ClipboardCheck,
          anyOf: ['admissions.edit', 'patients.edit'],
          badge: 'pendingApprovals',
        },
        {
          id: 'reception-pending-discharge',
          label: 'Pending Discharges',
          path: '/reception/pending-discharges',
          icon: LogOut,
          permission: 'admissions.discharge',
        },
        { id: 'reception-discharged', label: 'Discharged', path: '/reception/discharged', icon: Archive, permission: 'patients.view' },
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
        { id: 'admin-services', label: 'Services', path: '/admin/services', icon: ClipboardList, anyOf: ['system.view_settings', 'system.modify_settings'] },
        { id: 'admin-medicines', label: 'Medicines', path: '/admin/medicines', icon: Pill, anyOf: ['system.view_settings', 'system.modify_settings'] },
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
  ],
}

export function isNavItemVisible(user, item) {
  if (item.roles?.length && user?.roleKey && !item.roles.includes(user.roleKey)) return false
  if (item.permission && !hasPermission(user, item.permission)) return false
  if (item.anyOf?.length && !hasAnyPermission(user, item.anyOf)) return false
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

  const stay = pathname.match(/\/patient\/([^/]+)$/)
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
