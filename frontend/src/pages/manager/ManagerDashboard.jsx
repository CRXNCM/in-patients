import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { DollarSign, TrendingUp, Wallet, AlertCircle, Users, AlertTriangle } from 'lucide-react'
import { StatCard, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useManagerDashboard } from '@/hooks/useManagerDashboard'

const COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#0891b2', '#ea580c', '#6366f1']

export default function ManagerDashboard() {
  const { data, loading } = useManagerDashboard()

  if (loading || !data) {
    return (
      <div>
        <PageHeader title="Executive Dashboard" description="Financial overview and hospital performance metrics" />
        <div className="text-center py-20 text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  const { stats, revenueByDepartment, dailyRevenueTrend, topServices, topMedicines, recentPatients } = data

  const transactionColumns = [
    { key: 'name', header: 'Patient', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'deposit', header: 'Deposit', render: (row) => formatCurrency(row.deposit) },
    {
      key: 'balance',
      header: 'Balance',
      render: (row) => (
        <span className={row.balance < 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    { key: 'admissionDate', header: 'Admission Date', render: (row) => formatDate(row.admissionDate) },
  ]

  return (
    <div>
      <PageHeader title="Executive Dashboard" description="Financial overview and hospital performance metrics" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <StatCard title="Today's Revenue" value={formatCurrency(stats.todayRevenue)} icon={DollarSign} iconClassName="bg-emerald-100 text-emerald-600" />
        <StatCard title="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={TrendingUp} iconClassName="bg-blue-100 text-blue-600" />
        <StatCard title="Total Deposits" value={formatCurrency(stats.totalDeposits)} icon={Wallet} iconClassName="bg-indigo-100 text-indigo-600" />
        <StatCard title="Outstanding Balance" value={formatCurrency(stats.outstandingBalance)} icon={AlertCircle} iconClassName="bg-red-100 text-red-600" />
        <StatCard title="Current Inpatients" value={stats.inpatientCount} icon={Users} iconClassName="bg-cyan-100 text-cyan-600" />
        <StatCard title="Near Low Balance" value={stats.nearLowBalance} icon={AlertTriangle} iconClassName="bg-amber-100 text-amber-600" />
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
                {topServices[0]?.count > 0 && (
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(s.count / topServices[0].count) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Top Medicines Used</h3>
          {topMedicines.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No pharmacy records yet</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h3 className="font-semibold">Recent Transactions</h3>
          <p className="text-sm text-muted-foreground">Admitted patients — deposit and balance overview</p>
        </div>
        <DataTable columns={transactionColumns} data={recentPatients} />
      </div>
    </div>
  )
}
