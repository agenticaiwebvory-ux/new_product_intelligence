import { Eye, Layers, Package, ShieldCheck, Store, TrendingUp } from 'lucide-react'
import { formatCompactNumber } from '../../utils/format'

const KpiGrid = ({ isMerchMode, isUnifiedMode, merchTimeframe, stats }) => {
  const missingLinks =
    (stats?.kos_missing || 0) +
    (stats?.wdo_missing || 0) +
    (stats?.tdo_missing || 0) +
    (stats?.im_missing || 0)

  const cards = isUnifiedMode
    ? [
        { icon: Layers, val: stats?.total?.toLocaleString(), lbl: 'Styles', color: '#0369a1', bg: '#f0f9ff' },
        { icon: Package, val: stats?.total_units?.toLocaleString(), lbl: 'Units', color: '#166534', bg: '#f0fdf4' },
        { icon: ShieldCheck, val: stats?.out_of_stock?.toLocaleString(), lbl: 'Out of Stock', color: '#991b1b', bg: '#fef2f2' },
        { icon: Store, val: missingLinks.toLocaleString(), lbl: 'Missing Links', color: '#7c3aed', bg: '#f5f3ff' },
        { icon: Eye, val: formatCompactNumber(stats?.total_pageviews), lbl: 'Views (90D)', color: '#4f46e5', bg: '#eef2ff' },
        { icon: TrendingUp, val: formatCompactNumber(stats?.total_sold_90), lbl: 'Sold (90D)', color: '#a16207', bg: '#fefce8' },
      ]
    : isMerchMode
    ? [
        { icon: Layers, val: stats?.total?.toLocaleString(), lbl: 'Styles', color: '#0369a1', bg: '#f0f9ff' },
        { icon: Package, val: stats?.total_units?.toLocaleString(), lbl: 'Units', color: '#166534', bg: '#f0fdf4' },
        { icon: Eye, val: formatCompactNumber(stats?.total_pageviews), lbl: 'Views (90D)', color: '#4f46e5', bg: '#eef2ff' },
        {
          icon: TrendingUp,
          val: formatCompactNumber(merchTimeframe === '30' ? stats?.total_sold_30 : merchTimeframe === '60' ? stats?.total_sold_60 : stats?.total_sold_90),
          lbl: `Sold (${merchTimeframe}D)`,
          color: '#a16207',
          bg: '#fefce8',
        },
      ]
    : [
        { icon: Layers, val: stats?.total?.toLocaleString(), lbl: 'Styles', color: '#0369a1', bg: '#f0f9ff' },
        { icon: Package, val: stats?.total_units?.toLocaleString(), lbl: 'Units', color: '#166534', bg: '#f0fdf4' },
        { icon: ShieldCheck, val: stats?.out_of_stock?.toLocaleString(), lbl: 'Out of Stock', color: '#991b1b', bg: '#fef2f2' },
        { icon: Store, val: missingLinks.toLocaleString(), lbl: 'Missing Store Links', color: '#7c3aed', bg: '#f5f3ff' },
      ]

  return (
    <div className="grid gap-3 mt-5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {cards.map((card) => (
        <div
          key={card.lbl}
          className="bg-white border border-slate-200 rounded-xl flex items-center gap-3 px-4 py-3 shadow-sm"
        >
          <div
            className="p-2.5 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: card.bg, color: card.color }}
          >
            <card.icon size={20} />
          </div>
          <div>
            <div className="text-[1.15rem] font-black text-slate-900 leading-tight">
              {card.val}
            </div>
            <div className="text-[0.68rem] text-slate-500 font-extrabold uppercase tracking-wider">
              {card.lbl}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KpiGrid
