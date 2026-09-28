import * as XLSXNS from 'xlsx'
import { CATALOG_CATEGORIES, matchCatalogCategoryValue } from '@/lib/catalogCategories'

const XLSX = XLSXNS.default || XLSXNS

const HEADER_ALIASES = {
  category: ['category', 'cat'],
  subcategory: ['subcategory', 'sub category', 'sub cat', 'subcat', 'group'],
  name: ['name', 'item', 'item name', 'service', 'service name', 'description'],
  unit: ['unit', 'uom', 'units'],
  price: ['price', 'price etb', 'unit price', 'amount', 'rate'],
}

const SKIP_SHEETS = new Set(['categories', 'instructions', 'readme', 'notes'])

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function headerIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(header))
}

function mapHeaders(rawHeaders = []) {
  const headers = rawHeaders.map(normalizeHeader)
  return {
    category: headerIndex(headers, HEADER_ALIASES.category),
    subcategory: headerIndex(headers, HEADER_ALIASES.subcategory),
    name: headerIndex(headers, HEADER_ALIASES.name),
    unit: headerIndex(headers, HEADER_ALIASES.unit),
    price: headerIndex(headers, HEADER_ALIASES.price),
  }
}

function parseCsvRecords(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      current.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i += 1
      current.push(field)
      rows.push(current)
      current = []
      field = ''
      continue
    }
    field += char
  }

  if (field.length || current.length) {
    current.push(field)
    rows.push(current)
  }

  return rows.filter((row) => row.some((cell) => String(cell || '').trim()))
}

function rowsFromSheet(records, sheetName, liveCategories = []) {
  if (!records.length) return { error: null, rows: [] }
  const index = mapHeaders(records[0])
  if (index.name < 0 || index.price < 0) {
    return { error: null, rows: [] }
  }

  const sheetCategory = matchCatalogCategoryValue(sheetName, liveCategories)
  if (index.category < 0 && !sheetCategory) {
    return {
      error: `Sheet "${sheetName}" needs a category column or a category sheet name.`,
      rows: [],
    }
  }

  const rows = []
  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i]
    const category = index.category >= 0 ? cells[index.category] ?? '' : sheetCategory?.slug || sheetName
    rows.push({
      rowNumber: i + 1,
      sheet: sheetName,
      category,
      subcategory: index.subcategory >= 0 ? cells[index.subcategory] ?? '' : '',
      name: cells[index.name] ?? '',
      unit: index.unit >= 0 ? cells[index.unit] ?? '' : '',
      price: cells[index.price] ?? '',
    })
  }
  return { error: null, rows }
}

export function parseCatalogCsvText(text, sheetName = 'Catalog', liveCategories = []) {
  return rowsFromSheet(parseCsvRecords(text), sheetName, liveCategories)
}

function parseWorkbook(buffer, liveCategories = []) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const rows = []
  const errors = []

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(String(sheetName || '').trim().toLowerCase())) continue
    const sheet = workbook.Sheets[sheetName]
    const records = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
    const parsed = rowsFromSheet(records, sheetName, liveCategories)
    if (parsed.error) errors.push(parsed.error)
    rows.push(...parsed.rows)
  }

  if (!rows.length) {
    return { error: errors[0] || 'No catalog rows were found.', rows: [] }
  }
  return { error: null, rows }
}

export async function parseCatalogUpload(file, liveCategories = []) {
  if (!file) return { error: 'Choose an Excel or CSV file.', rows: [] }
  const name = String(file.name || '').toLowerCase()
  try {
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      return parseCatalogCsvText(await file.text(), 'Catalog', liveCategories)
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return parseWorkbook(await file.arrayBuffer(), liveCategories)
    }
    const sniff = await file.slice(0, 4).arrayBuffer()
    const bytes = new Uint8Array(sniff)
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
    if (isZip) return parseWorkbook(await file.arrayBuffer(), liveCategories)
    return parseCatalogCsvText(await file.text(), 'Catalog', liveCategories)
  } catch (err) {
    return { error: err.message || 'The file could not be read.', rows: [] }
  }
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function buildCatalogTemplateRows() {
  return [
    ['category', 'subcategory', 'name', 'unit', 'price'],
    ['laboratory', 'Hematology', 'CBC', 'test', 300],
    ['pharmacy', 'Analgesics', 'Paracetamol 500mg Tablet', 'tablet', 15],
    ['procedures', 'Wound Care', 'Wound Dressing', 'procedure', 800],
  ]
}

export function downloadCatalogTemplate(liveCategories = []) {
  const examples = buildCatalogTemplateRows()
  const listed = liveCategories.length ? liveCategories : CATALOG_CATEGORIES
  const categories = [
    ['slug', 'name'],
    ...listed.map((category) => [category.slug || category.id, category.name]),
  ]
  try {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(examples), 'Catalog')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(categories), 'Categories')
    XLSX.writeFile(workbook, 'catalog-import-template.xlsx')
    return
  } catch {
    const csv = examples.map((row) => row.join(',')).join('\n')
    downloadBlob('catalog-import-template.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  }
}

export function downloadCatalogImportErrors(rows = []) {
  const errors = rows.filter((row) => row.action === 'error')
  const lines = [
    ['row', 'sheet', 'category', 'subcategory', 'name', 'unit', 'price', 'error'],
    ...errors.map((row) => [
      row.rowNumber,
      row.sheet || '',
      row.slug || row.categoryName || '',
      row.subcategory || '',
      row.name || '',
      row.unit || '',
      row.price ?? '',
      row.message || '',
    ]),
  ]
  const csv = lines
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  downloadBlob('catalog-import-errors.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}
