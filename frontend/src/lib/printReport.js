import { formatCurrency, formatDate } from '@/lib/utils'
import { hospitalLogoSrc } from '@/components/shared/HospitalLogo'

export function printReport(report) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return false

  const rows = Array.isArray(report.rows) ? report.rows : []
  let tableHtml = ''

  if (report.kind === 'pharmacy' || (rows[0] && rows[0].issuedQuantity != null && rows[0].patientCount != null)) {
    const patients = Array.isArray(report.topPatients) ? report.topPatients : []
    tableHtml = `<h3>Top medicines handed over</h3>
      <table><thead><tr><th>Medicine</th><th>Unit</th><th>Issued</th><th>Returned</th><th>Net out</th><th>Patients</th><th>Issued value</th></tr></thead><tbody>${
        rows.length
          ? rows.map((r) => `<tr><td>${r.name || ''}</td><td>${r.unit || ''}</td><td>${r.issuedQuantity}</td><td>${r.returnedQuantity}</td><td>${r.netQuantity}</td><td>${r.patientCount}</td><td>${formatCurrency(r.issuedValue || 0)}</td></tr>`).join('')
          : '<tr><td colspan="7">No pharmacy handovers in this period.</td></tr>'
      }</tbody></table>
      <h3>Patients who received the most medicine</h3>
      <table><thead><tr><th>Patient</th><th>Patient ID</th><th>Issued</th><th>Returned</th><th>Net out</th><th>Different medicines</th><th>Issued value</th></tr></thead><tbody>${
        patients.length
          ? patients.map((r) => `<tr><td>${r.patientName || ''}</td><td>${r.patientId || ''}</td><td>${r.issuedQuantity}</td><td>${r.returnedQuantity}</td><td>${r.netQuantity}</td><td>${r.medicineCount}</td><td>${formatCurrency(r.issuedValue || 0)}</td></tr>`).join('')
          : '<tr><td colspan="7">No patients received medicine in this period.</td></tr>'
      }</tbody></table>`
  } else if (rows.length && rows[0].name && rows[0].revenue != null) {
    tableHtml = `<table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.name}</td><td>${formatCurrency(r.revenue)}</td></tr>`)
      .join('')}</tbody></table>`
  } else if (rows.length && rows[0].day) {
    tableHtml = `<table><thead><tr><th>Day</th><th>Date</th><th>Revenue</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.day}</td><td>${r.date || ''}</td><td>${formatCurrency(r.revenue)}</td></tr>`)
      .join('')}</tbody></table>`
  } else if (rows.length && rows[0].creditOutstanding != null && (rows[0].patientName || rows[0].patientId)) {
    tableHtml = `<table><thead><tr><th>Patient</th><th>Patient ID</th><th>Admission ID</th><th>Admission</th><th>Status</th><th>Company</th><th>Code</th><th>Credit outstanding</th><th>Credit status</th></tr></thead><tbody>${rows
      .map(
        (r) =>
          `<tr><td>${r.patientName || r.name || ''}</td><td>${r.patientId || ''}</td><td>${r.admissionId || ''}</td><td>${formatDate(r.admissionDate)}</td><td>${r.status || ''}</td><td>${r.creditCompanyName || 'Company not recorded'}</td><td>${r.creditCompanyCode || ''}</td><td>${formatCurrency(r.creditOutstanding)}</td><td>${r.depositStatus || ''}</td></tr>`
      )
      .join('')}</tbody></table>`
    if (Array.isArray(report.byCompany) && report.byCompany.length) {
      tableHtml += `<h3>By company</h3><table><thead><tr><th>Company</th><th>Admissions</th><th>Credit outstanding</th></tr></thead><tbody>${report.byCompany
        .map((r) => `<tr><td>${r.companyName || 'Company not recorded'}</td><td>${r.admissions}</td><td>${formatCurrency(r.creditOutstanding)}</td></tr>`)
        .join('')}</tbody></table>`
    }
  } else if (rows.length && rows[0].deposit != null && rows[0].balance != null) {
    tableHtml = `<table><thead><tr><th>Patient</th><th>Deposit</th><th>Balance</th><th>Admission</th></tr></thead><tbody>${rows
      .map(
        (r) =>
          `<tr><td>${r.name}</td><td>${formatCurrency(r.deposit)}</td><td>${formatCurrency(r.balance)}</td><td>${formatDate(r.admissionDate)}</td></tr>`
      )
      .join('')}</tbody></table>`
  } else if (rows.length && rows[0].label && rows[0].roomType) {
    tableHtml = `<table><thead><tr><th>Bed</th><th>Room</th><th>Status</th><th>Patient</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.label}</td><td>${r.roomType}</td><td>${r.status}</td><td>${r.patientId || '—'}</td></tr>`)
      .join('')}</tbody></table>`
  } else if (rows.length && rows[0].amount != null && rows[0].method) {
    tableHtml = `<table><thead><tr><th>Date</th><th>Patient</th><th>Amount</th><th>Method</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${formatDate(r.date)}</td><td>${r.patientId}</td><td>${formatCurrency(r.amount)}</td><td>${r.method}</td></tr>`)
      .join('')}</tbody></table>`
  } else {
    tableHtml = '<p>No data available for this report.</p>'
  }

  const summaryEntries = report.summary ? Object.entries(report.summary) : []
  const pharmacySummary = report.kind === 'pharmacy' || (rows[0] && rows[0].issuedQuantity != null && rows[0].patientCount != null)
  const summaryHtml = summaryEntries.length
    ? `<div class="summary">${summaryEntries.map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (ch) => ch.toUpperCase())
      const display = pharmacySummary && typeof v === 'number' && !String(k).toLowerCase().includes('value')
        ? v
        : typeof v === 'number' ? formatCurrency(v) : v
      return `<p><strong>${label}:</strong> ${display}</p>`
    }).join('')}</div>`
    : ''

  win.document.write(`<!DOCTYPE html><html><head><title>${report.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { color: #2563eb; margin-bottom: 4px; }
      .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
      th { background: #f3f4f6; }
      .summary { margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; }
    </style></head><body>
    <h1>${report.hospitalName || 'Central City Hospital'}</h1>
    <h2>${report.title}</h2>
    <p class="meta">Generated: ${formatDate(report.generatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10))}</p>
    ${summaryHtml}
    ${tableHtml}
    </body></html>`)
  win.document.close()
  win.focus()
  win.print()
  return true
}

