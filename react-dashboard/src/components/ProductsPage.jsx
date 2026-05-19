import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { apiService } from '../services/api'
import { STORE_KEYS, STORE_LABELS } from '../constants/dashboard'
import { Search, Package, ChevronDown, ChevronRight, RefreshCw, Filter, X, AlertTriangle, Eye, ShoppingCart, Grid3X3, List } from 'lucide-react'
import { formatCompactNumber } from '../utils/format'

const IM_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNGMUY1RjkiLz48cGF0aCBkPSJNMjAgMTBDMTQuNDggMTAgMTAgMTQuNDggMTAgMjBDMTAgMjUuNTIgMTQuNDggMzAgMjAgMzBDMjUuNTIgMzAgMzAgMjUuNTIgMzAgMjBDMzAgMTQuNDggMjUuNTIgMTAgMjAgMTBaTTIwIDI4QzE1LjU4IDI4IDEyIDI0LjQyIDEyIDIwQzEyIDE1LjU4IDE1LjU4IDEyIDIwIDEyQzI0LjQyIDEyIDI4IDE1LjU4IDI4IDIwQzI4IDI0LjQyIDI0LjQyIDI4IDIwIDI4Wk0yMSAxNVYxOUgyNVYyMUgyMVYyNUgxOVYyMUgxNVYxOUgxOVYxNUgyMVoiIGZpbGw9IiM5NEEzQjgiLz48L3N2Zz4='

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [vendor, setVendor] = useState('')
  const [activeStore, setActiveStore] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [expandedProducts, setExpandedProducts] = useState({})
  const limit = 20
  const debounceRef = useRef(null)

  const fetchData = useCallback(async (v, s, p) => {
    setLoading(true)
    setError(null)
    try {
      const [prodRes, statsRes] = await Promise.all([
        apiService.getProducts(v, p, limit, s),
        apiService.getDashboardStats(v, s),
      ])
      setProducts(prodRes.products || [])
      setTotalCount(prodRes.total_count || 0)
      setStats(statsRes.stats || null)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(vendor, search, page)
  }, [vendor, page, fetchData])

  const handleSearch = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchData(vendor, val, 1)
    }, 400)
  }

  const handleStoreClick = (storeKey) => {
    setActiveStore(activeStore === storeKey ? null : storeKey)
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const toggleProductExpand = (style) => {
    setExpandedProducts((prev) => ({ ...prev, [style]: !prev[style] }))
  }

  const filteredProducts = activeStore
    ? products.filter((p) => {
        const storePrices = p.store_prices || {}
        return storePrices[activeStore]?.linked
      })
    : products

  const totalPages = Math.ceil(totalCount / limit)

  const StoreBadge = ({ storeKey, storeData }) => {
    if (!storeData?.linked) return null
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleStoreClick(storeKey) }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer
          ${activeStore === storeKey
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${storeData.status === 'active' || storeData.inventory > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        {STORE_LABELS[storeKey] || storeKey}
      </button>
    )
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Products</h1>
          <p className="text-sm font-medium text-slate-400 mt-1">Multi-store product catalog browser</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid3X3 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by style, vendor, or title..."
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

        {stats?.vendors && (
          <select
            value={vendor}
            onChange={(e) => { setVendor(e.target.value); setPage(1) }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
          >
            <option value="">All Vendors ({stats.vendors.length})</option>
            {stats.vendors.map((v) => (
              <option key={v.id} value={v.name}>{v.name} ({v.style_count})</option>
            ))}
          </select>
        )}

        {activeStore && (
          <button
            onClick={() => setActiveStore(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
          >
            <Filter size={14} /> Store: {STORE_LABELS[activeStore]}
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm font-bold text-red-700">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 font-semibold">
          <RefreshCw className="animate-spin mr-3" size={20} /> Loading products...
        </div>
      )}

      {/* Results count */}
      {!loading && !error && (
        <div className="text-sm font-semibold text-slate-400">
          Showing {filteredProducts.length} of {formatCompactNumber(totalCount)} products
          {activeStore && ` in ${STORE_LABELS[activeStore]}`}
        </div>
      )}

      {/* Product List / Grid */}
      {!loading && !error && viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="w-10 p-3"></th>
                  <th className="text-left p-3 text-xs font-black text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-left p-3 text-xs font-black text-slate-400 uppercase tracking-wider">Style / SKU</th>
                  <th className="text-left p-3 text-xs font-black text-slate-400 uppercase tracking-wider">Vendor</th>
                  <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Available Stores</th>
                  <th className="p-3 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const prices = p.store_prices || {}
                  const linkedStores = STORE_KEYS.filter((k) => prices[k]?.linked)
                  const totalInv = linkedStores.reduce((sum, k) => sum + (prices[k]?.inventory || 0), 0)
                  return (
                    <Fragment key={p.style || p.product_id}>
                      <tr
                        onClick={() => toggleProductExpand(p.style)}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer"
                      >
                        <td className="p-3 text-center">
                          {expandedProducts[p.style] ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-300" />}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.image_url || IM_PLACEHOLDER}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-100"
                              onError={(e) => { e.target.src = IM_PLACEHOLDER }}
                            />
                            <span className="font-bold text-slate-800 truncate max-w-[200px]">{p.title || p.style}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-sm font-bold text-slate-600">{p.style}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-semibold text-slate-500">{p.vendor || '-'}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {STORE_KEYS.map((k) => (
                              <StoreBadge key={k} storeKey={k} storeData={prices[k]} />
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-sm font-black ${totalInv === 0 ? 'text-red-500' : totalInv < 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                            {formatCompactNumber(totalInv)}
                          </span>
                        </td>
                      </tr>
                      {expandedProducts[p.style] && (
                        <tr key={`${p.style}-expanded`}>
                          <td colSpan={6} className="p-0">
                            <div className="bg-slate-50/80 px-6 py-5 border-b border-slate-100">
                              <div className="grid grid-cols-4 gap-4">
                                {STORE_KEYS.map((k) => {
                                  const sp = prices[k]
                                  if (!sp?.linked) return null
                                  return (
                                    <div key={k} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase text-slate-500">{STORE_LABELS[k]}</span>
                                        <div className={`w-2 h-2 rounded-full ${sp.status === 'active' || sp.inventory > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-semibold">Price</span>
                                        <span className="font-black text-slate-800">${sp.price || '-'}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-semibold">Inventory</span>
                                        <span className={`font-black ${sp.inventory > 0 ? 'text-slate-800' : 'text-red-500'}`}>{sp.inventory || 0}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-semibold">Status</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                          {sp.status || 'unknown'}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Package size={40} className="mx-auto text-slate-200 mb-3" />
                      <div className="text-sm font-bold text-slate-400">No products found</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {!loading && !error && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const prices = p.store_prices || {}
            const linkedStores = STORE_KEYS.filter((k) => prices[k]?.linked)
            return (
              <div key={p.style} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 transition-all hover:shadow-md hover:border-slate-300">
                <img
                  src={p.image_url || IM_PLACEHOLDER}
                  alt=""
                  className="w-full h-40 rounded-lg object-cover bg-slate-100 border border-slate-100"
                  onError={(e) => { e.target.src = IM_PLACEHOLDER }}
                />
                <div>
                  <div className="font-mono text-xs font-bold text-slate-400">{p.style}</div>
                  <div className="font-bold text-sm text-slate-800 truncate">{p.title || p.style}</div>
                  <div className="text-xs font-semibold text-slate-400 mt-0.5">{p.vendor || '-'}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {linkedStores.map((k) => (
                    <StoreBadge key={k} storeKey={k} storeData={prices[k]} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm font-semibold text-slate-400">
            Page {page} of {totalPages}
          </div>
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
