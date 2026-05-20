import { useEffect, useState, useCallback, useRef } from 'react'
import { apiService } from '../services/api'
import { Search, GitCommitHorizontal, RefreshCw, AlertTriangle, ArrowRight, DollarSign, Package, Hash, Tag, FileText, ChevronDown, ChevronRight, X, Clock, RotateCcw, ArrowUpDown, Check, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CHANGE_META = {
  title: { icon: FileText, label: 'Title', color: 'text-blue-600', bg: 'bg-blue-50', revertType: 'content' },
  retail_price: { icon: DollarSign, label: 'Retail Price', color: 'text-emerald-600', bg: 'bg-emerald-50', revertType: 'price', store: 'TDO' },
  wholesale_price: { icon: DollarSign, label: 'Wholesale Price', color: 'text-amber-600', bg: 'bg-amber-50', revertType: 'price', store: 'WDO' },
  sizes: { icon: Hash, label: 'Sizes', color: 'text-purple-600', bg: 'bg-purple-50', revertType: 'inventory' },
  total_inventory: { icon: Package, label: 'Total Inventory', color: 'text-cyan-600', bg: 'bg-cyan-50', revertType: 'inventory' },
}

const ChangeRow = ({ change, field, before, after, sku, onRevert, reverting }) => {
  const meta = CHANGE_META[field] || { icon: Tag, label: field, color: 'text-slate-600', bg: 'bg-slate-50', revertType: 'all' }
  const Icon = meta.icon
  const isReverting = reverting[sku]?.[meta.revertType]

  return (
    <div className="flex items-start gap-4 py-3 px-4 rounded-lg bg-slate-50/50 border border-slate-100 group">
      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={meta.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{meta.label}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 min-w-0">
            <div className="text-[0.65rem] font-bold text-red-500 uppercase mb-1">Before</div>
            <div className="text-sm font-bold text-red-800 break-words">{String(before ?? '-')}</div>
          </div>
          <div className="flex items-center justify-center pt-5">
            <ArrowRight size={16} className="text-slate-300" />
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 min-w-0">
            <div className="text-[0.65rem] font-bold text-emerald-500 uppercase mb-1">After</div>
            <div className="text-sm font-bold text-emerald-800 break-words">{String(after ?? '-')}</div>
          </div>
        </div>
      </div>
      <button
        onClick={() => onRevert(sku, meta.revertType, field, before, after)}
        disabled={isReverting}
        className="opacity-0 group-hover:opacity-100 shrink-0 mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-all cursor-pointer"
      >
        <RotateCcw size={14} className={isReverting ? 'animate-spin' : ''} />
        {isReverting ? 'Reverting...' : 'Revert'}
      </button>
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
          <button onClick={onCancel} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2">
            {busy && <RefreshCw size={16} className="animate-spin" />}
            {busy ? 'Working...' : (confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function timeAgo(dateStr) {
  if (!dateStr) return null
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
  return date.toLocaleDateString()
}

export default function ChangesPage() {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [expandedStyle, setExpandedStyle] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, sku: null, type: 'all', field: '' })
  const [clearConfirm, setClearConfirm] = useState({ open: false, mode: null, sku: null })
  const [reverting, setReverting] = useState({})
  const [clearing, setClearing] = useState({})
  const limit = 50
  const debounceRef = useRef(null)

  const fetchData = useCallback(async (p, s, sort) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.getProductChanges(p, limit, s, sort)
      setItems(res.items || [])
      setTotalCount(res.total_count || 0)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load changes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(page, search, sortBy)
  }, [page, sortBy, fetchData])

  const handleSearch = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchData(1, val, sortBy)
    }, 400)
  }

  const handleRevertClick = (sku, type, field, before = null, after = null) => {
    const meta = CHANGE_META[field] || { label: 'this field' }
    const storeText = meta.store ? ` (${meta.store})` : ''
    const message = type === 'price' && before !== null
      ? `Revert ${sku}${storeText} from ${String(after ?? '-')} back to ${String(before ?? '-')}?`
      : `Are you sure you want to revert "${sku}" back to the previous ${meta.label.toLowerCase()}?`
    setConfirm({
      open: true,
      sku,
      type,
      store: meta.store || null,
      field: field || 'all',
      title: `Revert ${meta.label}${storeText}?`,
      message,
    })
  }

  const handleRevertConfirm = async () => {
    const { sku, type, store } = confirm
    setReverting((prev) => ({ ...prev, [sku]: { ...prev[sku], [type]: true } }))
    setConfirm((prev) => ({ ...prev, busy: true }))
    try {
      await apiService.revertUpdate(sku, type, store)
      toast.success(`Reverted ${sku} successfully`)
      await fetchData(page, search, sortBy)
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Revert failed')
    } finally {
      setReverting((prev) => ({ ...prev, [sku]: { ...prev[sku], [type]: false } }))
      setConfirm({ open: false, sku: null, type: 'all', store: null, field: '', busy: false })
      if (expandedStyle === sku) setExpandedStyle(null)
    }
  }

  const handleClearClick = (sku) => {
    setClearConfirm({ open: true, mode: 'single', sku })
  }

  const handleClearAllClick = () => {
    setClearConfirm({ open: true, mode: 'all', sku: null })
  }

  const handleClearConfirm = async () => {
    const { mode, sku } = clearConfirm
    if (mode === 'single') {
      setClearing((prev) => ({ ...prev, [sku]: true }))
      setClearConfirm((prev) => ({ ...prev, busy: true }))
      try {
        await apiService.clearBackup(sku)
        toast.success(`Cleared backup for ${sku}`)
        setItems((prev) => prev.filter((item) => item.style !== sku))
        setTotalCount((prev) => Math.max(0, prev - 1))
      } catch (e) {
        toast.error(e?.response?.data?.detail || e.message || 'Failed to clear backup')
      } finally {
        setClearing((prev) => ({ ...prev, [sku]: false }))
        setClearConfirm({ open: false, mode: null, sku: null, busy: false })
        if (expandedStyle === sku) setExpandedStyle(null)
      }
    } else {
      setClearConfirm((prev) => ({ ...prev, busy: true }))
      setClearing((prev) => ({ ...prev, ['__all__']: true }))
      try {
        await apiService.clearAllBackups()
        toast.success('Cleared all backups')
        setItems([])
        setTotalCount(0)
      } catch (e) {
        toast.error(e?.response?.data?.detail || e.message || 'Failed to clear backups')
      } finally {
        setClearing((prev) => ({ ...prev, ['__all__']: false }))
        setClearConfirm({ open: false, mode: null, sku: null, busy: false })
      }
    }
  }

  const totalPages = Math.ceil(totalCount / limit)
  const changeCount = items.reduce((sum, item) => sum + Object.keys(item.changes || {}).length, 0)

  const toggleExpand = (style) => {
    setExpandedStyle(expandedStyle === style ? null : style)
  }

  return (
    <div className="py-6 space-y-6">
      <ConfirmationDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={handleRevertConfirm}
        onCancel={() => setConfirm({ open: false, sku: null, type: 'all', store: null, field: '', busy: false })}
        busy={confirm.busy}
        confirmLabel="Confirm Revert"
      />

      <ConfirmationDialog
        open={clearConfirm.open}
        title={clearConfirm.mode === 'all' ? 'Clear All Backups?' : 'Clear Backup?'}
        message={
          clearConfirm.mode === 'all'
            ? 'This will permanently delete all backup data. Changes will no longer be visible here and cannot be reverted. This is a cleanup action, not a revert.'
            : `This will permanently delete the backup for "${clearConfirm.sku}". The product will no longer appear here and its current values won\'t be reversible.`
        }
        onConfirm={handleClearConfirm}
        onCancel={() => setClearConfirm({ open: false, mode: null, sku: null, busy: false })}
        busy={clearConfirm.busy}
        confirmLabel="Clear Backup"
        icon={Trash2}
        iconBg="bg-red-50 border border-red-200"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Product Changes</h1>
          <p className="text-sm font-medium text-slate-400 mt-1">Track and revert product edits pushed to stores</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && items.length > 0 && (
            <button
              onClick={handleClearAllClick}
              disabled={clearing['__all__']}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Trash2 size={16} />
              {clearing['__all__'] ? 'Clearing...' : 'Clear All'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search + summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by style or vendor..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
          />
          {search && (
            <button onClick={() => handleSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>
        {!loading && (
          <div className="text-sm font-semibold text-slate-400 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            {totalCount} product{totalCount !== 1 ? 's' : ''} · {changeCount} change{changeCount !== 1 ? 's' : ''}
          </div>
        )}
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
          <h3 className="text-lg font-black text-slate-400 mb-2">No Pending Changes</h3>
          <p className="text-sm font-medium text-slate-300 max-w-md mx-auto">
            When you edit a product's price, sizes, or title in the <strong>Workspace</strong> and push it, the previous values will appear here for reverting.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const changeKeys = Object.keys(item.changes || {})
            const isExpanded = expandedStyle === item.style
            const ts = item.changes_made_at
            const sku = item.style
            const isClearing = clearing[sku]
            return (
              <div key={`${item.source_table}:${sku}`} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:shadow-sm">
                {/* Header */}
                <button
                  onClick={() => toggleExpand(sku)}
                  className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <GitCommitHorizontal size={20} className="text-amber-600" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{sku}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-semibold text-slate-400">{item.vendor || '-'}</span>
                        {ts && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400" title={new Date(ts).toLocaleString()}>
                            <Clock size={12} className="text-slate-400" />
                            {timeAgo(ts)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {changeKeys.map((key) => {
                        const meta = CHANGE_META[key]
                        if (!meta) return null
                        const Icon = meta.icon
                        return (
                          <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.65rem] font-bold ${meta.bg} ${meta.color}`}>
                            <Icon size={10} /> {meta.label}
                          </span>
                        )
                      })}
                    </div>
                    {/* Clear button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClearClick(sku) }}
                      disabled={isClearing || reverting[sku]?.all}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} className={isClearing ? 'animate-spin' : ''} />
                      {isClearing ? 'Clearing...' : 'Clear'}
                    </button>
                    {/* Revert All button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRevertClick(sku, 'all', 'all') }}
                      disabled={reverting[sku]?.all || isClearing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <RotateCcw size={14} className={reverting[sku]?.all ? 'animate-spin' : ''} />
                      {reverting[sku]?.all ? 'Reverting...' : 'Revert All'}
                    </button>
                    {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-300" />}
                  </div>
                </button>

                {/* Expanded Changes */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                    {changeKeys.map((field) => (
                      <ChangeRow
                        key={field}
                        field={field}
                        sku={sku}
                        before={item.changes[field].before}
                        after={item.changes[field].after}
                        onRevert={handleRevertClick}
                        reverting={reverting}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm font-semibold text-slate-400">Page {page} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const n = start + i
              if (n > totalPages) return null
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all cursor-pointer ${n === page ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {n}
                </button>
              )
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
