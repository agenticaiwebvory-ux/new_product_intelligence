import { useState } from 'react'
import { TrendingUp, Eye, ChevronDown, BarChart3 } from 'lucide-react'

function BarChart({ data, label, color, maxValue, activePeriod }) {
  if (!data || data.length === 0) return null
  const max = maxValue || Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      <div className="text-[0.65rem] font-extrabold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="space-y-1.5">
        {data.map(d => {
          const pct = (d.value / max) * 100
          const isActive = d.period === activePeriod
          return (
            <div key={d.period} className="flex items-center gap-3">
              <span className={`text-[0.65rem] font-black w-[32px] text-right shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {d.period}d
              </span>
              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isActive ? color.active : color.base}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className={`text-[0.75rem] font-black w-[60px] text-right tabular-nums shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                {d.value.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ExpandedRowGraphs({ p, activeTimeframe, setActiveTimeframe }) {
  const [selectedPeriod, setSelectedPeriod] = useState(activeTimeframe || '90')

  const sellData = [
    { period: '7', value: p.sell_thru_details?.days_7 || 0 },
    { period: '30', value: p.sell_thru_details?.days_30 || 0 },
    { period: '60', value: p.sell_thru_details?.days_60 || 0 },
    { period: '90', value: p.sell_thru_details?.days_90 || 0 },
  ]
  const viewData = [
    { period: '7', value: p.pageviews_details?.days_7 || 0 },
    { period: '30', value: p.pageviews_details?.days_30 || 0 },
    { period: '60', value: p.pageviews_details?.days_60 || 0 },
    { period: '90', value: p.pageviews_details?.days_90 || 0 },
  ]
  const returnData = [
    { period: '30', value: p.returns_details?.days_30 || 0 },
    { period: '60', value: p.returns_details?.days_60 || 0 },
    { period: '90', value: p.returns_details?.days_90 || 0 },
  ]

  const maxSold = Math.max(...sellData.map(d => d.value), 1)
  const maxViews = Math.max(...viewData.map(d => d.value), 1)
  const maxReturns = Math.max(...returnData.map(d => d.value), 1)

  const handlePeriodChange = (val) => {
    setSelectedPeriod(val)
    setActiveTimeframe(val)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50">
            <BarChart3 size={14} className="text-indigo-600" />
          </div>
          <span className="text-[0.7rem] font-black text-slate-600 uppercase tracking-wider">Sales & Views Analytics</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <TrendingUp size={12} className="text-brand" />
          <select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="bg-transparent border-none text-[0.75rem] font-black outline-none cursor-pointer appearance-none text-slate-900 pr-4"
          >
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
          </select>
          <ChevronDown size={12} className="text-slate-400 -ml-4 pointer-events-none" />
        </div>
      </div>

      {/* Image + Charts in 2-col layout */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '140px 1fr' }}>
        {/* Left: Image */}
        <div className="text-center">
          <div className="rounded-xl shadow-sm overflow-hidden bg-slate-100 aspect-[2/3] border border-slate-200">
            <img
              src={p.main_image}
              alt=""
              loading="lazy"
              className="w-full transition-opacity duration-500 opacity-0"
              onLoad={(e) => e.target.classList.remove('opacity-0')}
            />
          </div>
          <div className="mt-2 text-[0.6rem] font-extrabold text-slate-400">{p.style}</div>
        </div>

        {/* Right: Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <BarChart
            data={sellData}
            label="Sold"
            color={{ active: 'bg-emerald-500', base: 'bg-emerald-200' }}
            maxValue={maxSold}
            activePeriod={selectedPeriod}
          />
          <BarChart
            data={viewData}
            label="Views"
            color={{ active: 'bg-blue-500', base: 'bg-blue-200' }}
            maxValue={maxViews}
            activePeriod={selectedPeriod}
          />
          <BarChart
            data={returnData}
            label="Returns"
            color={{ active: 'bg-rose-500', base: 'bg-rose-200' }}
            maxValue={maxReturns}
            activePeriod={selectedPeriod}
          />
        </div>
      </div>
    </div>
  )
}
