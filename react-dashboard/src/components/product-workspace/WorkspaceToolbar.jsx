import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Tag, Eye, TrendingUp, RotateCcw, CalendarDays } from 'lucide-react'
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

const SelectControl = ({ value, onChange, children, minWidth = 150, width, highlight = false }) => {
  const isHighlighted = highlight
  return (
    <div className="relative" style={width ? { width } : undefined}>
      <select
        value={value}
        onChange={onChange}
        className={`h-10 appearance-none pl-3 pr-9 rounded-lg text-[0.78rem] font-extrabold outline-none transition-all cursor-pointer shadow-sm border truncate ${isHighlighted ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'}`}
        style={{ minWidth, width: width || undefined }}
      >
        {children}
      </select>
      <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isHighlighted ? 'text-white' : 'text-slate-400'}`} />
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
    <SelectControl value={activeVendor} onChange={(e) => setActiveVendor(e.target.value)} width={217} highlight>
      <option value="ALL">All Vendors ({totalCount})</option>
      {orderedVendors.map((vendor) => {
        const name = vendor.name || vendor.vendor
        return (
          <option key={name} value={name}>{name} ({vendor.style_count})</option>
        )
      })}
    </SelectControl>
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
  viewsFilter,
  setViewsFilter,
  sellThruFilter,
  setSellThruFilter,
  returnsFilter,
  setReturnsFilter,
}) => {
  const storeKeys = useAppSelector((state) => Object.keys(state.stores.connections))

  return (
    <div className="sticky top-[73px] z-[900] -mx-8 px-8 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <VendorDropdown activeVendor={activeVendor} setActiveVendor={setActiveVendor} stats={stats} />
        <SelectControl value={activeStoreFilter} onChange={(e) => setActiveStoreFilter(e.target.value)} minWidth={145}>
          <option value="ALL">All Stores</option>
          {storeKeys.map((store) => (
            <option key={store} value={store.toUpperCase()}>{store.toUpperCase()} Store</option>
          ))}
        </SelectControl>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg h-10 shadow-sm">
          <div className="flex items-center gap-1.5 pl-3 pr-1">
            <CalendarDays size={14} className="text-slate-400" />
          </div>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="h-10 appearance-none bg-transparent pr-7 text-[0.78rem] font-extrabold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last 1 Year</option>
            <option value="custom">Custom Range</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none -ml-4 text-slate-400" />
        </div>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-lg h-10 shadow-sm overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 border-r border-slate-100 h-full">
              <CalendarDays size={12} className="text-slate-400" />
              <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-wider">From</span>
            </div>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="text-[0.78rem] font-extrabold text-slate-700 outline-none bg-transparent cursor-pointer px-2 h-full"
            />
            <div className="flex items-center px-2 h-full border-x border-slate-100">
              <span className="text-[0.65rem] font-black text-slate-300 uppercase tracking-wider">to</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 border-r border-slate-100 h-full">
              <CalendarDays size={12} className="text-slate-400" />
              <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-wider">To</span>
            </div>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="text-[0.78rem] font-extrabold text-slate-700 outline-none bg-transparent cursor-pointer px-2 h-full"
            />
          </div>
        )}

        {/* Tags filter */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 h-10 shadow-sm">
          <Tag size={14} className="text-slate-400" />
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Filter by tag..."
            className="text-[0.78rem] font-bold text-slate-700 outline-none bg-transparent w-[130px] placeholder:text-slate-300"
          />
          {tagSearch && (
            <button onClick={() => setTagSearch('')} className="text-slate-300 hover:text-slate-500 text-lg leading-none">&times;</button>
          )}
        </div>

        {/* Views filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-1.5 pl-3 pr-1">
            <Eye size={14} className="text-slate-400" />
          </div>
          <select
            value={viewsFilter}
            onChange={(e) => setViewsFilter(e.target.value)}
            className="h-10 appearance-none bg-transparent pr-7 pl-1 text-[0.78rem] font-extrabold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">Views</option>
            <option value="highest">Highest</option>
            <option value="avg">Avg</option>
            <option value="lowest">Lowest</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none -ml-5 text-slate-400" />
        </div>

        {/* Sell Thru filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-1.5 pl-3 pr-1">
            <TrendingUp size={14} className="text-slate-400" />
          </div>
          <select
            value={sellThruFilter}
            onChange={(e) => setSellThruFilter(e.target.value)}
            className="h-10 appearance-none bg-transparent pr-7 pl-1 text-[0.78rem] font-extrabold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">Sold</option>
            <option value="highest">Highest</option>
            <option value="avg">Avg</option>
            <option value="lowest">Lowest</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none -ml-5 text-slate-400" />
        </div>

        {/* Returns filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-1.5 pl-3 pr-1">
            <RotateCcw size={14} className="text-slate-400" />
          </div>
          <select
            value={returnsFilter}
            onChange={(e) => setReturnsFilter(e.target.value)}
            className="h-10 appearance-none bg-transparent pr-7 pl-1 text-[0.78rem] font-extrabold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">Returns</option>
            <option value="highest">Highest</option>
            <option value="avg">Avg</option>
            <option value="lowest">Lowest</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none -ml-5 text-slate-400" />
        </div>
      </div>
    </div>
  )
}

export default WorkspaceToolbar
