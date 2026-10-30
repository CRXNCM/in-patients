import { HospitalLogo } from '@/components/shared/HospitalLogo'
import { formatDate, formatDateTime } from '@/lib/utils'

function Field({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-sm text-neutral-950">{value}</p>
    </div>
  )
}

function ItemTable({ items }) {
  return (
    <table className="mt-3 w-full border-collapse text-sm">
      <thead>
        <tr className="border-y border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
          <th className="py-2 pr-3 font-medium">No.</th>
          <th className="py-2 pr-3 font-medium">Category</th>
          <th className="py-2 pr-3 font-medium">Service</th>
          <th className="py-2 pr-3 font-medium">Qty</th>
          <th className="py-2 font-medium">Unit / instructions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.number}-${item.category}-${item.name}`} className="border-b border-neutral-200 align-top">
            <td className="py-2 pr-3 tabular-nums">{item.number}</td>
            <td className="py-2 pr-3">{item.category || '—'}</td>
            <td className="py-2 pr-3">{item.name || '—'}</td>
            <td className="py-2 pr-3 tabular-nums">{item.quantity ?? '—'}</td>
            <td className="py-2">{[item.unit, item.instructions].filter(Boolean).join(' · ') || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ServiceRequestReceipt({ receipt }) {
  if (!receipt?.available) return null
  const place = [receipt.admission?.ward, receipt.admission?.room, receipt.admission?.bed].filter(Boolean).join(' · ')

  return (
    <article className="mx-auto max-w-3xl border border-neutral-300 bg-white text-neutral-950 shadow-sm print:border-0 print:shadow-none">
      <table className="receipt-sheet w-full border-collapse">
        <thead>
          <tr>
            <td className="border-b border-neutral-300 px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <HospitalLogo size="md" />
                  <div>
                    <p className="text-sm font-semibold tracking-wide">{receipt.hospitalName}</p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[0.14em]">SERVICE REQUEST RECEIPT</h2>
                    <p className="mt-1 text-[11px] font-medium tracking-wider text-neutral-500">{receipt.label || 'NON-FINANCIAL DOCUMENT'}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-neutral-600">
                  <p className="font-medium text-neutral-950">Generated</p>
                  <p className="mt-1">{receipt.generatedAt ? formatDateTime(receipt.generatedAt) : 'Unavailable'}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Patient name" value={receipt.patient?.name} />
                <Field label="Patient ID" value={receipt.patient?.patientId} />
                <Field label="Admission ID" value={receipt.admission?.admissionNumber || receipt.admission?.id} />
                <Field label="Admission date" value={receipt.admission?.admissionDate ? formatDate(receipt.admission.admissionDate) : ''} />
                <Field label="Ward / location" value={place} />
                <Field label="Admission status" value={receipt.admission?.status} />
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          {(receipt.requests || []).map((request) => (
            <tr key={request.requestId}>
              <td className="border-b border-neutral-200 px-6 py-6 sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Request ID</p>
                    <p className="mt-1 font-mono text-sm">{request.requestId}</p>
                  </div>
                  <p className="text-xs text-neutral-600">{request.status || 'Recorded'}</p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Submitted" value={request.submittedAt ? formatDateTime(request.submittedAt) : 'Unavailable'} />
                  <Field label="Submitted by" value={request.submittedBy || 'Unavailable'} />
                  {request.staffAccount ? <Field label="Account" value={request.staffAccount} /> : null}
                </div>
                {request.items?.length ? (
                  <ItemTable items={request.items} />
                ) : (
                  <p className="mt-3 text-sm text-neutral-700">The original requested items were not stored for this request.</p>
                )}
                {request.evidenceNote ? <p className="mt-3 text-xs leading-5 text-neutral-600">{request.evidenceNote}</p> : null}
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-6 py-6 text-sm leading-6 text-neutral-800 sm:px-8">
              <p>
                Each section is the request recorded for that nurse account and server timestamp.
                An account name and a server timestamp are operational evidence of a recorded submission. They are not proof of a person&apos;s physical identity.
              </p>
              <p className="mt-4 text-xs leading-5 text-neutral-600">{receipt.disclaimer}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  )
}
