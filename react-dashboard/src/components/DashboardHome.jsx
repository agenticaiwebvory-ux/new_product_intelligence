import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchDashboardStats } from '../features/dashboard/dashboardSlice'
import { fetchStoreConnections } from '../features/stores/storesSlice'
import { STORE_LABELS } from '../constants/dashboard'
import { Package, AlertTriangle, Store, RefreshCw, TrendingUp, ShoppingCart, Eye, BarChart3, CheckCircle, XCircle } from 'lucide-react'
import { formatCompactNumber } from '../utils/format'
import AnalyticsWidgets from './merchandising/AnalyticsWidgets'
import { apiService } from '../services/api'

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

export default function DashboardHome() {
  const dispatch = useAppDispatch()
  const { stats, status, error } = useAppSelector((s) => s.dashboard)
  const connections = useAppSelector((s) => s.stores.connections)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    Promise.all([
      dispatch(fetchDashboardStats()),
      dispatch(fetchStoreConnections()),
      apiService.getDashboardAnalytics().catch(() => null),
    ]).then(([, , analyticsRes]) => {
      if (analyticsRes) setAnalytics(analyticsRes)
    }).finally(() => setLoading(false))
  }, [dispatch])

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
  const storeKeys = Object.keys(connections)

  const missingStores = []
  if (s) {
    if (s.tdo_missing > 0) missingStores.push({ key: 'TDO', count: s.tdo_missing })
    if (s.wdo_missing > 0) missingStores.push({ key: 'WDO', count: s.wdo_missing })
    if (s.kos_missing > 0) missingStores.push({ key: 'KOS', count: s.kos_missing })
    if (s.im_missing > 0) missingStores.push({ key: 'IM', count: s.im_missing })
  }

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

      {/* Insights at a Glance */}
      {analytics && <AnalyticsWidgets analytics={analytics} />}

      {/* Store Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Connectivity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Store size={20} className="text-slate-500" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Store Connectivity</h2>
          </div>
          <div className="space-y-3">
            {storeKeys.map((key) => (
              <div key={key} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  {connections[key] ? (
                    <CheckCircle size={18} className="text-emerald-500" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                  <span className="font-bold text-slate-800">{STORE_LABELS[key.toUpperCase()] || key}</span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${connections[key] ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {connections[key] ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Store Health Details */}
        {s?.store_health && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <TrendingUp size={20} className="text-slate-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Store Health</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(s.store_health).map(([key, health]) => (
                <div key={key} className="py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">{STORE_LABELS[key.toUpperCase()] || key}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${health.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {health.status === 'ok' ? 'Healthy' : 'Error'}
                    </span>
                  </div>
                  {health.last_checked && (
                    <div className="text-xs text-slate-400 font-medium">
                      Last checked: {new Date(health.last_checked).toLocaleString()}
                    </div>
                  )}
                  {health.error && (
                    <div className="text-xs text-red-500 font-medium mt-1">{health.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Store Links */}
        {missingStores.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <AlertTriangle size={20} className="text-amber-500" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Missing Store Links</h2>
            </div>
            <div className="space-y-3">
              {missingStores.map(({ key, count }) => (
                <div key={key} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-amber-50 border border-amber-100">
                  <span className="font-bold text-amber-800">{STORE_LABELS[key.toUpperCase()] || key}</span>
                  <span className="text-sm font-black text-amber-700">{formatCompactNumber(count)} missing</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
