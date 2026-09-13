export const PERMISSION_CATALOG = [
  {
    module: 'patients',
    label: 'Patients',
    description: 'Who can see and change the inpatient list.',
    permissions: [
      { key: 'patients.view', label: 'View patients' },
      { key: 'patients.create', label: 'Create patients' },
      { key: 'patients.edit', label: 'Edit patients' },
      { key: 'patients.delete', label: 'Delete patients' },
    ],
  },
  {
    module: 'admissions',
    label: 'Admissions',
    description: 'Admission and discharge actions.',
    permissions: [
      { key: 'admissions.view', label: 'View admissions' },
      { key: 'admissions.create', label: 'Create admissions' },
      { key: 'admissions.edit', label: 'Edit admissions' },
      { key: 'admissions.cancel', label: 'Cancel admissions' },
      { key: 'admissions.discharge', label: 'Discharge patients' },
    ],
  },
  {
    module: 'rooms',
    label: 'Rooms & Beds',
    description: 'Room inventory and bed assignment.',
    permissions: [
      { key: 'rooms.view', label: 'View rooms' },
      { key: 'rooms.create', label: 'Create rooms' },
      { key: 'rooms.edit', label: 'Edit rooms' },
      { key: 'rooms.assign_beds', label: 'Assign beds' },
      { key: 'rooms.manage_rooms', label: 'Activate or deactivate rooms' },
      { key: 'rooms.manage_beds', label: 'Manage beds' },
      { key: 'beds.view', label: 'View beds' },
      { key: 'beds.create', label: 'Create beds' },
      { key: 'beds.edit', label: 'Edit beds' },
      { key: 'beds.manage', label: 'Change bed status' },
    ],
  },
  {
    module: 'doctors',
    label: 'Doctors',
    description: 'Doctor catalog and visiting-doctor assignment.',
    permissions: [
      { key: 'doctors.view', label: 'View doctors' },
      { key: 'doctors.assign', label: 'Assign doctors' },
      { key: 'doctors.manage', label: 'Manage doctors' },
      { key: 'doctors.manage_pricing', label: 'Manage doctor pricing' },
    ],
  },
  {
    module: 'payments',
    label: 'Payments',
    description: 'Deposits and payment records.',
    permissions: [
      { key: 'payments.view', label: 'View payments' },
      { key: 'payments.create', label: 'Create payments' },
      { key: 'payments.edit', label: 'Edit payments' },
      { key: 'payments.refund', label: 'Refund payments' },
    ],
  },
  {
    module: 'credit',
    label: 'Credit',
    description: 'Credit admissions and outstanding deposits.',
    permissions: [
      { key: 'credit.view', label: 'View credit patients' },
      { key: 'credit.create_admission', label: 'Create credit admission' },
      { key: 'credit.record_payment', label: 'Record credit payment' },
      { key: 'credit.settle', label: 'Settle credit' },
    ],
  },
  {
    module: 'users',
    label: 'Users',
    description: 'Staff accounts. Permissions stay on the role, not the person.',
    permissions: [
      { key: 'users.view', label: 'View users' },
      { key: 'users.create', label: 'Create users' },
      { key: 'users.edit', label: 'Edit users' },
      { key: 'users.disable', label: 'Disable users' },
    ],
  },
  {
    module: 'reports',
    label: 'Reports',
    description: 'Management reports and exports.',
    permissions: [
      { key: 'reports.view', label: 'View reports' },
      { key: 'reports.export', label: 'Export reports' },
    ],
  },
  {
    module: 'system',
    label: 'System',
    description: 'Hospital settings and audit visibility.',
    permissions: [
      { key: 'system.view_settings', label: 'View settings' },
      { key: 'system.modify_settings', label: 'Modify settings' },
      { key: 'system.view_audit_logs', label: 'View audit logs' },
    ],
  },
  {
    module: 'departments',
    label: 'Departments',
    description: 'Hospital departments used for organization of wards.',
    permissions: [
      { key: 'departments.view', label: 'View departments' },
      { key: 'departments.create', label: 'Create departments' },
      { key: 'departments.edit', label: 'Edit departments' },
      { key: 'departments.manage', label: 'Activate or deactivate departments' },
    ],
  },
  {
    module: 'wards',
    label: 'Wards',
    description: 'Wards that belong to a department.',
    permissions: [
      { key: 'wards.view', label: 'View wards' },
      { key: 'wards.create', label: 'Create wards' },
      { key: 'wards.edit', label: 'Edit wards' },
      { key: 'wards.manage', label: 'Activate or deactivate wards' },
    ],
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.flatMap((group) => group.permissions.map((item) => item.key))

const ALLOWED = new Set(ALL_PERMISSION_KEYS)

export function sanitizePermissions(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((key) => String(key || '').trim()).filter((key) => ALLOWED.has(key)))]
}

