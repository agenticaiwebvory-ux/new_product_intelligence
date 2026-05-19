import { useEffect, useRef, useState } from 'react'
import { BarChart3, ChevronDown, Filter, Search, SlidersHorizontal } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'

export const DEFAULT_CATALOG_VENDOR = 'The Dress Outlet'

const ModeButton = ({ active, icon: Icon, label, description, onClick }) => (
  <button
    onClick={onClick}
    className={`h-10 px-4 rounded-lg text-[0.78rem] font-extrabold transition-all flex items-center gap-2 border ${active
      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
      }`}
  >
    <Icon size={15} />
    <span>{label}</span>
    <span className={`text-[0.62rem] font-black uppercase tracking-wider ${active ? 'text-slate-300' : 'text-slate-400'}`}>
      {description}
    </span>
  </button>
)

const SelectControl = ({ value, onChange, children, minWidth = 150 }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className="h-10 appearance-none bg-white border border-slate-200 pl-3 pr-9 rounded-lg text-[0.78rem] font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer shadow-sm"
      style={{ minWidth }}
    >
      {children}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
)

const VendorDropdown = ({ activeVendor, setActiveVendor, stats }) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const vendors = stats?.vendors || []
  const preferredVendor = vendors.find((vendor) => (vendor.name || vendor.vendor) === DEFAULT_CATALOG_VENDOR)
  const remainingVendors = vendors.filter((vendor) => (vendor.name || vendor.vendor) !== DEFAULT_CATALOG_VENDOR)
  const orderedVendors = preferredVendor ? [preferredVendor, ...remainingVendors] : remainingVendors

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (vendor) => {
    setActiveVendor(vendor)
    setOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="h-10 flex items-center gap-2 px-3 rounded-lg text-[0.78rem] font-extrabold border border-slate-200 bg-white text-slate-700 hover:border-slate-300 transition-all min-w-[210px] justify-between shadow-sm"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Filter size={14} className="text-slate-400" />
          <span className="truncate">{activeVendor === 'ALL' ? 'All Vendors' : activeVendor}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[999]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-[0.62rem] font-black text-slate-400 uppercase tracking-widest">
            Filter by brand
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {orderedVendors.map((vendor) => {
              const name = vendor.name || vendor.vendor
              return (
                <button
                  key={name}
                  onClick={() => handleSelect(name)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[0.82rem] font-bold flex items-center justify-between transition-all ${activeVendor === name ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
                >
                  <span className="truncate">{name || 'Unknown'}</span>
                  <span className="text-[0.7rem] text-slate-400">{vendor.style_count}</span>
                </button>
              )
            })}

            <button
              onClick={() => handleSelect('ALL')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-[0.82rem] font-bold flex items-center justify-between transition-all ${activeVendor === 'ALL' ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <span>All Vendors</span>
              <span className="text-[0.7rem] text-slate-400">{vendors.reduce((sum, v) => sum + (v.style_count || 0), 0)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const WorkspaceToolbar = ({
  isMerchMode,
  setActiveVendor,
  activeVendor,
  activeStoreFilter,
  setActiveStoreFilter,
  merchSort,
  setMerchSort,
  merchTimeframe,
  setMerchTimeframe,
  stats,
  datePreset,
  setDatePreset,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
}) => {
  const storeKeys = useAppSelector((state) => Object.keys(state.stores.connections))

  return (
    <div className="sticky top-[73px] z-[900] -mx-8 px-8 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <ModeButton
            active={!isMerchMode}
            icon={Search}
            label="Catalog Health"
            description="Operations"
            onClick={() => setActiveVendor(DEFAULT_CATALOG_VENDOR)}
          />
          <ModeButton
            active={isMerchMode}
            icon={BarChart3}
            label="Merchandising"
            description="Analytics"
            onClick={() => setActiveVendor('TDO_MERCH')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMerchMode ? (
            <>
              <SelectControl value={merchSort} onChange={(e) => setMerchSort(e.target.value)} minWidth={165}>
                <option value="newest">Sort: Newest</option>
                <option value="high_views">High Page Views</option>
                <option value="high_sold">High Units Sold</option>
                <option value="high_returns">High Return Rate</option>
              </SelectControl>
              <SelectControl value={merchTimeframe} onChange={(e) => setMerchTimeframe(e.target.value)} minWidth={120}>
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </SelectControl>
            </>
          ) : (
            <>
              <VendorDropdown activeVendor={activeVendor} setActiveVendor={setActiveVendor} stats={stats} />
              <SelectControl value={activeStoreFilter} onChange={(e) => setActiveStoreFilter(e.target.value)} minWidth={145}>
                <option value="ALL">All Stores</option>
                {storeKeys.map((store) => (
                  <option key={store} value={store.toUpperCase()}>{store.toUpperCase()} Store</option>
                ))}
              </SelectControl>
            </>
          )}

          <SelectControl value={datePreset} onChange={(e) => setDatePreset(e.target.value)} minWidth={140}>
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last 1 Year</option>
            <option value="custom">Custom Range</option>
          </SelectControl>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 h-10 shadow-sm">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="text-[0.78rem] font-extrabold text-slate-700 outline-none bg-transparent cursor-pointer"
              />
              <span className="text-slate-400 text-[0.78rem]">to</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="text-[0.78rem] font-extrabold text-slate-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
          )}


        </div>
      </div>
    </div>
  )
}

export default WorkspaceToolbar
