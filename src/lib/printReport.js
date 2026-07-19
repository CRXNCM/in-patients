import { formatCurrency, formatDate } from '@/lib/utils'

export function printReport(report) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return false

  const rows = Array.isArray(report.rows) ? report.rows : []
  let tableHtml = ''

  if (rows.length && rows[0].name && rows[0].revenue != null) {
    tableHtml = `<table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.name}</td><td>${formatCurrency(r.revenue)}</td></tr>`)
      .join('')}</tbody></table>`
  } else if (rows.length && rows[0].day) {
    tableHtml = `<table><thead><tr><th>Day</th><th>Date</th><th>Revenue</th></tr></thead><tbody>${rows
      .map((r) => `<tr><td>${r.day}</td><td>${r.date || ''}</td><td>${formatCurrency(r.revenue)}</td></tr>`)
      .join('')}</tbody></table>`
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
  const summaryHtml = summaryEntries.length
    ? `<div class="summary">${summaryEntries.map(([k, v]) => `<p><strong>${k}:</strong> ${typeof v === 'number' ? formatCurrency(v) : v}</p>`).join('')}</div>`
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
  if (!rows.length) return 'No data\n'

  let headers = []
  let lines = []

  if (rows[0].name && rows[0].revenue != null) {
    headers = ['Item', 'Amount']
    lines = rows.map((r) => [r.name, r.revenue])
  } else if (rows[0].day) {
    headers = ['Day', 'Date', 'Revenue']
    lines = rows.map((r) => [r.day, r.date || '', r.revenue])
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
