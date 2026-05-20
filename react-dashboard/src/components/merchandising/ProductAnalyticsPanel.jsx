import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, ComposedChart } from 'recharts'
import { DollarSign, Package, TrendingUp, RotateCcw, Store, RefreshCw, ShoppingBag } from 'lucide-react'
import { STORE_KEYS, STORE_LABELS } from '../../constants/dashboard'
import { apiService } from '../../services/api'

const TIMEFRAMES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '365 days' },
]

const TABS = [
  { key: 'sales', label: 'Sales', icon: DollarSign, color: '#10B981' },
  { key: 'variants', label: 'By Color/Size', icon: ShoppingBag, color: '#8B5CF6' },
  { key: 'inventory', label: 'Inventory', icon: Package, color: '#8B5CF6' },
  { key: 'sellthru', label: 'Sell Thru', icon: TrendingUp, color: '#F97316' },
  { key: 'returns', label: 'Returns', icon: RotateCcw, color: '#F43F5E' },
]

function formatCurrency(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

export default function ProductAnalyticsPanel({ p }) {
  const [activeTab, setActiveTab] = useState('sales')
  const [timeframe, setTimeframe] = useState('90')
  const [store, setStore] = useState('tdo')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)

  const fetchShopifyAnalytics = useCallback(async () => {
    if (!p?.style) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiService.getShopifyAnalytics(p.style, timeframe, store)
      setData(result)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [p?.style, timeframe, store])

  useEffect(() => {
    fetchShopifyAnalytics()
  }, [fetchShopifyAnalytics])

  const colors = data?.sales_breakdown ? Object.keys(data.sales_breakdown) : []
  const sizes = selectedColor && data?.sales_breakdown?.[selectedColor]
    ? Object.keys(data.sales_breakdown[selectedColor])
    : []

  const renderSales = () => {
    const series = data?.sales_series || []
    if (series.length === 0) {
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Daily Sales</span>
          </div>
          <div className="flex items-center justify-center h-[180px] bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <span className="text-[0.7rem] text-slate-400">No sales data in this timeframe</span>
          </div>
          <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">No Shopify orders found for this product in the selected period. Try a wider timeframe or a different store.</p>
        </div>
      )
    }
    return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Daily Sales</span>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[0.55rem] text-slate-400 font-semibold">TOTAL</div>
            <div className="text-sm font-black text-slate-900">{formatCurrency(data?.totals?.total_sales || 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[0.55rem] text-slate-400 font-semibold">ORDERS</div>
            <div className="text-sm font-black text-slate-900">{data?.totals?.total_orders || 0}</div>
          </div>
          <div className="text-right">
            <div className="text-[0.55rem] text-slate-400 font-semibold">AOV</div>
            <div className="text-sm font-black text-slate-900">{formatCurrency(data?.totals?.avg_order_value || 0)}</div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(val) => [`$${val?.toLocaleString?.() || val}`, '']} />
          <Area type="monotone" dataKey="total_sales" stroke="#10B981" strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Daily sales revenue from Shopify. Spikes indicate promotions or high-demand periods.</p>
    </div>
    )
  }

  const renderVariants = () => {
    const bd = data?.sales_breakdown || {}
    const allColors = Object.keys(bd)

    const filtered = selectedColor
      ? { [selectedColor]: selectedSize ? { [selectedSize]: bd[selectedColor]?.[selectedSize] || 0 } : bd[selectedColor] }
      : bd

    const chartData = []
    for (const [c, sizes] of Object.entries(filtered)) {
      for (const [sz, val] of Object.entries(sizes)) {
        chartData.push({ name: `${c} - ${sz}`, value: val, color: c, size: sz })
      }
    }

    return (
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.55rem] font-bold text-slate-400 uppercase">Color:</span>
            <select
              value={selectedColor || ''}
              onChange={e => { setSelectedColor(e.target.value || null); setSelectedSize(null) }}
              className="text-[0.65rem] font-bold px-2 py-1 rounded-md border border-slate-200 bg-white outline-none cursor-pointer"
            >
              <option value="">All Colors</option>
              {allColors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {selectedColor && (
            <div className="flex items-center gap-1.5">
              <span className="text-[0.55rem] font-bold text-slate-400 uppercase">Size:</span>
              <select
                value={selectedSize || ''}
                onChange={e => setSelectedSize(e.target.value || null)}
                className="text-[0.65rem] font-bold px-2 py-1 rounded-md border border-slate-200 bg-white outline-none cursor-pointer"
              >
                <option value="">All Sizes</option>
                {sizes.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[140px] bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <span className="text-[0.7rem] text-slate-400">No variant breakdown available from Shopify</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="value" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Sales breakdown by color and size. Filter to isolate specific variants.</p>
      </div>
    )
  }

  const renderInventory = () => {
    const linked = STORE_KEYS.filter(k => p.store_prices?.[k]?.linked)
    if (linked.length === 0) {
      return <div className="text-[0.7rem] text-slate-400 italic py-10 text-center">No store data available</div>
    }
    const maxInv = Math.max(...linked.map(k => p.store_prices[k]?.inventory || 0), 1)
    return (
      <div>
        <div className="space-y-2">
          {linked.map(k => {
            const sp = p.store_prices[k]
            const inv = sp?.inventory || 0
            return (
              <div key={k} className="flex items-center gap-2.5">
                <span className="text-[0.6rem] font-black w-12 text-right shrink-0 text-slate-400">{STORE_LABELS[k] || k}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${inv === 0 ? 'bg-red-300' : inv < 5 ? 'bg-amber-400' : 'bg-violet-500'}`}
                    style={{ width: `${Math.max((inv / maxInv) * 100, 2)}%` }}
                  />
                </div>
                <span className="text-[0.65rem] font-black w-10 text-right tabular-nums shrink-0 text-slate-700">{inv}</span>
                <span className="text-[0.55rem] text-slate-400 w-14 text-right">${sp?.price || '-'}</span>
              </div>
            )
          })}
        </div>
        <p className="text-[0.6rem] text-slate-400 mt-3 leading-relaxed">Current stock across stores. Red = out of stock, amber = low (under 5).</p>
      </div>
    )
  }

  const sellThru = p?.sell_thru_details
  const renderSellThru = () => {
    if (!sellThru) {
      return <div className="text-[0.7rem] text-slate-400 italic py-10 text-center">No sell-thru data</div>
    }
    const chartData = [
      { period: '7d', value: sellThru.days_7 || 0 },
      { period: '30d', value: sellThru.days_30 || 0 },
      { period: '60d', value: sellThru.days_60 || 0 },
      { period: '90d', value: sellThru.days_90 || 0 },
    ]
    return (
      <div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="stGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Area type="monotone" dataKey="value" stroke="#F97316" strokeWidth={2} fill="url(#stGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Units sold across all stores. Higher sell-thru indicates strong product-market fit.</p>
      </div>
    )
  }

  const returns = p?.returns_details
  const returnRates = p?.return_rates_details
  const renderReturns = () => {
    const salesSeries = data?.sales_series || []
    const returnsSeries = data?.returns_series || []
    const hasReturns = returnsSeries.length > 0
    const hasSales = salesSeries.length > 0

    if (hasReturns || hasSales) {
      const allPeriods = [...new Set([...salesSeries.map(s => s.period), ...returnsSeries.map(r => r.period)])].sort()
      const combined = allPeriods.map(p => ({
        period: p,
        sales: salesSeries.find(s => s.period === p)?.total_sales || 0,
        returns: returnsSeries.find(r => r.period === p)?.returns || 0,
      }))
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider">Sales vs Returns</span>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[0.55rem] text-slate-400 font-semibold">SALES</div>
                <div className="text-sm font-black text-slate-900">{formatCurrency(data?.totals?.total_sales || 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-[0.55rem] text-slate-400 font-semibold">RETURNS</div>
                <div className="text-sm font-black text-rose-600">{data?.totals?.total_returns || 0} units</div>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={combined} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="retSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#F43F5E' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(val, name) => [name === 'returns' ? `${val} units` : `$${val?.toLocaleString?.() || val}`, name === 'returns' ? 'Returns' : 'Sales']} />
              <Bar yAxisId="right" dataKey="returns" fill="#F43F5E" radius={[3, 3, 0, 0]} name="returns" />
              <Area yAxisId="left" dataKey="sales" stroke="#10B981" strokeWidth={2} fill="url(#retSalesGrad)" dot={false} name="sales" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Sales revenue (green area, left axis) vs return units (red columns, right axis). Spikes in returns alongside high sales may indicate quality issues.</p>
        </div>
      )
    }

    // Fallback to local data
    if (!p?.returns_details) {
      return <div className="text-[0.7rem] text-slate-400 italic py-10 text-center">No returns data</div>
    }
    const chartData = [
      { period: '30d', value: p.returns_details.days_30 || 0, rate: p.return_rates_details?.days_30 },
      { period: '60d', value: p.returns_details.days_60 || 0, rate: p.return_rates_details?.days_60 },
      { period: '90d', value: p.returns_details.days_90 || 0, rate: p.return_rates_details?.days_90 },
    ]
    return (
      <div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="retGradLocal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(val, name, props) => {
              const r = props.payload
              return r?.rate != null ? [`${val} (${r.rate.toFixed(1)}%)`, 'Returns'] : [val, 'Returns']
            }} />
            <Area type="monotone" dataKey="value" stroke="#F43F5E" strokeWidth={2} fill="url(#retGradLocal)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-[0.6rem] text-slate-400 mt-2 leading-relaxed">Returned units and return rate (local DB data). High returns may indicate quality, sizing, or fit issues.</p>
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[200px] text-slate-400">
          <RefreshCw className="animate-spin mr-2" size={16} /> Loading Shopify data...
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-[200px] text-red-400 text-[0.75rem] font-semibold">
          {error}
        </div>
      )
    }
    switch (activeTab) {
      case 'sales': return renderSales()
      case 'variants': return renderVariants()
      case 'inventory': return renderInventory()
      case 'sellthru': return renderSellThru()
      case 'returns': return renderReturns()
      default: return renderSales()
    }
  }

  const activeLinkedStores = STORE_KEYS.filter(k => p.store_prices?.[k]?.linked)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[0.6rem] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Right Filters */}
        <div className="flex items-center gap-2">
          <select
            value={store}
            onChange={e => setStore(e.target.value)}
            className="text-[0.6rem] font-bold px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none cursor-pointer text-slate-600"
          >
            {activeLinkedStores.map(k => (
              <option key={k} value={k.toLowerCase()}>{STORE_LABELS[k] || k}</option>
            ))}
          </select>
          <select
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
            className="text-[0.6rem] font-bold px-2 py-1.5 rounded-md border border-slate-200 bg-white outline-none cursor-pointer text-slate-600"
          >
            {TIMEFRAMES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {renderContent()}
      </div>

      {/* Store Summary Footer */}
      <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
        <Store size={12} className="text-slate-300 shrink-0" />
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeLinkedStores.map(k => {
            const sp = p.store_prices[k]
            return (
              <span key={k} className="text-[0.55rem] font-bold text-slate-500">
                {STORE_LABELS[k] || k}: <span className="text-slate-800">${sp?.price || '-'}</span>
                <span className="text-slate-300 mx-0.5">·</span>
                <span className={sp?.inventory > 0 ? 'text-slate-800' : 'text-red-500'}>{sp?.inventory || 0}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}