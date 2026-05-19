import React from 'react'
import { Eye, Layers, Package, ShieldCheck, Store, TrendingUp } from 'lucide-react'
import { formatCompactNumber } from '../../utils/format'

const KpiGrid = ({ isMerchMode, merchTimeframe, stats }) => {
  const cards = [
    { icon: Layers, val: stats?.total?.toLocaleString(), lbl: 'Styles', color: '#0369a1', bg: '#f0f9ff' },
    { icon: Package, val: stats?.total_units?.toLocaleString(), lbl: 'Units', color: '#166534', bg: '#f0fdf4' },
    { icon: Eye, val: formatCompactNumber(stats?.total_pageviews), lbl: 'Views (90D)', color: '#6366f1', bg: '#eef2ff', showInMerch: true },
    {
      icon: TrendingUp,
      val: formatCompactNumber(merchTimeframe === '30' ? stats?.total_sold_30 : merchTimeframe === '60' ? stats?.total_sold_60 : stats?.total_sold_90),
      lbl: `Sold (${merchTimeframe}D)`,
      color: '#ca8a04',
      bg: '#fefce8',
      showInMerch: true,
    },
    { icon: ShieldCheck, val: stats?.out_of_stock?.toLocaleString(), lbl: 'OOS', color: '#991b1b', bg: '#fef2f2', hideInMerch: true },
    { icon: Store, val: stats?.kos_missing?.toLocaleString(), lbl: 'KOS Miss', color: '#92400e', bg: '#fffbeb', hideInMerch: true },
    { icon: Store, val: stats?.wdo_missing?.toLocaleString(), lbl: 'WDO Miss', color: '#991b1b', bg: '#fef2f2', hideInMerch: true },
    { icon: Store, val: stats?.tdo_missing?.toLocaleString(), lbl: 'TDO Miss', color: '#991b1b', bg: '#fef2f2', hideInMerch: true },
    { icon: Store, val: stats?.im_missing?.toLocaleString(), lbl: 'IM Miss', color: '#7c3aed', bg: '#f5f3ff', hideInMerch: true },
  ].filter((card) => (!isMerchMode ? !card.showInMerch : !card.hideInMerch))

  return (
    <div
      className="grid gap-4 mb-6"
      style={{
        gridTemplateColumns: isMerchMode
          ? 'repeat(4, minmax(200px, 1fr))'
          : 'repeat(7, minmax(140px, 1fr))',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.lbl}
          className="bg-white border border-slate-200 rounded-3xl flex items-center gap-4 px-5 py-3 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
        >
          <div
            className="p-3 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: card.bg, color: card.color }}
          >
            <card.icon size={24} />
          </div>
          <div>
            <div className="text-[1.25rem] font-black text-slate-900 leading-tight">
              {card.val}
            </div>
            <div className="text-[0.75rem] text-slate-500 font-extrabold uppercase tracking-wider">
              {card.lbl}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KpiGrid
