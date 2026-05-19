import React, { Fragment } from 'react';
import { ChevronRight, Package } from 'lucide-react';

const UnifiedCatalogTable = ({
  currentItems,
  drawerProductId,
  setDrawerProductId,
  STORE_KEYS,
  getStatusBadge,
  datePreset,
  customDateFrom,
  customDateTo
}) => {
  
  const getActiveValue = (data, preset, dateFrom, dateTo) => {
    if (!data) return 0;
    
    let key = 'days_90'; // default
    if (preset === '7d') key = 'days_7';
    else if (preset === '30d') key = 'days_30';
    else if (preset === '90d') key = 'days_90';
    else if (preset === '1y') key = 'days_90';
    else if (preset === 'custom' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const diffTime = Math.abs(to - from);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) key = 'days_7';
      else if (diffDays <= 45) key = 'days_30';
      else if (diffDays <= 75) key = 'days_60';
      else key = 'days_90';
    }
    
    return data[key] || data['days_90'] || data['days_30'] || 0;
  };

  const getTimeframeLabel = (preset, dateFrom, dateTo) => {
    if (preset === 'all') return 'ALL TIME';
    if (preset === '7d') return '7d';
    if (preset === '30d') return '30d';
    if (preset === '90d') return '90d';
    if (preset === '1y') return '1y';
    if (preset === 'custom') {
      if (dateFrom && dateTo) {
        return `${dateFrom} to ${dateTo}`;
      }
      return 'CUSTOM';
    }
    return 'ALL TIME';
  };

  const tfLabel = getTimeframeLabel(datePreset, customDateFrom, customDateTo);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="p-4 w-[50px] border-b border-slate-200" />
            <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[80px]">ASSET</th>
            <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider min-w-[200px]">STYLE / PRODUCT</th>
            <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[150px]">STORES</th>
            <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[100px]">STOCK</th>
            <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[150px]">VIEWS ({tfLabel})</th>
            <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[150px]">SOLD ({tfLabel})</th>
            <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[150px]">RETURNS ({tfLabel})</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map(p => (
            <Fragment key={p.internal_id}>
              <tr
                onClick={() => setDrawerProductId(p.internal_id)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                style={{ transform: 'translateZ(0)' }}
              >
                <td className="p-5 text-center">
                  <ChevronRight
                    size={20}
                    className={`transition-transform text-slate-400 ${drawerProductId === p.internal_id ? 'rotate-90 text-brand' : ''}`}
                  />
                </td>
                <td className="p-5">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    <img
                      src={p.main_image}
                      alt="product"
                      loading="lazy"
                      className="w-full h-full object-cover transition-opacity duration-300 opacity-0"
                      onLoad={(e) => e.target.classList.remove('opacity-0')}
                    />
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <div className="text-[0.9rem] font-black text-slate-900 tracking-tight">
                        {p.style}
                      </div>
                      {getStatusBadge(p.shopify_status, true)}
                    </div>
                    <div className="text-[0.7rem] text-slate-400 font-bold truncate max-w-[200px]" title={p.title}>{p.title}</div>
                  </div>
                </td>

                {/* Coverage badges */}
                <td className="p-4 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {STORE_KEYS.map(sKey => {
                      const status = p.store_health?.[sKey] || 'MISSING';
                      const cls = status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : status === 'DRAFT'
                        ? 'bg-amber-50 text-amber-500 border-amber-200'
                        : 'bg-slate-50 text-slate-300 border-slate-200';
                      return (
                        <span key={sKey} className={`inline-flex items-center gap-1 text-[0.55rem] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${cls}`}>
                          {sKey}
                        </span>
                      );
                    })}
                  </div>
                </td>
                
                {/* Inventory */}
                <td className="p-4 text-center">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.85rem] font-black border ${
                    p.total_inventory <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    p.total_inventory < 5 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}>
                    <Package size={12} className="opacity-70" />
                    {p.total_inventory}
                  </div>
                </td>
                
                {/* Views */}
                <td className="p-4 text-center">
                  {p.pageviews_details ? (
                    <span className="text-[0.85rem] text-indigo-600 font-black scale-105">
                      {getActiveValue(p.pageviews_details, datePreset, customDateFrom, customDateTo).toLocaleString()}
                    </span>
                  ) : <span className="text-slate-300 text-[0.85rem] font-bold">—</span>}
                </td>
                
                {/* Sold */}
                <td className="p-4 text-center">
                  {p.units_sold ? (
                    <span className="text-[0.85rem] text-emerald-600 font-black scale-105">
                      {getActiveValue(p.units_sold, datePreset, customDateFrom, customDateTo).toLocaleString()}
                    </span>
                  ) : <span className="text-slate-300 text-[0.85rem] font-bold">—</span>}
                </td>
                
                {/* Returns */}
                <td className="p-4 text-center">
                  {p.returns ? (
                    <span className="text-[0.85rem] text-rose-600 font-black scale-105">
                      {getActiveValue(p.returns, datePreset, customDateFrom, customDateTo).toLocaleString()}
                    </span>
                  ) : <span className="text-slate-300 text-[0.85rem] font-bold">—</span>}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UnifiedCatalogTable;
