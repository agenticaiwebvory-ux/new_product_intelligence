import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Filter, SlidersHorizontal, ArrowUpDown, Tag } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import DateRangePicker from './DateRangePicker'

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

const SelectControl = ({ value, onChange, children, icon: Icon, minWidth = 150 }) => (
  <div className="relative">
    {Icon && <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
    <select
      value={value}
      onChange={onChange}
      className={`h-10 appearance-none bg-white border border-slate-200 pr-9 rounded-lg text-[0.78rem] font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer shadow-sm ${
        Icon ? 'pl-9' : 'pl-3'
      }`}
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
  setActiveVendor,
  activeVendor,
  activeStoreFilter,
  setActiveStoreFilter,
  statusFilter,
  setStatusFilter,
  activeTagFilter,
  setActiveTagFilter,
  merchSort,
  setMerchSort,

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
        <div className="flex flex-wrap items-center gap-2">
          {/* Brand/Vendor Filter */}
          <VendorDropdown activeVendor={activeVendor} setActiveVendor={setActiveVendor} stats={stats} />
          
          {/* Store Filter */}
          <SelectControl value={activeStoreFilter} onChange={(e) => setActiveStoreFilter(e.target.value)} minWidth={145}>
            <option value="ALL">All Stores</option>
            {storeKeys.map((store) => (
              <option key={store} value={store.toUpperCase()}>{store.toUpperCase()} Store</option>
            ))}
          </SelectControl>

          {/* Status Filter */}
          <SelectControl value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} minWidth={145}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Status</option>
            <option value="DRAFT">Draft Status</option>
            <option value="MISSING">Missing Link</option>
          </SelectControl>

          {/* Tag Filter */}
          <SelectControl 
            value={activeTagFilter} 
            onChange={(e) => setActiveTagFilter(e.target.value)} 
            minWidth={145}
            icon={Tag}
          >
            <option value="ALL">All Product Tags</option>
            <option value="best:Seller">Best Seller</option>
            <option value="best:MOB">Best MOB</option>
            <option value="best:Plus">Best Plus</option>
            <option value="top:Formal">Top Formal</option>
            <option value="top:MOB">Top MOB</option>
            <option value="top:Plus">Top Plus</option>
            <option value="No PROM">No PROM</option>
            <option value="No Formal">No Formal</option>
            <option value="Discontinued">Discontinued</option>
            <option value="Push PROM">Push PROM</option>
          </SelectControl>

          {/* Sort Control */}
          <SelectControl 
            value={merchSort} 
            onChange={(e) => setMerchSort(e.target.value)} 
            minWidth={165}
            icon={ArrowUpDown}
          >
            <option value="newest">Recent Products</option>
            <option value="oldest">Older Products</option>
            <option value="high_views">Page View (High)</option>
            <option value="high_sold">Sell Thru / Sold (High)</option>
            <option value="high_returns">Returns (High)</option>
          </SelectControl>

          {/* Date Preset & Custom Calendar Picker */}
          <DateRangePicker 
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            customDateFrom={customDateFrom}
            setCustomDateFrom={setCustomDateFrom}
            customDateTo={customDateTo}
            setCustomDateTo={setCustomDateTo}
          />
        </div>
      </div>
    </div>
  )
}

export default WorkspaceToolbar
