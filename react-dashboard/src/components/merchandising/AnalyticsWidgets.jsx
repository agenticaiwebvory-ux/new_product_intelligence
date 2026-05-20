import { TrendingUp, Palette, Warehouse, AlertTriangle, RefreshCw, Store } from 'lucide-react'

function TopSellerCard({ title, items, icon, accent }) {
  if (!items || items.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${accent.bg}`}>
          {icon}
        </div>
        <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.style} className="flex items-center justify-between text-[0.75rem]">
            <span className="font-bold text-slate-700 truncate max-w-[140px]">
              {i === 0 && <span className="text-amber-500 mr-1">★</span>}
              {item.style}
            </span>
            <span className="font-black text-slate-900 tabular-nums">{item.sold.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StoreSection({ storeLabel, data }) {
  if (!data) return null
  const hasAny = ['30', '60', '90'].some(tf => data[`best_sellers_${tf}`]?.length > 0)
  if (!hasAny) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-indigo-50">
          <Store size={14} className="text-indigo-600" />
        </div>
        <span className="text-[0.7rem] font-black text-indigo-600 uppercase tracking-wider">{storeLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['30', '60', '90'].map(tf => {
          const items = data[`best_sellers_${tf}`] || []
          return (
            <div key={tf}>
              <div className="text-[0.6rem] font-black text-slate-400 uppercase mb-2">{tf}d</div>
              {items.length === 0 ? (
                <div className="text-[0.65rem] text-slate-300 font-semibold">No data</div>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, 3).map((item, i) => (
                    <div key={item.style} className="flex items-center justify-between text-[0.7rem]">
                      <span className="font-semibold text-slate-600 truncate max-w-[90px]">{item.style}</span>
                      <span className="font-bold text-slate-800 tabular-nums">{item.sold}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AnalyticsWidgets({ analytics }) {
  if (!analytics) return null

  const {
    best_sellers_30 = [],
    best_sellers_60 = [],
    best_sellers_90 = [],
    per_store = {},
    top_colors = [],
    highest_inventory = [],
    lowest_stock = [],
    most_returned = [],
  } = analytics

  const STORE_LABELS = { TDO: 'The Dress Outlet', WDO: 'Wholesale D.O.', KOS: 'Kosmed', IM: 'InStock' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-brand" />
        <span className="text-[0.8rem] font-black text-slate-700 uppercase tracking-wider">Insights at a Glance</span>
      </div>

      {/* Top Sellers Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TopSellerCard
          title="Top 30 Days"
          items={best_sellers_30}
          icon={<TrendingUp size={14} className="text-sky-600" />}
          accent={{ bg: 'bg-sky-50' }}
        />
        <TopSellerCard
          title="Top 60 Days"
          items={best_sellers_60}
          icon={<TrendingUp size={14} className="text-blue-600" />}
          accent={{ bg: 'bg-blue-50' }}
        />
        <TopSellerCard
          title="Top 90 Days"
          items={best_sellers_90}
          icon={<TrendingUp size={14} className="text-indigo-600" />}
          accent={{ bg: 'bg-indigo-50' }}
        />
      </div>

      {/* Inventory, Returns & Colors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Most Returned */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-orange-50">
              <RefreshCw size={14} className="text-orange-600" />
            </div>
            <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">Most Returned</span>
          </div>
          <div className="space-y-1.5">
            {most_returned.slice(0, 5).map((item) => (
              <div key={item.style} className="flex items-center justify-between text-[0.75rem]">
                <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.style}</span>
                <span className="font-black text-orange-700 tabular-nums">{item.returns.toLocaleString()}</span>
              </div>
            ))}
            {most_returned.length === 0 && (
              <div className="text-[0.7rem] text-slate-300 font-semibold">No data</div>
            )}
          </div>
        </div>

        {/* Highest Inventory */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-emerald-50">
              <Warehouse size={14} className="text-emerald-600" />
            </div>
            <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">Highest Inventory</span>
          </div>
          <div className="space-y-1.5">
            {highest_inventory.slice(0, 5).map((item) => (
              <div key={item.style} className="flex items-center justify-between text-[0.75rem]">
                <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.style}</span>
                <span className="font-black text-emerald-700 tabular-nums">{item.inventory.toLocaleString()}</span>
              </div>
            ))}
            {highest_inventory.length === 0 && (
              <div className="text-[0.7rem] text-slate-300 font-semibold">No data</div>
            )}
          </div>
        </div>

        {/* Lowest Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-rose-50">
              <AlertTriangle size={14} className="text-rose-600" />
            </div>
            <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">Lowest Stock</span>
          </div>
          <div className="space-y-1.5">
            {lowest_stock.slice(0, 5).map((item) => (
              <div key={item.style} className="flex items-center justify-between text-[0.75rem]">
                <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.style}</span>
                <span className={`font-black tabular-nums ${item.inventory === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {item.inventory.toLocaleString()}
                </span>
              </div>
            ))}
            {lowest_stock.length === 0 && (
              <div className="text-[0.7rem] text-slate-300 font-semibold">No data</div>
            )}
          </div>
        </div>

        {/* Top Colors */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-purple-50">
              <Palette size={14} className="text-purple-600" />
            </div>
            <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">Top Colors</span>
          </div>
          <div className="space-y-1.5">
            {top_colors.slice(0, 6).map((item) => {
              const colorName = item.color.includes('(') ? item.color.split('(')[0].trim() : item.color
              return (
                <div key={item.color} className="flex items-center justify-between text-[0.75rem]">
                  <span className="font-bold text-slate-700 truncate max-w-[140px]">{colorName}</span>
                  <span className="font-black text-purple-700 tabular-nums">{item.count}</span>
                </div>
              )
            })}
            {top_colors.length === 0 && (
              <div className="text-[0.7rem] text-slate-300 font-semibold">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Per Store Best Sellers */}
      {Object.keys(per_store).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(per_store).map(([sk, data]) => (
            <StoreSection key={sk} storeLabel={STORE_LABELS[sk] || sk} data={data} />
          ))}
        </div>
      )}
    </div>
  )
}
