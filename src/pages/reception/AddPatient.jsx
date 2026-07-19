import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { bedTypes, depositTypes } from '@/data/mockData'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'

export default function AddPatient() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { addPatient } = usePatients()
  const { ensureAutomaticDailyCharges } = useServiceEntries()

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    bedType: bedTypes[0].name,
    bedNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    initialDeposit: '',
    depositType: 'Cash',
    notes: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.age || !form.phone) {
      toast({ title: 'Required fields missing', variant: 'destructive' })
      return
    }

    try {
      const patient = await addPatient({
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        phone: form.phone,
        address: form.address,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        room: form.bedType,
        bed: form.bedNumber || undefined,
        admissionDate: form.admissionDate,
        deposit: Number(form.initialDeposit) || 0,
        depositType: form.depositType,
        notes: form.notes,
        initialDeposit: Number(form.initialDeposit) || 0,
      })

      await ensureAutomaticDailyCharges(patient.id, form.admissionDate, patient)

      toast({
        title: 'Patient Admitted',
        description: `${patient.name} registered. Room assignment and daily charges applied.`,
        variant: 'success',
      })
      navigate(`/reception/patient/${patient.id}`)
    } catch (err) {
      toast({ title: 'Admission failed', description: err.message, variant: 'destructive' })
    }
  }

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))

  return (
    <div>
      <PageHeader title="Add Patient" description="Register a new in-patient with deposit and bed assignment" />

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Patient Information</CardTitle>
              <CardDescription>Full patient details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Age *</Label><Input type="number" min="0" value={form.age} onChange={(e) => set('age', e.target.value)} required /></div>
                <div>
                  <Label>Gender</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+251 9XX XXX XXX" required /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Emergency Contact</Label><Input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} /></div>
                <div><Label>Emergency Phone</Label><Input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} /></div>
              </div>
              <div><Label>Admission Date</Label><Input type="date" value={form.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Admission notes..." /></div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Bed Assignment</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Bed Type *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.bedType} onChange={(e) => set('bedType', e.target.value)}>
                    {bedTypes.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name} — {formatCurrency(b.dailyRate)}/day
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    First-day bed charge is added automatically on admission.
                  </p>
                </div>
                <div><Label>Bed Number</Label><Input value={form.bedNumber} onChange={(e) => set('bedNumber', e.target.value)} placeholder="Auto-assigned if empty" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Initial Deposit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Deposit Amount (ETB)</Label><Input type="number" min="0" value={form.initialDeposit} onChange={(e) => set('initialDeposit', e.target.value)} placeholder="0.00" /></div>
                <div>
                  <Label>Deposit Type *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.depositType} onChange={(e) => set('depositType', e.target.value)}>
                    {depositTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/reception')}>Cancel</Button>
              <Button type="submit" className="flex-1">Admit Patient</Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
