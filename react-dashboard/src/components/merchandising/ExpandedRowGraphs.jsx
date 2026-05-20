import { useState } from 'react'
import { TrendingUp, ChevronDown, BarChart3 } from 'lucide-react'

function Bar({ label, bars, max, active }) {
  const m = Math.max(max, 1)
  return (
    <div className="space-y-1.5">
      <div className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wider">{label}</div>
      {bars.map(b => {
        const pct = (b.v / m) * 100
        const on = b.p === active
        return (
          <div key={b.p} className="flex items-center gap-2">
            <span className={`text-[0.6rem] font-black w-[28px] text-right shrink-0 ${on ? 'text-slate-900' : 'text-slate-400'}`}>{b.p}d</span>
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${on ? b.ac : b.bc}`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className={`text-[0.7rem] font-black w-[52px] text-right tabular-nums shrink-0 ${on ? 'text-slate-900' : 'text-slate-500'}`}>{b.v.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function ExpandedRowGraphs({ p, activeTimeframe, setActiveTimeframe }) {
  const [period, setPeriod] = useState(activeTimeframe || '90')

  const sold = [
    { p: '7', v: p.sell_thru_details?.days_7 || 0, ac: 'bg-emerald-500', bc: 'bg-emerald-200' },
    { p: '30', v: p.sell_thru_details?.days_30 || 0, ac: 'bg-emerald-500', bc: 'bg-emerald-200' },
    { p: '60', v: p.sell_thru_details?.days_60 || 0, ac: 'bg-emerald-500', bc: 'bg-emerald-200' },
    { p: '90', v: p.sell_thru_details?.days_90 || 0, ac: 'bg-emerald-500', bc: 'bg-emerald-200' },
  ]
  const views = [
    { p: '7', v: p.pageviews_details?.days_7 || 0, ac: 'bg-blue-500', bc: 'bg-blue-200' },
    { p: '30', v: p.pageviews_details?.days_30 || 0, ac: 'bg-blue-500', bc: 'bg-blue-200' },
    { p: '60', v: p.pageviews_details?.days_60 || 0, ac: 'bg-blue-500', bc: 'bg-blue-200' },
    { p: '90', v: p.pageviews_details?.days_90 || 0, ac: 'bg-blue-500', bc: 'bg-blue-200' },
  ]
  const returns = [
    { p: '30', v: p.returns_details?.days_30 || 0, ac: 'bg-rose-500', bc: 'bg-rose-200' },
    { p: '60', v: p.returns_details?.days_60 || 0, ac: 'bg-rose-500', bc: 'bg-rose-200' },
    { p: '90', v: p.returns_details?.days_90 || 0, ac: 'bg-rose-500', bc: 'bg-rose-200' },
  ]

  const maxS = Math.max(...sold.map(b => b.v), 1)
  const maxV = Math.max(...views.map(b => b.v), 1)
  const maxR = Math.max(...returns.map(b => b.v), 1)

  const showFallback = maxS <= 1 && maxV <= 1 && maxR <= 1

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50"><BarChart3 size={14} className="text-indigo-600" /></div>
          <span className="text-[0.7rem] font-black text-slate-600 uppercase tracking-wider">Sales & Views Analytics</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <TrendingUp size={12} className="text-brand" />
          <select value={period} onChange={e => { setPeriod(e.target.value); setActiveTimeframe(e.target.value) }}
            className="bg-transparent border-none text-[0.75rem] font-black outline-none cursor-pointer appearance-none text-slate-900 pr-4">
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
          </select>
          <ChevronDown size={12} className="text-slate-400 -ml-4 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="text-center w-[120px] shrink-0">
          <div className="rounded-lg overflow-hidden bg-slate-100 aspect-[2/3] border border-slate-200">
            <img src={p.main_image} alt="" loading="lazy" className="w-full opacity-0 transition-opacity" onLoad={e => e.target.classList.remove('opacity-0')} />
          </div>
          <div className="mt-1.5 text-[0.55rem] font-extrabold text-slate-400">{p.style}</div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-4">
          {showFallback ? (
            <div className="col-span-3 flex items-center justify-center h-[140px] bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="text-center">
                <BarChart3 size={22} className="mx-auto text-slate-300 mb-1.5" />
                <div className="text-[0.7rem] font-semibold text-slate-400">No analytics data</div>
              </div>
            </div>
          ) : (
            <>
              <Bar label="Sold" bars={sold} max={maxS} active={period} />
              <Bar label="Views" bars={views} max={maxV} active={period} />
              <Bar label="Returns" bars={returns} max={maxR} active={period} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
