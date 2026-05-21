import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Tag, ArrowUpDown, SlidersHorizontal, CalendarDays } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'

export const DEFAULT_CATALOG_VENDOR = 'The Dress Outlet'

const GlassSelect = ({ value, onChange, options, className = '', placeholder = 'Select...', disabled = false, wrapperClassName = '' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className={`relative ${wrapperClassName}`} ref={ref}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open) }}
        className={`flex items-center gap-1 w-full ${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="flex-1 truncate text-left">{selected?.label || placeholder}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="absolute left-0 right-0 top-full mt-1 z-50 flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/60 py-2 max-h-[25vh] overflow-y-auto"
            >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                  opt.value === value
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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
        className="absolute right-0 top-full mt-2 z-50 w-64 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/60 p-4 transition-all duration-200 scale-100 opacity-100"
      >
        {/* Date */}
        <div className="mb-4">
          <div className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest mb-2">Date</div>
          <GlassSelect
            value={datePreset}
            onChange={(val) => setDatePreset(val)}
            options={[
              { value: 'all', label: 'All' },
              { value: '7d', label: 'Last 7 Days' },
              { value: '30d', label: 'Last 30 Days' },
              { value: '90d', label: 'Last 90 Days' },
              { value: '1y', label: 'Last 1 Year' },
              { value: 'custom', label: 'Custom Range' },
            ]}
            className="w-full h-8 bg-slate-50 border border-brand/30 rounded-lg pl-2.5 pr-2 text-[0.72rem] font-semibold text-slate-700 outline-none hover:border-brand/60 transition-colors"
          />
          {datePreset === 'custom' && (
            <div className="mt-2 flex flex-col gap-1.5">
              <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)}
                className="w-full h-7 text-[0.68rem] font-semibold text-slate-700 bg-white/80 border border-white/60 rounded-lg px-2 outline-none" />
              <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)}
                className="w-full h-7 text-[0.68rem] font-semibold text-slate-700 bg-white/80 border border-white/60 rounded-lg px-2 outline-none" />
            </div>
          )}
        </div>
        {/* Store */}
        <div>
          <div className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest mb-2">Store</div>
          <GlassSelect
            value={activeStoreFilter}
            onChange={(val) => setActiveStoreFilter(val)}
            options={[
              { value: 'ALL', label: 'All' },
              ...storeKeys.map((store) => ({ value: store.toUpperCase(), label: `${store.toUpperCase()} Store` })),
            ]}
            className="w-full h-8 bg-slate-50 border border-brand/30 rounded-lg pl-2.5 pr-2 text-[0.72rem] font-semibold text-slate-700 outline-none hover:border-brand/60 transition-colors"
          />
        </div>
        {(datePreset !== 'all' || activeStoreFilter !== 'ALL') && (
          <button
            onClick={() => {
              setDatePreset('all')
              setCustomDateFrom('')
              setCustomDateTo('')
              setActiveStoreFilter('ALL')
            }}
            className="mt-4 w-full h-8 text-[0.7rem] font-bold text-slate-500 bg-slate-50 border border-brand/30 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            Reset filters
          </button>
        )}
      </div>
    </>
  )
}

const PillSelect = ({ value, onChange, children, icon: Icon, className = '' }) => {
  const options = []
  if (children) {
    React.Children.forEach(children, (child) => {
      if (child?.type === 'option') {
        options.push({ value: child.props.value, label: child.props.children })
      }
    })
  }
  return (
    <div className={`relative flex items-center h-9 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow hover:border-slate-300 transition-all duration-150 ${className}`}>
      {Icon && <Icon size={14} className="text-slate-400 ml-3 shrink-0" />}
      <GlassSelect
        value={value}
        onChange={(val) => onChange({ target: { value: val } })}
        options={options}
        wrapperClassName="flex-1"
        className="h-full bg-transparent pl-2 pr-4 text-[0.75rem] font-semibold text-slate-700 outline-none"
      />
    </div>
  )
}

const VendorDropdown = ({ activeVendor, setActiveVendor, stats }) => {
  const vendors = stats?.vendors || []
  const preferredVendor = vendors.find((vendor) => (vendor.name || vendor.vendor) === DEFAULT_CATALOG_VENDOR)
  const remainingVendors = vendors
    .filter((vendor) => (vendor.name || vendor.vendor) !== DEFAULT_CATALOG_VENDOR)
    .sort((a, b) => (b.style_count || 0) - (a.style_count || 0))
  const orderedVendors = preferredVendor ? [preferredVendor, ...remainingVendors] : remainingVendors
  const totalCount = vendors.reduce((sum, v) => sum + (v.style_count || 0), 0)

  return (
    <GlassSelect
      value={activeVendor}
      onChange={(val) => setActiveVendor(val)}
      options={[
        { value: 'ALL', label: `All Vendors (${totalCount})` },
        ...orderedVendors.map((vendor) => ({
          value: vendor.name || vendor.vendor,
          label: `${vendor.name || vendor.vendor} (${vendor.style_count})`,
        })),
      ]}
      className="h-9 bg-slate-900 rounded-full px-3 text-[0.75rem] font-semibold text-white"
    />
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
          <GlassSelect
            value={sortMetric}
            onChange={(val) => setSortMetric(val)}
            options={[
              { value: 'none', label: 'Sort by' },
              { value: 'views', label: 'Views' },
              { value: 'sold', label: 'Sold' },
              { value: 'returns', label: 'Returns' },
            ]}
            wrapperClassName="flex-1"
            className="h-full bg-transparent pl-2 pr-3 text-[0.75rem] font-semibold text-slate-700 outline-none"
          />
          <GlassSelect
            value={sortOrder}
            onChange={(val) => setSortOrder(val)}
            options={[
              { value: 'highest', label: 'Highest' },
              { value: 'avg', label: 'Avg' },
              { value: 'lowest', label: 'Lowest' },
            ]}
            disabled={sortMetric === 'none'}
            wrapperClassName="flex-1"
            className={`h-full bg-transparent pl-2 pr-3 text-[0.75rem] font-semibold outline-none ${sortMetric === 'none' ? 'text-slate-300' : 'text-slate-700'}`}
          />
        </div>

        {/* Status */}
<PillSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">Status</option>
  <option value="ACTIVE">ACTIVE</option>
  <option value="DRAFT">DRAFT</option>
  <option value="ARCHIVED">Archived</option>
</PillSelect>

        {/* Filters button */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full border shadow-sm transition-all duration-150 text-[0.75rem] font-semibold ${
              filterOpen
                ? 'bg-white/90 backdrop-blur-sm border-slate-300 text-slate-700 shadow-md'
                : 'bg-white/80 backdrop-blur-sm border-slate-200 text-slate-600 hover:bg-white/95 hover:border-slate-300'
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
