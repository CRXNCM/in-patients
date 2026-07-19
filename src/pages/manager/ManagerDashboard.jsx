import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { DollarSign, TrendingUp, Wallet, AlertCircle, Users, AlertTriangle } from 'lucide-react'
import { StatCard, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import {
  patients, revenueByDepartment, dailyRevenueTrend, topServices, topMedicines,
  recentTransactions, getPatientBalanceStatus,
} from '@/data/mockData'
import { formatCurrency, formatDate } from '@/lib/utils'

const COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#0891b2', '#ea580c', '#6366f1']

export default function ManagerDashboard() {
  const todayRevenue = 59500
  const monthlyRevenue = 1203000
  const totalDeposits = patients.reduce((s, p) => s + p.deposit, 0)
  const outstandingBalance = patients.reduce((s, p) => s + Math.max(0, p.totalCharges - p.deposit), 0)
  const nearLowBalance = patients.filter((p) => getPatientBalanceStatus(p) !== 'sufficient').length

  const transactionColumns = [
    { key: 'patient', header: 'Patient', render: (row) => <span className="font-medium">{row.patient}</span> },
    { key: 'Deposite', header: 'Deposite' },
    { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount) },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'receptionist', header: 'Receptionist' },
  ]

  return (
    <div>
      <PageHeader title="Executive Dashboard" description="Financial overview and hospital performance metrics" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <StatCard title="Today's Revenue" value={formatCurrency(todayRevenue)} icon={DollarSign} iconClassName="bg-emerald-100 text-emerald-600" trend={{ positive: true, value: '8.2%' }} />
        <StatCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue)} icon={TrendingUp} iconClassName="bg-blue-100 text-blue-600" trend={{ positive: true, value: '15.4%' }} />
        <StatCard title="Total Deposits" value={formatCurrency(totalDeposits)} icon={Wallet} iconClassName="bg-indigo-100 text-indigo-600" />
        <StatCard title="Outstanding Balance" value={formatCurrency(outstandingBalance)} icon={AlertCircle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Current Inpatients" value={patients.length} icon={Users} iconClassName="bg-cyan-100 text-cyan-600" />
        <StatCard title="Near Low Balance" value={nearLowBalance} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Revenue by Department</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueByDepartment}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Daily Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyRevenueTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top Services Used</h3>
          <div className="space-y-3">
            {topServices.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.count} times · {formatCurrency(s.revenue)}</p>
                </div>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(s.count / topServices[0].count) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top Medicines Used</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={topMedicines} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}>
                {topMedicines.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h3 className="font-semibold">Recent Transactions</h3>
          <p className="text-sm text-muted-foreground">Latest billing and payment activities</p>
        </div>
        <DataTable columns={transactionColumns} data={recentTransactions} />
      </div>
    </div>
  )
}
