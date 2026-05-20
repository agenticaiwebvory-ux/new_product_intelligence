import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Tag, ArrowUpDown, SlidersHorizontal, CalendarDays } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'

export const DEFAULT_CATALOG_VENDOR = 'The Dress Outlet'

const FilterPopover = ({
  open,
  onClose,
  datePreset,
  setDatePreset,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  activeStoreFilter,
  setActiveStoreFilter,
}) => {
  const ref = useRef(null)
  const storeKeys = useAppSelector((state) => Object.keys(state.stores.connections))

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={ref}
        className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 transition-all duration-200 scale-100 opacity-100"
      >
        {/* Date */}
        <div className="mb-4">
          <div className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-2">Date</div>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="w-full h-8 appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-7 text-[0.72rem] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last 1 Year</option>
            <option value="custom">Custom Range</option>
          </select>
          {datePreset === 'custom' && (
            <div className="mt-2 flex flex-col gap-1.5">
              <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)}
                className="w-full h-7 text-[0.68rem] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 outline-none" />
              <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)}
                className="w-full h-7 text-[0.68rem] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 outline-none" />
            </div>
          )}
        </div>
        {/* Store */}
        <div>
          <div className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-2">Store</div>
          <select
            value={activeStoreFilter}
            onChange={(e) => setActiveStoreFilter(e.target.value)}
            className="w-full h-8 appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-7 text-[0.72rem] font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="ALL">All Stores</option>
            {storeKeys.map((store) => (
              <option key={store} value={store.toUpperCase()}>{store.toUpperCase()} Store</option>
            ))}
          </select>
        </div>

        {/* Reset */}
        {(datePreset !== 'all' || activeStoreFilter !== 'ALL') && (
          <button
            onClick={() => {
              setDatePreset('all')
              setCustomDateFrom('')
              setCustomDateTo('')
              setActiveStoreFilter('ALL')
            }}
            className="mt-4 w-full h-8 text-[0.7rem] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            Reset filters
          </button>
        )}
      </div>
    </>
  )
}

const PillSelect = ({ value, onChange, children, icon: Icon, className = '' }) => (
  <div className={`relative flex items-center h-9 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow hover:border-slate-300 transition-all duration-150 ${className}`}>
    {Icon && <Icon size={14} className="text-slate-400 ml-3 shrink-0" />}
    <select
      value={value}
      onChange={onChange}
      className="h-full appearance-none bg-transparent pl-2 pr-7 text-[0.75rem] font-semibold text-slate-700 outline-none cursor-pointer"
    >
      {children}
    </select>
    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
  </div>
)

const VendorDropdown = ({ activeVendor, setActiveVendor, stats }) => {
  const vendors = stats?.vendors || []
  const preferredVendor = vendors.find((vendor) => (vendor.name || vendor.vendor) === DEFAULT_CATALOG_VENDOR)
  const remainingVendors = vendors
    .filter((vendor) => (vendor.name || vendor.vendor) !== DEFAULT_CATALOG_VENDOR)
    .sort((a, b) => (b.style_count || 0) - (a.style_count || 0))
  const orderedVendors = preferredVendor ? [preferredVendor, ...remainingVendors] : remainingVendors
  const totalCount = vendors.reduce((sum, v) => sum + (v.style_count || 0), 0)

  return (
    <div className="relative flex items-center h-9 bg-slate-900 border border-slate-900 rounded-full shadow-sm transition-all duration-150">
      <select
        value={activeVendor}
        onChange={(e) => setActiveVendor(e.target.value)}
        className="h-full appearance-none bg-transparent pl-3 pr-8 text-[0.75rem] font-semibold outline-none cursor-pointer text-white"
      >
        <option value="ALL" style={{ color: '#1e293b', background: '#fff' }}>All Vendors ({totalCount})</option>
        {orderedVendors.map((vendor) => {
          const name = vendor.name || vendor.vendor
          return <option key={name} value={name} style={{ color: '#1e293b', background: '#fff' }}>{name} ({vendor.style_count})</option>
        })}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
    </div>
  )
}

const WorkspaceToolbar = ({
  setActiveVendor,
  activeVendor,
  activeStoreFilter,
  setActiveStoreFilter,
  stats,
  datePreset,
  setDatePreset,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  tagSearch,
  setTagSearch,
  sortMetric,
  setSortMetric,
  sortOrder,
  setSortOrder,
  statusFilter,
  setStatusFilter,
}) => {
  const [filterOpen, setFilterOpen] = useState(false)

  return (
    <div className="sticky top-[73px] z-[900] -mx-8 px-8 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <VendorDropdown activeVendor={activeVendor} setActiveVendor={setActiveVendor} stats={stats} />

        {/* Tags */}
        <div className="flex items-center h-9 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow hover:border-slate-300 transition-all duration-150 px-3">
          <Tag size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Tag..."
            className="ml-2 h-full bg-transparent text-[0.75rem] font-semibold text-slate-700 outline-none w-[100px] placeholder:text-slate-300"
          />
          {tagSearch && (
            <button onClick={() => setTagSearch('')} className="text-slate-300 hover:text-slate-500 text-base leading-none ml-1">&times;</button>
          )}
        </div>

        {/* Sort by metric */}
        <div className="flex items-center h-9 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow hover:border-slate-300 transition-all duration-150 divide-x divide-slate-200">
          <div className="flex items-center pl-3 pr-1">
            <ArrowUpDown size={14} className="text-slate-400" />
          </div>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value)}
            className="h-full appearance-none bg-transparent pl-2 pr-6 text-[0.75rem] font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="none">Sort by</option>
            <option value="views">Views</option>
            <option value="sold">Sold</option>
            <option value="returns">Returns</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            disabled={sortMetric === 'none'}
            className={`h-full appearance-none bg-transparent pl-2 pr-6 text-[0.75rem] font-semibold outline-none cursor-pointer ${sortMetric === 'none' ? 'text-slate-300' : 'text-slate-700'}`}
          >
            <option value="highest">Highest</option>
            <option value="avg">Avg</option>
            <option value="lowest">Lowest</option>
          </select>
        </div>

        {/* Status */}
        <PillSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </PillSelect>

        {/* Filters button */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full border shadow-sm transition-all duration-150 text-[0.75rem] font-semibold ${
              filterOpen
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-blue-100'
                : 'bg-white border-slate-200 text-slate-600 hover:shadow hover:border-slate-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {(activeStoreFilter !== 'ALL' || datePreset !== 'all') && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
          </button>
          <FilterPopover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            customDateFrom={customDateFrom}
            setCustomDateFrom={setCustomDateFrom}
            customDateTo={customDateTo}
            setCustomDateTo={setCustomDateTo}
            activeStoreFilter={activeStoreFilter}
            setActiveStoreFilter={setActiveStoreFilter}
          />
        </div>
      </div>
    </div>
  )
}

export default WorkspaceToolbar
