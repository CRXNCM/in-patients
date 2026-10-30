import { useEffect, useMemo, useState } from 'react'
import { useMatch, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchInput } from '@/components/ui/search-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, EmptyState, PageHeader, Pagination, StatusBadge } from '@/components/shared/CommonComponents'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { PrintPortal } from '@/components/shared/PrintPortal'
import { ServiceRequestReceipt } from '@/components/shared/ServiceRequestReceipt'
import { api } from '@/api/client'
import { getListPageSize } from '@/lib/displayPrefs'
import { formatDate, formatDateTime } from '@/lib/utils'

function admissionLabel(status) {
  if (status === 'admitted') return 'Active'
  if (status === 'pending-discharge') return 'Pending discharge'
  if (status === 'discharged') return 'Discharged'
  return status || 'Unavailable'
}

export default function NurseServiceHistory() {
  const { patientId, admissionId } = useParams()
  const showReceipt = Boolean(useMatch('/nurse/service-history/:patientId/:admissionId/receipt'))
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = getListPageSize()
  const [searchNonce, setSearchNonce] = useState(0)
  const [patientNonce, setPatientNonce] = useState(0)
  const [requestsNonce, setRequestsNonce] = useState(0)
  const [receiptNonce, setReceiptNonce] = useState(0)
  const [results, setResults] = useState([])
  const [listTotal, setListTotal] = useState(null)
  const [pageCount, setPageCount] = useState(1)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [patient, setPatient] = useState(null)
  const [admissions, setAdmissions] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [patientError, setPatientError] = useState('')
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestsError, setRequestsError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    if (patientId) return undefined
    const q = query.trim()
    const search = q.length >= 2 ? q : ''
    let cancelled = false
    setSearching(true)
    setSearchError('')
    const timer = window.setTimeout(() => {
      api.searchServiceHistory({ q: search, page, pageSize })
        .then((data) => {
          if (cancelled) return
          setResults(data.patients || [])
          setListTotal(Number(data.count) || 0)
          setPageCount(data.pageCount || 1)
        })
        .catch((err) => {
          if (cancelled) return
          setResults([])
          setListTotal(null)
          setSearchError(err.message || 'Patient search failed.')
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, search ? 300 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [patientId, query, page, pageSize, searchNonce])

  useEffect(() => {
    if (!patientId) {
      setPatient(null)
      setAdmissions([])
      setPatientError('')
      return undefined
    }
    let cancelled = false
    setPatientLoading(true)
    setPatientError('')
    api.getServiceHistoryPatient(patientId)
      .then((data) => {
        if (cancelled) return
        setPatient(data.patient)
        setAdmissions(data.admissions || [])
      })
      .catch((err) => {
        if (cancelled) return
        setPatient(null)
        setAdmissions([])
        setPatientError(err.message || 'Could not load this patient.')
      })
      .finally(() => {
        if (!cancelled) setPatientLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId, patientNonce])

  useEffect(() => {
    if (!patientId || !admissionId) {
      setRequests([])
      setRequestsError('')
      return undefined
    }
    let cancelled = false
    setRequestsLoading(true)
    setRequestsError('')
    setCategory('all')
    setStatus('all')
    api.getServiceHistoryRequests(patientId, admissionId)
      .then((data) => {
        if (!cancelled) setRequests(data.requests || [])
      })
      .catch((err) => {
        if (cancelled) return
        setRequests([])
        setRequestsError(err.message || 'Could not load service history.')
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId, admissionId, requestsNonce])

  useEffect(() => {
    if (!showReceipt || !patientId || !admissionId) {
      setReceipt(null)
      setReceiptError('')
      return undefined
    }
    let cancelled = false
    setReceiptLoading(true)
    setReceiptError('')
    api.getServiceHistoryReceipt(patientId, admissionId)
      .then((data) => {
        if (!cancelled) setReceipt(data)
      })
      .catch((err) => {
        if (cancelled) return
        setReceipt(null)
        setReceiptError(err.message || 'Could not load this service request.')
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showReceipt, patientId, admissionId, receiptNonce])

  useEffect(() => {
    const clear = () => document.body.classList.remove('print-request-mode')
    window.addEventListener('afterprint', clear)
    return () => {
      window.removeEventListener('afterprint', clear)
      clear()
    }
  }, [])

  const categories = useMemo(
    () => [...new Set(requests.flatMap((row) => row.categories || []))].sort(),
    [requests]
  )
  const statuses = useMemo(
    () => [...new Set(requests.map((row) => row.status).filter(Boolean))].sort(),
    [requests]
  )
  const visibleRequests = requests.filter((row) => {
    if (category !== 'all' && !(row.categories || []).includes(category)) return false
    if (status !== 'all' && row.status !== status) return false
    return true
  })
  const selectedAdmission = admissions.find((row) => row.id === admissionId) || null

  const printReceipt = () => {
    document.body.classList.add('print-request-mode')
    window.setTimeout(() => window.print(), 50)
  }

  const requestColumns = [
    { key: 'id', header: 'Request ID', render: (row) => <span className="font-mono text-xs">{row.id}</span> },
    { key: 'summary', header: 'Requested services', render: (row) => row.summary },
    { key: 'submittedBy', header: 'Submitted by', render: (row) => row.submittedBy || 'Unavailable' },
    { key: 'submittedAt', header: 'Submitted', render: (row) => (row.submittedAt ? formatDateTime(row.submittedAt) : 'Unavailable') },
    { key: 'status', header: 'Current status', render: (row) => row.status || 'Recorded' },
  ]

  return (
    <div>
      <PageHeader
        title="Patient Service History"
        description="Review service requests submitted during a patient's admission."
      />

      {!patientId ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Patients</CardTitle>
            <CardDescription>
              {listTotal == null
                ? 'Select a patient, then choose one admission.'
                : query.trim().length >= 2
                  ? `${listTotal} ${listTotal === 1 ? 'patient matches' : 'patients match'} this search. Select a patient, then choose one admission.`
                  : `${listTotal} ${listTotal === 1 ? 'patient' : 'patients'}. Select a patient, then choose one admission.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SearchInput
              label="Search patients"
              value={query}
              placeholder="Search by patient name, patient ID, or phone number"
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
            {searching && results.length === 0 && !searchError ? <LoadingState message="Loading patients…" /> : null}
            {searchError ? (
              <ErrorState className="mt-4" title="Patient list could not be loaded" message={searchError} onRetry={() => setSearchNonce((value) => value + 1)} />
            ) : null}
            {!searching && !searchError && listTotal === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                {query.trim().length >= 2 ? (
                  <p>No patients match your search.</p>
                ) : (
                  <>
                    <p>No patients found.</p>
                    <p className="mt-1">Patients admitted to the hospital will appear here.</p>
                  </>
                )}
              </div>
            ) : null}
            {results.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Patient</th>
                        <th className="px-3 py-2 font-medium">Patient ID</th>
                        <th className="px-3 py-2 font-medium">Gender</th>
                        <th className="px-3 py-2 font-medium">Age</th>
                        <th className="px-3 py-2 font-medium">Admitted</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row) => (
                        <tr
                          key={row.patientId}
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                          onClick={() => navigate(`/nurse/service-history/${encodeURIComponent(row.patientId)}`)}
                        >
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.patientId}</td>
                          <td className="px-3 py-2">{row.gender || '—'}</td>
                          <td className="px-3 py-2">{row.age != null && row.age !== '' ? row.age : '—'}</td>
                          <td className="px-3 py-2">{row.admissionDate ? formatDate(row.admissionDate) : '—'}</td>
                          <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate(`/nurse/service-history/${encodeURIComponent(row.patientId)}`)
                              }}
                            >
                              View History
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={listTotal || 0} pageSize={pageSize} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {patientLoading ? <LoadingState message="Loading patient…" /> : null}
      {patientError ? <ErrorState title="Patient could not be loaded" message={patientError} onRetry={() => setPatientNonce((value) => value + 1)} /> : null}

      {patient ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{patient.name}</CardTitle>
            <CardDescription>Select one admission before opening its service history.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Patient ID</dt><dd className="font-mono">{patient.patientId}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{patient.phone || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Age / gender</dt><dd>{[patient.age != null ? `${patient.age} years` : '', patient.gender].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Stay</dt><dd><StatusBadge status={patient.status} /></dd></div>
            </dl>
            {admissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">This patient has no admissions on record.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Admission ID</th>
                      <th className="px-3 py-2 font-medium">Admitted</th>
                      <th className="px-3 py-2 font-medium">Location</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Discharged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map((row) => {
                      const selected = row.id === admissionId
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer border-b last:border-0 hover:bg-muted/40 ${selected ? 'bg-muted/50' : ''}`}
                          onClick={() => navigate(`/nurse/service-history/${encodeURIComponent(patient.patientId)}/${encodeURIComponent(row.id)}`)}
                        >
                          <td className="px-3 py-2 font-mono text-xs">{row.admissionNumber}</td>
                          <td className="px-3 py-2">{row.admissionDate ? formatDate(row.admissionDate) : '—'}</td>
                          <td className="px-3 py-2">{[row.ward, row.room, row.bed].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="px-3 py-2">{admissionLabel(row.status)}</td>
                          <td className="px-3 py-2">{row.dischargeDate ? formatDateTime(row.dischargeDate) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {patient && !admissionId ? (
        <p className="text-sm text-muted-foreground">Select an admission to view the service requests recorded for that stay.</p>
      ) : null}

      {admissionId && !showReceipt ? (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
            <CardTitle className="text-base">Service requests</CardTitle>
            <CardDescription>
              {selectedAdmission
                ? `${admissionLabel(selectedAdmission.status)} admission ${selectedAdmission.admissionNumber}. Newest requests are listed first.`
                : 'Requests for the selected admission.'}
            </CardDescription>
            </div>
            {!requestsLoading && !requestsError && requests.length > 0 ? (
              <Button type="button" onClick={() => navigate(`/nurse/service-history/${patientId}/${admissionId}/receipt`)}>
                View Consolidated Receipt
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {requests.length > 0 ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <NativeSelect aria-label="Service category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((name) => <option key={name} value={name}>{name}</option>)}
                </NativeSelect>
                <NativeSelect aria-label="Workflow status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  {statuses.map((name) => <option key={name} value={name}>{name}</option>)}
                </NativeSelect>
              </div>
            ) : null}
            {requestsLoading ? <LoadingState message="Loading service history…" /> : null}
            {requestsError ? <ErrorState title="Service history could not be loaded" message={requestsError} onRetry={() => setRequestsNonce((value) => value + 1)} /> : null}
            {!requestsLoading && !requestsError && requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">This admission has no recorded service requests.</p>
            ) : null}
            {!requestsLoading && !requestsError && requests.length > 0 && visibleRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests match these filters.</p>
            ) : null}
            {!requestsLoading && !requestsError && visibleRequests.length > 0 ? (
              <DataTable columns={requestColumns} data={visibleRequests} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showReceipt ? (
        <div>
          <div className="no-print mb-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/nurse/service-history/${patientId}/${admissionId}`)}>
              <ArrowLeft className="h-4 w-4" /> Back to Service History
            </Button>
            <Button type="button" variant="outline" onClick={printReceipt} disabled={!receipt?.available}>
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!receipt?.available}
              onClick={() => document.getElementById('audit-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              View Audit History
            </Button>
          </div>
          {receiptLoading ? <LoadingState message="Loading consolidated receipt…" /> : null}
          {receiptError ? (
            <ErrorState
              title={/forbidden/i.test(receiptError) ? 'You do not have permission to view this receipt.' : 'Receipt unavailable'}
              message={receiptError}
              onRetry={() => setReceiptNonce((value) => value + 1)}
            />
          ) : null}
          {receipt && !receipt.available ? (
            <EmptyState
              icon={ScrollText}
              title="No service requests"
              description="This admission has no recorded service requests, so a receipt was not generated."
            />
          ) : null}
          {receipt?.available ? (
            <>
              <div id="service-receipt">
                <ServiceRequestReceipt receipt={receipt} />
              </div>
              <PrintPortal className="print-request">
                <ServiceRequestReceipt receipt={receipt} />
              </PrintPortal>
              <section id="audit-history" className="no-print mt-8">
                <h3 className="text-base font-semibold">Audit history</h3>
                <p className="mt-1 text-sm text-muted-foreground">Recorded events stay with the request they belong to. Missing history is not filled in.</p>
                {(receipt.requests || []).map((request) => (
                  <div key={request.requestId} className="mt-6">
                    <p className="font-mono text-xs text-muted-foreground">{request.requestId}</p>
                    {request.audit?.length ? (
                      <div className="mt-2 overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                              <th className="px-3 py-2 font-medium">When</th>
                              <th className="px-3 py-2 font-medium">Who</th>
                              <th className="px-3 py-2 font-medium">Action</th>
                              <th className="px-3 py-2 font-medium">Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {request.audit.map((entry, index) => (
                              <tr key={`${request.requestId}-${entry.at}-${entry.action}-${index}`} className="border-b last:border-0 align-top">
                                <td className="px-3 py-2 whitespace-nowrap">{entry.at ? formatDateTime(entry.at) : 'Unavailable'}</td>
                                <td className="px-3 py-2">{entry.actor || 'Unavailable'}</td>
                                <td className="px-3 py-2">{entry.action}</td>
                                <td className="px-3 py-2">{[entry.detail, entry.reason].filter(Boolean).join(' · ') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No audit events were stored for this request.</p>
                    )}
                  </div>
                ))}
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
