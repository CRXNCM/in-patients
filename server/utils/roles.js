import { effectivePermissions, PREDEFINED_ROLE_SLUGS } from './permissions.js'

export const ACCESS_ROLES = ['Reception', 'Nurse', 'Admin', 'Manager', 'Pharmacist', 'Laboratory']

export const DEFAULT_ROLES = [
  { name: 'Super Admin', slug: 'super-admin', accessRole: 'Admin', system: true, description: 'Full hospital administration access.' },
  { name: 'Admin', slug: 'admin', accessRole: 'Admin', system: true, description: 'Hospital administration and configuration.' },
  { name: 'Reception', slug: 'reception', accessRole: 'Reception', system: true, description: 'Admissions, deposits, and reception billing.' },
  { name: 'Credit Reception', slug: 'credit-reception', accessRole: 'Reception', system: true, description: 'Collect company and patient payments on credit stays, print payment invoices, and convert settled stays to cash patients.' },
  { name: 'Night Reception', slug: 'night-reception', accessRole: 'Reception', system: false, description: 'Reception access for night-shift staff.' },
  { name: 'Nurse', slug: 'nurse', accessRole: 'Nurse', system: true, description: 'Inpatient nursing documentation.' },
  { name: 'Emergency Nurse', slug: 'emergency-nurse', accessRole: 'Nurse', system: true, description: 'Emergency OPD registration, inpatient admission requests, and controlled self-conversion when Reception is unavailable.' },
  { name: 'Manager', slug: 'manager', accessRole: 'Manager', system: true, description: 'Reports and financial oversight.' },
  { name: 'Pharmacist', slug: 'pharmacist', accessRole: 'Pharmacist', system: true, description: 'Dispense ward medicines handed over from the patient record and record returns.' },
  { name: 'Laboratory', slug: 'laboratory', accessRole: 'Laboratory', system: true, description: 'Process laboratory requests routed from the patient record.' },
  { name: 'Doctor', slug: 'doctor', accessRole: 'Nurse', system: false, description: 'Clinical role. Detailed permissions come in a later step.' },
  { name: 'Finance', slug: 'finance', accessRole: 'Manager', system: false, description: 'Financial reporting access.' },
]

export function accessRoleKey(accessRole) {
  const key = String(accessRole || '').toLowerCase()
  return key === 'admin' ? 'admin' : key
}

export function dashboardPathForAccessRole(accessRole) {
  const key = accessRoleKey(accessRole)
  return `/${key}`
}

function trimText(value) {
  return String(value ?? '').trim()
}

function slugify(value) {
  return trimText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function validateRoleBody(body, { partial = false } = {}) {
  const errors = []
  const name = trimText(body?.name)
  if (!partial || body.name !== undefined) {
    if (!name) errors.push('Role name is required.')
    else if (name.length < 2) errors.push('Role name must be at least 2 characters.')
  }
  if (!partial || body.accessRole !== undefined) {
    if (!ACCESS_ROLES.includes(body?.accessRole)) {
      errors.push('Application access must be Reception, Nurse, Admin, Manager, Pharmacist, or Laboratory.')
    }
  }
  if (body?.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Active must be true or false.')
  }
  return errors
}

export function validateUserBody(body, { partial = false } = {}) {
  const errors = []
  const name = trimText(body?.name)
  const username = trimText(body?.username).toLowerCase()

  if (!partial || body.name !== undefined) {
    if (!name) errors.push('Full name is required.')
    else if (name.length < 2) errors.push('Full name must be at least 2 characters.')
  }
  if (!partial || body.username !== undefined) {
    if (!username) errors.push('Username is required.')
    else if (!/^[a-z0-9._@-]{3,80}$/i.test(username)) {
      errors.push('Username must be 3–80 characters and use letters, numbers, . _ - or @.')
    }
  }
  if (!partial) {
    const password = String(body?.password ?? '')
    if (!password) errors.push('Password is required.')
    else if (password.length < 6) errors.push('Password must be at least 6 characters.')
  } else if (body.password !== undefined && body.password !== '') {
    if (String(body.password).length < 6) errors.push('Password must be at least 6 characters.')
  }
  if (!partial || body.roleId !== undefined) {
    if (!trimText(body?.roleId)) errors.push('Role is required.')
  }
  if (body?.status !== undefined && !['active', 'inactive'].includes(body.status)) {
    errors.push('Status must be active or inactive.')
  }
  return errors
}

export function toFrontendRole(doc, userCount = 0) {
  if (!doc) return null
  const permissions = Array.isArray(doc.permissions) ? doc.permissions : []
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    accessRole: doc.accessRole,
    description: doc.description || '',
    permissions,
    permissionCount: permissions.length,
    active: doc.active !== false,
    system: !!doc.system,
    predefined: PREDEFINED_ROLE_SLUGS.includes(doc.slug),
    userCount,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
  }
}

export function toFrontendUser(doc, roleDoc) {
  if (!doc) return null
  const roleName = roleDoc?.name || doc.role
  return {
    id: doc._id.toString(),
    name: doc.name,
    username: doc.username || doc.email,
    email: doc.email,
    role: roleName,
    roleId: doc.roleId ? String(doc.roleId) : null,
    accessRole: doc.role,
    status: doc.status,
    lastLoginAt: doc.lastLoginAt?.toISOString?.() || null,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
    createdBy: doc.createdBy || null,
    permissions: effectivePermissions(roleDoc),
  }
}

export function toAuthSession(user, roleDoc) {
  const accessRole = user.role
  const roleKey = accessRole.toLowerCase()
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username || user.email,
    role: accessRole,
    roleName: roleDoc?.name || accessRole,
    accessRole,
    roleKey,
    roleId: user.roleId ? String(user.roleId) : null,
    roleSlug: roleDoc?.slug || null,
    dashboardPath: dashboardPathForAccessRole(accessRole),
    initials: user.name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    permissions: effectivePermissions(roleDoc),
  }
}

export { slugify, trimText }
