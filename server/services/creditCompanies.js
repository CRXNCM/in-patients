import mongoose from 'mongoose'
import { CreditCompany } from '../models/CreditCompany.js'
import { Patient } from '../models/Patient.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCompanyName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function companyNameKey(value) {
  return normalizeCompanyName(value).toLowerCase()
}

function trimText(value) {
  return String(value ?? '').trim()
}

export function validateCompanyBody(body = {}, { partial = false } = {}) {
  const errors = []
  const name = body.name === undefined ? undefined : normalizeCompanyName(body.name)
  if (!partial || body.name !== undefined) {
    if (!name) errors.push('Company name is required.')
    else if (name.length > 120) errors.push('Company name must be 120 characters or fewer.')
  }
  const email = body.email === undefined ? undefined : trimText(body.email)
  if (email && !EMAIL_RE.test(email)) errors.push('Email is not a valid email address.')
  const code = body.code === undefined ? undefined : trimText(body.code)
  if (code && code.length > 40) errors.push('Company code must be 40 characters or fewer.')
  return { errors, name, email, code }
}

export function toCompanyRow(doc, admissionCount = 0) {
  if (!doc) return null
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code || '',
    contactPerson: doc.contactPerson || '',
    phone: doc.phone || '',
    email: doc.email || '',
    address: doc.address || '',
    notes: doc.notes || '',
    active: doc.active !== false,
    admissionCount,
    createdBy: doc.createdBy || '',
    updatedBy: doc.updatedBy || '',
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt || null,
    updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt || null,
  }
}

export function companyDisplay(company, snapshotName = '') {
  if (company) {
    return {
      id: String(company._id),
      name: company.name,
      code: company.code || '',
      contactPerson: company.contactPerson || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      active: company.active !== false,
      recorded: true,
    }
  }
  if (snapshotName) {
    return {
      id: '',
      name: snapshotName,
      code: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      active: false,
      recorded: true,
    }
  }
  return {
    id: '',
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    active: false,
    recorded: false,
  }
}

export async function resolveActiveCreditCompany(companyId) {
  const id = trimText(companyId)
  if (!id) return { error: 'Credit company is required.' }
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Credit company is not valid.' }
  const company = await CreditCompany.findById(id)
  if (!company) return { error: 'Credit company was not found.' }
  if (company.active === false) return { error: 'The selected credit company is not active.' }
  return { company }
}

export async function listCreditCompanies({ q = '', active } = {}) {
  const filter = {}
  const search = trimText(q)
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: rx }, { code: rx }]
  }
  if (active === true || active === 'true') filter.active = true
  if (active === false || active === 'false') filter.active = false
  const docs = await CreditCompany.find(filter).sort({ name: 1 }).lean()
  const ids = docs.map((doc) => String(doc._id))
  const counts = ids.length
    ? await Patient.aggregate([
      { $match: { creditCompanyId: { $in: ids } } },
      { $group: { _id: '$creditCompanyId', count: { $sum: 1 } } },
    ])
    : []
  const byId = Object.fromEntries(counts.map((row) => [row._id, row.count]))
  return docs.map((doc) => toCompanyRow(doc, byId[String(doc._id)] || 0))
}

export async function createCreditCompany(body, actorName) {
  const checked = validateCompanyBody(body)
  if (checked.errors.length) return { error: checked.errors[0], status: 400 }
  const nameKey = companyNameKey(checked.name)
  const existing = await CreditCompany.findOne({ nameKey })
  if (existing) return { error: 'A credit company with this name already exists.', status: 400 }
  try {
    const saved = await CreditCompany.create({
      name: checked.name,
      nameKey,
      code: checked.code || '',
      contactPerson: trimText(body.contactPerson),
      phone: trimText(body.phone),
      email: checked.email || '',
      address: trimText(body.address),
      notes: trimText(body.notes).slice(0, 400),
      active: body.active !== false,
      createdBy: actorName,
      updatedBy: actorName,
    })
    return { company: toCompanyRow(saved) }
  } catch (err) {
    if (err?.code === 11000) return { error: 'A credit company with this name already exists.', status: 400 }
    throw err
  }
}

export async function updateCreditCompany(id, body, actorName) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'Credit company was not found.', status: 404 }
  const company = await CreditCompany.findById(id)
  if (!company) return { error: 'Credit company was not found.', status: 404 }
  const checked = validateCompanyBody(body, { partial: true })
  if (checked.errors.length) return { error: checked.errors[0], status: 400 }
  if (checked.name) {
    const nameKey = companyNameKey(checked.name)
    const clash = await CreditCompany.findOne({ nameKey, _id: { $ne: company._id } })
    if (clash) return { error: 'A credit company with this name already exists.', status: 400 }
    company.name = checked.name
    company.nameKey = nameKey
  }
  if (body.code !== undefined) company.code = checked.code || ''
  if (body.contactPerson !== undefined) company.contactPerson = trimText(body.contactPerson)
  if (body.phone !== undefined) company.phone = trimText(body.phone)
  if (body.email !== undefined) company.email = checked.email || ''
  if (body.address !== undefined) company.address = trimText(body.address)
  if (body.notes !== undefined) company.notes = trimText(body.notes).slice(0, 400)
  if (body.active !== undefined) company.active = Boolean(body.active)
  company.updatedBy = actorName
  try {
    await company.save()
  } catch (err) {
    if (err?.code === 11000) return { error: 'A credit company with this name already exists.', status: 400 }
    throw err
  }
  return { company: toCompanyRow(company) }
}
