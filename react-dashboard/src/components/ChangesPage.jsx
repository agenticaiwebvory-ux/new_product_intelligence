import { useEffect, useState, useCallback, useRef } from 'react'
import { apiService } from '../services/api'
import { Search, GitCommitHorizontal, RefreshCw, AlertTriangle, ArrowRight, DollarSign, Package, Hash, Tag, FileText, ChevronDown, ChevronRight, X, Clock, RotateCcw, ArrowUpDown, Check, Trash2, User, TrendingUp, Layers, History, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const CHANGE_META = {
  title: { icon: FileText, label: 'Title', color: 'text-blue-600', bg: 'bg-blue-50', revertType: 'content' },
  retail_price: { icon: DollarSign, label: 'Retail Price', color: 'text-emerald-600', bg: 'bg-emerald-50', revertType: 'price', store: 'TDO' },
  wholesale_price: { icon: DollarSign, label: 'Wholesale Price', color: 'text-amber-600', bg: 'bg-amber-50', revertType: 'price', store: 'WDO' },
  sizes: { icon: Hash, label: 'Sizes', color: 'text-purple-600', bg: 'bg-purple-50', revertType: 'inventory' },
  total_inventory: { icon: Package, label: 'Total Inventory', color: 'text-cyan-600', bg: 'bg-cyan-50', revertType: 'inventory' },
}

const getActionBadge = (type) => {
  const t = String(type || '').toUpperCase()
  if (t.includes('PRICE_UPDATE')) return { icon: TrendingUp, bg: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Price Updated' }
  if (t.includes('STOCK_UPDATE') || t.includes('STOCK')) return { icon: Layers, bg: 'bg-indigo-50 border-indigo-100 text-indigo-700', label: 'Stock Updated' }
  if (t.includes('TAG_UPDATE')) return { icon: Tag, bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Tags Modified' }
  if (t.includes('CONTENT_UPDATE')) return { icon: FileText, bg: 'bg-blue-50 border-blue-100 text-blue-700', label: 'Content Updated' }
  if (t.includes('BACKUP')) return { icon: Package, bg: 'bg-orange-50 border-orange-200 text-orange-700', label: 'Pending Revert' }
  return { icon: History, bg: 'bg-slate-50 border-slate-100 text-slate-700', label: type || 'Change' }
}

const getStoreBadge = (store) => {
  const s = String(store || '').toUpperCase()
  if (s === 'TDO') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (s === 'WDO') return 'bg-purple-100 text-purple-800 border-purple-200'
  if (s === 'IM') return 'bg-blue-100 text-blue-800 border-blue-200'
  if (s === 'KOS') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-800 border-slate-200'
}

function formatUTC(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatUTC(dateStr)
}

const SelectControl = ({ value, onChange, options, icon: Icon, minWidth = 150 }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value) || options[0]

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:text-slate-900 transition-all shadow-sm cursor-pointer px-3 text-xs font-extrabold focus:outline-none"
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
          <span className="truncate">{selected?.label || 'Select...'}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 md:left-0 mt-1.5 w-full min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-[999] max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[0.82rem] font-bold transition-all flex items-center justify-between cursor-pointer ${opt.value === value ? 'bg-slate-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
            >
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const ConfirmationDialog = ({ open, title, message, onConfirm, onCancel, busy, confirmLabel, icon: Icon, iconBg }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-2xl ${iconBg || 'bg-amber-50 border border-amber-200'} flex items-center justify-center mx-auto mb-4`}>
          {Icon ? <Icon size={24} className="text-amber-600" /> : <RotateCcw size={24} className="text-amber-600" />}
        </div>
        <h3 className="text-lg font-black text-slate-900 text-center mb-2">{title}</h3>
        <p className="text-sm font-medium text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2">
            {busy && <RefreshCw size={16} className="animate-spin" />}
            {busy ? 'Working...' : (confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChangesPage() {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedStore, setSelectedStore] = useState('ALL')
  const [expandedId, setExpandedId] = useState(null)
  const [confirm, setConfirm] = useState({ open: false })
  const [reverting, setReverting] = useState({})
  const [clearing, setClearing] = useState({})
  const limit = 50
  const debounceRef = useRef(null)

  const [actionTypeOptions, setActionTypeOptions] = useState([
    { value: 'ALL', label: 'All Actions' },
    { value: 'PRICE_UPDATE', label: 'Price Updates' },
    { value: 'TAG_UPDATE', label: 'Tags Updates' },
    { value: 'STOCK_UPDATE', label: 'Stock Updates' },
    { value: 'CONTENT_UPDATE', label: 'Content Updates' },
    { value: 'BACKUP', label: 'Pending Reverts' },
  ])

  const [storeOptions, setStoreOptions] = useState([
    { value: 'ALL', label: 'All Storefronts' },
    { value: 'TDO', label: 'The Dress Outlet (TDO)' },
    { value: 'WDO', label: 'World Dress Outlet (WDO)' },
    { value: 'IM', label: 'Intimate (IM)' },
    { value: 'KOS', label: 'Main KOS' },
  ])

  useEffect(() => {
    apiService.getChangeLogFilters().then(res => {
      if (res.success) {
        if (res.change_types?.length > 0) {
          setActionTypeOptions(prev => {
            const custom = res.change_types.filter(t => t.value !== 'ALL')
            return [prev[0], ...custom]
          })
        }
        if (res.stores?.length > 0) {
          setStoreOptions(res.stores)
        }
      }
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async (p, s, sort, type, store) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getUnifiedChanges(p, limit, s, sort, type, store)
      setItems(res.items || [])
      setTotalCount(res.total_count || 0)
      setTotalPages(res.total_pages || 1)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load changes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(page, search, sortBy, selectedType, selectedStore)
  }, [page, sortBy, selectedType, selectedStore, fetchData])

  const handleSearch = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchData(1, val, sortBy, selectedType, selectedStore)
    }, 400)
  }

  const parseDiffFields = (entry) => {
    if (entry.source === 'backup' && entry.fields) {
      return entry.fields
    }
    let oldVal = {}
    let newVal = {}
    try { oldVal = JSON.parse(entry.old_value || '{}') } catch {}
    try { newVal = JSON.parse(entry.new_value || '{}') } catch {}
    const fields = {}
    const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)])
    for (const key of allKeys) {
      if (oldVal[key] !== newVal[key]) {
        fields[key] = { before: oldVal[key], after: newVal[key] }
      }
    }
    return fields
  }

  const handleRevert = (entry) => {
    const fields = parseDiffFields(entry)
    const fieldLabels = Object.keys(fields).map(k => CHANGE_META[k]?.label || k).join(', ')
    setConfirm({
      open: true,
      entry,
      title: `Revert for ${entry.style}?`,
      message: entry.source === 'backup'
        ? `Revert ${entry.style} back to previous values (${fieldLabels})?`
        : `Restore ${entry.style} to values before this change (${fieldLabels})?`,
    })
  }

  const handleRevertConfirm = async () => {
    const { entry } = confirm
    const id = entry.id
    setReverting(prev => ({ ...prev, [id]: true }))
    setConfirm(prev => ({ ...prev, busy: true }))
    try {
      if (entry.source === 'backup') {
        const type = entry.change_type?.includes('PRICE_UPDATE') ? 'price' : 'all'
        await apiService.revertUpdate(entry.style, type, null)
      } else {
        const oldVal = JSON.parse(entry.old_value || '{}')
        const payload = {}
        if (oldVal.retail_price !== undefined) payload.retail_price = oldVal.retail_price
        if (oldVal.wholesale_price !== undefined) payload.wholesale_price = oldVal.wholesale_price
        if (Object.keys(payload).length > 0) {
          await apiService.pushProductUpdate(entry.style, payload, true)
        }
      }
      toast.success(`Reverted ${entry.style} successfully`)
      await fetchData(page, search, sortBy, selectedType, selectedStore)
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Revert failed')
    } finally {
      setReverting(prev => ({ ...prev, [id]: false }))
      setConfirm({ open: false, busy: false })
    }
  }

  const handleClear = (style) => {
    setConfirm({
      open: true,
      clearMode: 'single',
      clearSku: style,
      title: `Clear Backup for ${style}?`,
      message: `This will permanently delete the backup for "${style}". The product will no longer appear here and its current values won't be reversible.`,
    })
  }

  const handleClearAll = () => {
    setConfirm({
      open: true,
      clearMode: 'all',
      title: 'Clear All Backups?',
      message: 'This will permanently delete all backup data. Changes will no longer be visible here and cannot be reverted.',
    })
  }

  const handleClearConfirm = async () => {
    const { clearMode, clearSku } = confirm
    setConfirm(prev => ({ ...prev, busy: true }))
    try {
      if (clearMode === 'all') {
        setClearing(prev => ({ ...prev, ['__all__']: true }))
        await apiService.clearAllBackups()
        toast.success('Cleared all backups')
      } else {
        setClearing(prev => ({ ...prev, [clearSku]: true }))
        await apiService.clearBackup(clearSku)
        toast.success(`Cleared backup for ${clearSku}`)
      }
      await fetchData(page, search, sortBy, selectedType, selectedStore)
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to clear backup')
    } finally {
      setClearing(prev => ({ ...prev, ['__all__']: false, [clearSku]: false }))
      setConfirm({ open: false, busy: false })
    }
  }

  const hasBackupEntries = items.some(i => i.source === 'backup')

  return (
    <div className="pt-8 space-y-6">
      <ConfirmationDialog
        open={confirm.open && !confirm.clearMode}
        title={confirm.title}
        message={confirm.message}
        onConfirm={handleRevertConfirm}
        onCancel={() => setConfirm({ open: false })}
        busy={confirm.busy}
        confirmLabel="Confirm Revert"
      />
      <ConfirmationDialog
        open={confirm.open && confirm.clearMode}
        title={confirm.title}
        message={confirm.message}
        onConfirm={handleClearConfirm}
        onCancel={() => setConfirm({ open: false })}
        busy={confirm.busy}
        confirmLabel="Clear Backup"
        icon={Trash2}
        iconBg="bg-red-50 border border-red-200"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <GitCommitHorizontal className="text-slate-900 shrink-0" size={28} />
            Changes
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-semibold">
            Track all product modifications, price updates, tag changes, and pending reverts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && hasBackupEntries && (
            <button onClick={handleClearAll}
              disabled={clearing['__all__']}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Trash2 size={16} className={clearing['__all__'] ? 'animate-spin' : ''} />
              {clearing['__all__'] ? 'Clearing...' : 'Clear All Backups'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-slate-400" />
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-xs w-full">
          <input type="text" placeholder="Search by style, vendor, or user..."
            value={search} onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold pl-9 pr-4 py-2.5 rounded-xl outline-none focus:border-slate-900 transition-colors"
          />
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          {search && (
            <button onClick={() => handleSearch('')} className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <SelectControl value={selectedType} onChange={(v) => { setSelectedType(v); setPage(1) }} options={actionTypeOptions} minWidth={160} />
          </div>
          <SelectControl value={selectedStore} onChange={(v) => { setSelectedStore(v); setPage(1) }} options={storeOptions} minWidth={170} />
          {!loading && (
            <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 whitespace-nowrap">
              {totalCount} change{totalCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm font-bold text-red-700">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 font-semibold">
          <RefreshCw className="animate-spin mr-3" size={20} /> Loading changes...
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Check size={48} className="mx-auto text-emerald-300 mb-4" />
          <h3 className="text-lg font-black text-slate-400 mb-2">No Changes Found</h3>
          <p className="text-sm font-medium text-slate-300 max-w-md mx-auto">
            No audit logs or pending backups match your filters. When you edit a product and push it, changes will appear here.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((entry) => {
            const fields = parseDiffFields(entry)
            const fieldKeys = Object.keys(fields)
            const badge = getActionBadge(entry.change_type)
            const isExpanded = expandedId === entry.id
            const isReverting = reverting[entry.id]
            const isClearing = clearing[entry.style]
            const BadgeIcon = badge.icon

            return (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-sm">
                <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${entry.source === 'backup' ? 'bg-orange-50' : 'bg-indigo-50'}`}>
                      {entry.source === 'backup' ? (
                        <Package size={20} className="text-orange-600" />
                      ) : (
                        <User size={20} className="text-indigo-600" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{entry.style}</span>
                        <div className={`flex items-center gap-1 text-[9px] border font-black px-2 py-0.5 rounded-md shadow-sm uppercase ${badge.bg}`}>
                          <BadgeIcon size={11} />
                          <span>{badge.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {entry.vendor && <span className="text-xs font-semibold text-slate-400">{entry.vendor}</span>}
                        <span className={`text-[10px] font-black border px-2 py-0.5 rounded-lg shadow-sm uppercase ${getStoreBadge(entry.store)}`}>
                          {entry.store || 'TDO'}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400" title={formatUTC(entry.timestamp)}>
                          <Clock size={11} />
                          {timeAgo(entry.timestamp)}
                        </span>
                        {entry.changed_by && entry.source !== 'backup' && (
                          <span className="text-xs font-semibold text-slate-400">by {entry.changed_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.source === 'backup' && (
                      <button onClick={(e) => { e.stopPropagation(); handleClear(entry.style) }}
                        disabled={isClearing}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <Trash2 size={14} className={isClearing ? 'animate-spin' : ''} />
                        {isClearing ? '...' : 'Clear'}
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleRevert(entry) }}
                      disabled={isReverting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <RotateCcw size={14} className={isReverting ? 'animate-spin' : ''} />
                      {isReverting ? 'Reverting...' : 'Revert'}
                    </button>
                    {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-300" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                    {fieldKeys.map((key) => {
                      const meta = CHANGE_META[key] || { icon: Tag, label: key, color: 'text-slate-600', bg: 'bg-slate-50' }
                      const Icon = meta.icon
                      const { before, after } = fields[key]
                      return (
                        <div key={key} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-slate-50/50 border border-slate-100">
                          <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                            <Icon size={14} className={meta.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.65rem] font-black text-slate-400 uppercase tracking-wider mb-1.5">{meta.label}</div>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                              <div className="bg-red-50 border border-red-200 rounded-lg p-2 min-w-0">
                                <div className="text-[0.6rem] font-bold text-red-500 uppercase mb-0.5">Before</div>
                                <div className="text-sm font-bold text-red-800 break-words">{String(before ?? '-')}</div>
                              </div>
                              <div className="flex items-center justify-center pt-4">
                                <ArrowRight size={14} className="text-slate-300" />
                              </div>
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 min-w-0">
                                <div className="text-[0.6rem] font-bold text-emerald-500 uppercase mb-0.5">After</div>
                                <div className="text-sm font-bold text-emerald-800 break-words">{String(after ?? '-')}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm font-semibold text-slate-400">Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >Previous</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const n = start + i
              if (n > totalPages) return null
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all cursor-pointer ${n === page ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >{n}</button>
              )
            })}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