const RECEPTION_PERMISSIONS = [
  'patients.view',
  'patients.create',
  'patients.edit',
  'admissions.view',
  'admissions.create',
  'admissions.edit',
  'admissions.cancel',
  'admissions.discharge',
  'rooms.view',
  'rooms.assign_beds',
  'doctors.view',
  'doctors.assign',
  'payments.view',
  'payments.create',
  'payments.edit',
  'credit.view',
  'credit.create_admission',
  'credit.record_payment',
  'credit.settle',
]

const NURSE_PERMISSIONS = [
  'patients.view',
  'patients.edit',
  'admissions.view',
  'rooms.view',
  'doctors.view',
  'doctors.assign',
]

const MANAGER_PERMISSIONS = [
  'patients.view',
  'admissions.view',
  'payments.view',
  'credit.view',
  'reports.view',
  'reports.export',
]

export const PREDEFINED_ROLE_PRESETS = [
  {
    slug: 'reception',
    label: 'Reception',
    description: 'Register patients, admit, assign beds, take payments, and complete discharge.',
    permissions: RECEPTION_PERMISSIONS,
  },
  {
    slug: 'nurse',
    label: 'Nurse',
    description: 'View inpatients, record care, and assign visiting doctors.',
    permissions: NURSE_PERMISSIONS,
  },
  {
    slug: 'admin',
    label: 'Admin',
    description: 'Full hospital administration, users, doctors, rooms, and settings.',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    slug: 'manager',
    label: 'Manager',
    description: 'View patients, payments, credit, and management reports.',
    permissions: MANAGER_PERMISSIONS,
  },
]

export const PREDEFINED_ROLE_SLUGS = PREDEFINED_ROLE_PRESETS.map((preset) => preset.slug)

export const DEFAULT_ROLE_PERMISSIONS = {
  'super-admin': ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS,
  reception: RECEPTION_PERMISSIONS,
  'night-reception': [
    'patients.view',
    'patients.create',
    'admissions.view',
    'admissions.create',
    'rooms.view',
    'rooms.assign_beds',
  ],
  nurse: NURSE_PERMISSIONS,
  doctor: [
    'patients.view',
    'admissions.view',
    'doctors.view',
  ],
  manager: MANAGER_PERMISSIONS,
  finance: MANAGER_PERMISSIONS,
}

const PERMISSION_LABELS = Object.fromEntries(
  PERMISSION_CATALOG.flatMap((group) => group.permissions.map((item) => [item.key, item.label]))
)

export function buildPermissionPresets() {
  return PREDEFINED_ROLE_PRESETS.map((preset) => ({
    ...preset,
    permissions: sanitizePermissions(preset.permissions).map((key) => ({
      key,
      label: PERMISSION_LABELS[key] || key,
    })),
  }))
}

export function defaultPermissionsForSlug(slug) {
  return sanitizePermissions(DEFAULT_ROLE_PERMISSIONS[slug] || [])
}

export const SUPER_ADMIN_SLUG = 'super-admin'

export function isSuperAdminRole(role) {
  return String(role?.slug || '') === SUPER_ADMIN_SLUG && role?.active !== false
}

export function roleHasPermission(role, key) {
  if (!key) return false
  if (isSuperAdminRole(role)) return ALLOWED.has(key)
  if (!role || role.active === false) return false
  return Array.isArray(role.permissions) && role.permissions.includes(key)
}

export function roleHasAnyPermission(role, keys) {
  return keys.some((key) => roleHasPermission(role, key))
}

export function roleHasAllPermissions(role, keys) {
  return keys.every((key) => roleHasPermission(role, key))
}

export function effectivePermissions(role) {
  if (isSuperAdminRole(role)) return [...ALL_PERMISSION_KEYS]
  if (!role || role.active === false) return []
  return sanitizePermissions(role.permissions)
}

export function permissionDiff(before = [], after = []) {
  const prev = new Set(sanitizePermissions(before))
  const next = new Set(sanitizePermissions(after))
  return {
    added: [...next].filter((key) => !prev.has(key)),
    removed: [...prev].filter((key) => !next.has(key)),
  }
}

export function roleIsPrivileged(role) {
  return isSuperAdminRole(role) || roleHasPermission(role, 'users.edit')
}