function escapeCsv(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function rowsToCsv(report) {
  const rows = Array.isArray(report.rows) ? report.rows : []
  if (!rows.length && report.kind !== 'pharmacy') return 'No data\n'

  let headers = []
  let lines = []

  if (report.kind === 'pharmacy' || (rows[0] && rows[0].issuedQuantity != null && rows[0].patientCount != null)) {
    const patients = Array.isArray(report.topPatients) ? report.topPatients : []
    const medicineLines = [
      ['Top medicines'],
      ['Medicine', 'Unit', 'Issued', 'Returned', 'Net out', 'Patients', 'Issued value'],
      ...rows.map((r) => [r.name, r.unit || '', r.issuedQuantity, r.returnedQuantity, r.netQuantity, r.patientCount, r.issuedValue || 0]),
      [''],
      ['Patients who received the most medicine'],
      ['Patient', 'Patient ID', 'Issued', 'Returned', 'Net out', 'Different medicines', 'Issued value'],
      ...patients.map((r) => [r.patientName || '', r.patientId || '', r.issuedQuantity, r.returnedQuantity, r.netQuantity, r.medicineCount, r.issuedValue || 0]),
    ]
    return medicineLines.map((line) => line.map(escapeCsv).join(',')).join('\n')
  }

  if (rows[0].name && rows[0].revenue != null) {
    headers = ['Item', 'Amount']
    lines = rows.map((r) => [r.name, r.revenue])
  } else if (rows[0].day) {
    headers = ['Day', 'Date', 'Revenue']
    lines = rows.map((r) => [r.day, r.date || '', r.revenue])
  } else if (rows[0].creditOutstanding != null && (rows[0].patientName || rows[0].patientId)) {
    headers = ['Patient', 'Patient ID', 'Admission ID', 'Admission Date', 'Status', 'Company', 'Code', 'Credit outstanding', 'Credit status']
    lines = rows.map((r) => [
      r.patientName || r.name || '',
      r.patientId || '',
      r.admissionId || '',
      r.admissionDate || '',
      r.status || '',
      r.creditCompanyName || 'Company not recorded',
      r.creditCompanyCode || '',
      r.creditOutstanding,
      r.depositStatus || '',
    ])
  } else if (rows[0].deposit != null && rows[0].balance != null) {
    headers = ['Patient', 'Deposit', 'Balance', 'Admission Date']
    lines = rows.map((r) => [r.name, r.deposit, r.balance, r.admissionDate])
  } else if (rows[0].label && rows[0].roomType) {
    headers = ['Bed', 'Room', 'Status', 'Patient']
    lines = rows.map((r) => [r.label, r.roomType, r.status, r.patientId || ''])
  } else if (rows[0].amount != null && rows[0].method) {
    headers = ['Date', 'Patient', 'Amount', 'Method']
    lines = rows.map((r) => [r.date, r.patientId, r.amount, r.method])
  }

  const csvRows = [headers.map(escapeCsv).join(',')]
  lines.forEach((line) => csvRows.push(line.map(escapeCsv).join(',')))
  return csvRows.join('\n')
}

export function exportReportCsv(report) {
  const csv = rowsToCsv(report)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(report.title || 'report').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
