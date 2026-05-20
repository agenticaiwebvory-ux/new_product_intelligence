import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchDashboardStats } from '../features/dashboard/dashboardSlice'
import { STORE_LABELS } from '../constants/dashboard'
import { Package, AlertTriangle, RefreshCw, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react'
import { formatCompactNumber } from '../utils/format'
import AnalyticsWidgets from './merchandising/AnalyticsWidgets'
import { apiService } from '../services/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, ComposedChart } from 'recharts'

const KpiCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 transition-all hover:shadow-md hover:border-slate-300">
    <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
      <Icon size={22} className={color.text} />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <div className="text-xs font-semibold text-slate-400 mt-1">{sub}</div>}
    </div>
  </div>
)

function formatCurrency(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

const TIMEFRAMES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '365 days' },
]

const STORE_COLORS = { tdo: '#6366F1', wdo: '#F59E0B', kos: '#10B981', im: '#8B5CF6' }

export default function DashboardHome() {
  const dispatch = useAppDispatch()
  const { stats, status, error } = useAppSelector((s) => s.dashboard)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [salesTrend, setSalesTrend] = useState(null)
  const [trendDays, setTrendDays] = useState('30')

  useEffect(() => {
    Promise.all([
      dispatch(fetchDashboardStats()),
      apiService.getDashboardAnalytics().catch(() => null),
    ]).then(([, analyticsRes]) => {
      if (analyticsRes) setAnalytics(analyticsRes)
    }).finally(() => setLoading(false))
  }, [dispatch])

  useEffect(() => {
    apiService.getSalesTrend(parseInt(trendDays)).then(setSalesTrend).catch(() => {})
  }, [trendDays])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-slate-400 font-semibold">
          <RefreshCw className="animate-spin" size={20} />
          Loading dashboard...
        </div>
      </div>
    )
  }

  const s = stats?.stats

  // Build combined chart data from all stores
  const storeSeries = salesTrend?.stores || {}
  const allPeriods = [...new Set(
    Object.values(storeSeries).flatMap(st => st.series?.map(s => s.period) || [])
  )].sort()
  const combinedSeries = allPeriods.map(p => {
    const row = { period: p }
    for (const sk of ['tdo', 'wdo', 'kos', 'im']) {
      const day = storeSeries[sk]?.series?.find(s => s.period === p)
      row[`${sk}_sales`] = day?.sales || 0
      row[`${sk}_returns`] = day?.returns || 0
    }
    return row
  })

  // Aggregate summaries
  const storeSummaries = Object.entries(storeSeries).map(([sk, data]) => ({
    key: sk,
    label: STORE_LABELS[sk.toUpperCase()] || sk,
    ...data.summary,
    color: STORE_COLORS[sk] || '#94a3b8',
  }))

  const totalSales = storeSummaries.reduce((a, s) => a + s.total_sales, 0)
  const totalOrders = storeSummaries.reduce((a, s) => a + s.total_orders, 0)
  const totalReturns = storeSummaries.reduce((a, s) => a + s.total_returns, 0)
  const totalLineItems = storeSummaries.reduce((a, s) => a + s.line_items, 0)

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
        <p className="text-sm font-medium text-slate-400 mt-1">High-level KPI overview and store health summary</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm font-bold text-red-700">
          <AlertTriangle size={18} /> Failed to load dashboard data: {error}
        </div>
      )}

      {/* KPI Grid */}
      {s && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Package} label="Total Styles" value={formatCompactNumber(s.total_styles)} sub="Across all stores" color={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }} />
          <KpiCard icon={ShoppingCart} label="Total Inventory" value={formatCompactNumber(s.total_inventory)} sub="Units in stock" color={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }} />
          <KpiCard icon={AlertTriangle} label="Out of Stock" value={formatCompactNumber(s.out_of_stock)} sub="Styles with 0 inventory" color={{ bg: 'bg-amber-50', text: 'text-amber-600' }} />
          <KpiCard icon={BarChart3} label="Vendors" value={formatCompactNumber(s?.vendors?.length || 0)} sub="Active brands" color={{ bg: 'bg-cyan-50', text: 'text-cyan-600' }} />
        </div>
      )}

      {/* Sales Trend Chart */}
      {combinedSeries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <TrendingUp size={20} className="text-slate-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Sales Trend</h2>
            </div>
            <div className="flex items-center gap-2">
              {TIMEFRAMES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTrendDays(t.value)}
                  className={`text-[0.6rem] font-black px-2.5 py-1.5 rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                    trendDays === t.value
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={combinedSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dashSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#F43F5E' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(val, name) => {
                if (name === 'total_returns') return [`${val} units`, 'Returns']
                const sk = name.replace('_sales', '').toUpperCase()
                return [`$${val?.toLocaleString?.() || val}`, STORE_LABELS[sk] || sk]
              }} />
              {['tdo', 'wdo', 'kos', 'im'].map(sk => (
                <Area key={sk} yAxisId="left" dataKey={`${sk}_sales`} stackId="sales" stroke={STORE_COLORS[sk]} strokeWidth={1.5} fill="none" dot={false} name={`${sk}_sales`} />
              ))}
              <Bar yAxisId="right" dataKey="tdo_returns" fill="#F43F5E" radius={[2, 2, 0, 0]} opacity={0.6} name="total_returns" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Daily sales by store (stacked area) and return units (red columns). Widen timeframe to see older data.</p>
        </div>
      )}

      {/* Store Comparison */}
      {storeSummaries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <BarChart3 size={20} className="text-slate-500" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Store Comparison</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Store */}
            <div>
              <div className="text-[0.6rem] font-black text-slate-400 uppercase mb-3">Sales by Store</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={storeSummaries} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(val) => [`$${val?.toLocaleString?.() || val}`, 'Sales']} />
                  <Bar dataKey="total_sales" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Orders & Returns by Store */}
            <div>
              <div className="text-[0.6rem] font-black text-slate-400 uppercase mb-3">Orders & Returns by Store</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={storeSummaries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="total_orders" fill="#10B981" radius={[3, 3, 0, 0]} name="Orders" barSize={12} />
                  <Bar dataKey="total_returns" fill="#F43F5E" radius={[3, 3, 0, 0]} name="Returns" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Shopify Sales KPIs */}
      {storeSummaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={TrendingUp} label="Total Sales" value={formatCurrency(totalSales)} sub={`${totalOrders} orders`} color={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }} />
          <KpiCard icon={ShoppingCart} label="Avg Order Value" value={formatCurrency(totalOrders ? totalSales / totalOrders : 0)} sub="Across all stores" color={{ bg: 'bg-blue-50', text: 'text-blue-600' }} />
          <KpiCard icon={Package} label="Items Sold" value={formatCompactNumber(totalLineItems)} sub="Total line items" color={{ bg: 'bg-violet-50', text: 'text-violet-600' }} />
          <KpiCard icon={AlertTriangle} label="Returns" value={formatCompactNumber(totalReturns)} sub={`${totalOrders ? ((totalReturns / totalLineItems) * 100).toFixed(1) : 0}% return rate`} color={{ bg: 'bg-rose-50', text: 'text-rose-600' }} />
        </div>
      )}

      {/* Insights at a Glance */}
      {analytics && <AnalyticsWidgets analytics={analytics} />}
    </div>
  )
}
