import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight, Package,
  RefreshCw, Pencil, Check, ArrowUpRight, ChevronDown,
  TrendingUp, RotateCcw,
  Tag, X, Flame, Plus
} from 'lucide-react'
import AuditDetailsModal from './AuditDetailsModal'
import Header from './Header'
import ConfirmationDialog from './common/ConfirmationDialog'
import KpiGrid from './merchandising/KpiGrid'
import WorkspaceToolbar, { DEFAULT_CATALOG_VENDOR } from './product-workspace/WorkspaceToolbar'
import { apiService } from '../services/api'
import { readJsonStorage, writeJsonStorage } from '../utils/storage'
import toast from 'react-hot-toast'

const STORE_KEYS = ['TDO', 'WDO', 'KOS', 'IM']
const STORE_LABELS = {
  TDO: 'TDO',
  WDO: 'WDO',
  KOS: 'KOS',
  IM: 'IM',
}
const MERCH_DRAFTS_STORAGE_KEY = 'merch_tags_drafts'

const ANALYTICS_FIELDS = [
  'localTimeframe',
  'sales_breakdown',
  'pageviews_details',
  'sell_thru_details',
  'variants_merch',
  'units_sold_30_by_variant',
  'units_sold_60_by_variant',
  'units_sold_7_by_variant',
  'units_sold_by_variant',
  'pageviews',
  'sell_thru',
  'most_sold_color',
  'most_sold_size',
]

const mergePreservedAnalytics = (nextProducts, previousProducts) =>
  nextProducts.map((newProduct) => {
    const existing = previousProducts.find((product) => product.internal_id === newProduct.internal_id)
    if (!existing?.localTimeframe && !existing?.sales_breakdown) return newProduct

    const preserved = {}
    ANALYTICS_FIELDS.forEach((field) => {
      if (existing[field] !== undefined) preserved[field] = existing[field]
    })
    return { ...newProduct, ...preserved }
  })

const normalizeGlobalStats = (globalStats) => {
  if (!globalStats) return null
  const raw = globalStats.stats || globalStats
  return {
    total: raw.total_styles || 0,
    total_units: raw.total_inventory || 0,
    out_of_stock: raw.out_of_stock || 0,
    kos_missing: raw.kos_missing || 0,
    wdo_missing: raw.wdo_missing || 0,
    tdo_missing: raw.tdo_missing || 0,
    vendors: raw.vendors,
    store_health: raw.store_health,
  }
}

const MerchandisingReport = ({ globalStats }) => {
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(() => normalizeGlobalStats(globalStats))
  const [loading, setLoading] = useState(!globalStats)
  const [auditSearch, setAuditSearch] = useState('')
  const [activeVendor, setActiveVendor] = useState(DEFAULT_CATALOG_VENDOR)
  const [activeStoreFilter, setActiveStoreFilter] = useState('ALL')
  const [activeTimeframe, setActiveTimeframe] = useState('30')
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [activeIssue, setActiveIssue] = useState(null)
  const [proposedFixes, setProposedFixes] = useState({})
  const isFixing = false
  const activeStoreFix = 'TDO'
  const [editingPrice, setEditingPrice] = useState(null)
  const [selectedColors, setSelectedColors] = useState({})
  const [addingTag, setAddingTag] = useState(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [breakdownTimeRanges, setBreakdownTimeRanges] = useState({})
  const [pushingStyle, setPushingStyle] = useState(null)
  const [activeStoreTabs, setActiveStoreTabs] = useState({})
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50
  const [datePreset, setDatePreset] = useState('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [sortMetric, setSortMetric] = useState('none')
  const [sortOrder, setSortOrder] = useState('highest')
  const [confirmationModal, setConfirmationModal] = useState(null)
  const [isSyncingPrice, setIsSyncingPrice] = useState(false)
  const [isSyncingTags, setIsSyncingTags] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  const fetchSequenceRef = useRef(0)
  const filterKeyRef = useRef('')

  const getDateRange = useCallback(() => {
    if (datePreset === 'all') return { dateFrom: null, dateTo: null }
    if (datePreset === 'custom') {
      return {
        dateFrom: customDateFrom || null,
        dateTo: customDateTo || null
      }
    }
    const now = new Date()
    if (datePreset === '7d') now.setDate(now.getDate() - 7)
    else if (datePreset === '30d') now.setDate(now.getDate() - 30)
    else if (datePreset === '90d') now.setDate(now.getDate() - 90)
    else if (datePreset === '1y') now.setFullYear(now.getFullYear() - 1)

    return {
      dateFrom: now.toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0]
    }
  }, [datePreset, customDateFrom, customDateTo])

  const fetchData = useCallback(async (silent = false, currentVendor = activeVendor, page = currentPage) => {
    const { dateFrom, dateTo } = getDateRange()
    const requestId = fetchSequenceRef.current + 1
    fetchSequenceRef.current = requestId
    if (!silent) setLoading(true)
    try {
        const vendorQuery = currentVendor === 'ALL' ? '' : currentVendor
        const extraParams = { tagSearch, store: activeStoreFilter }
        const [prodRes, statsRes] = await Promise.all([
          apiService.getProducts(vendorQuery, page, itemsPerPage, auditSearch, dateFrom, dateTo, extraParams),
          apiService.getDashboardStats(vendorQuery, auditSearch, dateFrom, dateTo, extraParams)
        ])

        const rawProducts = prodRes.products || (Array.isArray(prodRes) ? prodRes : [])
        const backendTotal = prodRes.total_count || rawProducts.length
        setTotalCount(backendTotal)

        const parseSizes = (str) => {
          if (!str) return {}
          const res = {}
          str.split(',').forEach(part => {
            const match = part.trim().match(/(.+)\((-?\d+)\)/)
            if (match) res[match[1]] = parseInt(match[2])
          })
          return res
        }

        const mapped = rawProducts.map(p => {
          const storeHealth = {}
          STORE_KEYS.forEach(s => {
            const store = p.store_prices?.[s]
            const isLinked = store?.linked || p[`${s.toLowerCase()}_product_id`]

            if (isLinked) {
              // Status comes from DB — if null/undefined, show UNKNOWN (not DRAFT)
              const rawStatus = store?.status?.toUpperCase() || p[`${s.toLowerCase()}_status`]?.toUpperCase() || null
              storeHealth[s] = rawStatus === 'ACTIVE' ? 'ACTIVE' : rawStatus === 'DRAFT' ? 'DRAFT' : 'UNKNOWN'
            } else {
              storeHealth[s] = 'MISSING'
            }
          })

          return {
            ...p,
            sku: p.style,
            main_image: p.image_url,
            stores: STORE_KEYS.filter(s =>
              p.store_prices?.[s]?.linked ||
              p[`${s.toLowerCase()}_product_id`]
            ).join(','),
            store_health: storeHealth,
            retail_price: p.staged_price,
            shopify_status: (
              p.store_prices?.TDO?.status?.toUpperCase() === 'ACTIVE' ||
              p.store_prices?.WDO?.status?.toUpperCase() === 'ACTIVE' ||
              p.store_prices?.KOS?.status?.toUpperCase() === 'ACTIVE' ||
              p.store_prices?.IM?.status?.toUpperCase() === 'ACTIVE'
            ) ? 'active' : 'draft',
            live_retail_price: p.store_prices?.TDO?.price,
            live_wholesale_price: p.store_prices?.WDO?.price,
            variants: Object.entries(parseSizes(p.staged_sizes)).map(([size, inventory]) => ({ size, inventory })),
          }
        })
        if (fetchSequenceRef.current !== requestId) return
        setProducts(prev => mergePreservedAnalytics(mapped, prev))
        const raw = statsRes.stats || statsRes
        setStats({
          total: raw.total_styles || 0,
          total_units: raw.total_inventory || 0,
          total_sold: raw.total_sold || 0,
          out_of_stock: raw.out_of_stock || 0,
          kos_missing: raw.kos_missing || 0,
          wdo_missing: raw.wdo_missing || 0,
          tdo_missing: raw.tdo_missing || 0,
          im_missing: raw.im_missing || 0,
          vendors: raw.vendors,
          store_health: raw.store_health,
        })
    } catch (err) {
      console.error('API Error:', err)
    } finally {
      if (!silent && fetchSequenceRef.current === requestId) setLoading(false)
    }
  }, [activeVendor, currentPage, itemsPerPage, auditSearch, getDateRange, tagSearch, activeStoreFilter])

  useEffect(() => {
    const { dateFrom, dateTo } = getDateRange()
    const filterKey = [activeVendor, auditSearch, activeStoreFilter, datePreset, dateFrom, dateTo, tagSearch].join('|')
    const filtersChanged = filterKeyRef.current !== filterKey
    filterKeyRef.current = filterKey
    if (filtersChanged && currentPage !== 1) {
      setCurrentPage(1)
      return
    }

    const delayDebounceFn = setTimeout(() => {
      fetchData(false, activeVendor, currentPage)
    }, auditSearch ? 400 : 0)
    return () => clearTimeout(delayDebounceFn)
  }, [activeVendor, activeStoreFilter, auditSearch, currentPage, fetchData, activeTimeframe, getDateRange, datePreset, tagSearch])

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) newExpanded.delete(id)
    else newExpanded.add(id)
    setExpandedRows(newExpanded)
  }

  const handleProposeFix = async () => {
    // Audit fixing disabled
    return;
  }

  const handleSaveLocally = async () => {
    try {
      if (!selectedProduct) return
      const payload = {
        title: proposedFixes.title,
        description: proposedFixes.description,
        meta_title: proposedFixes.meta_title,
        meta_description: proposedFixes.meta_description,
      }
      if (!payload.title && !payload.description && !payload.meta_title && !payload.meta_description) {
        toast.error('No changes found to save as draft.')
        return
      }
      if (!window.confirm('Save these updates as a local draft?')) return
      const result = await apiService.pushProductUpdate(selectedProduct.sku, payload, true)
      if (result.status === 'failed') { toast.error('Backend Error: ' + result.message); return }
      const updatedProduct = {
        ...selectedProduct,
        local_title: payload.title || selectedProduct.local_title,
        local_description: payload.description || selectedProduct.local_description,
        sync_status: {
          ...(selectedProduct.sync_status || {}),
          title: !!payload.title || selectedProduct.sync_status?.title,
          description: !!payload.description || selectedProduct.sync_status?.description,
        },
      }
      setSelectedProduct(updatedProduct)
      setProducts(prev => prev.map(p => p.internal_id === selectedProduct.internal_id ? updatedProduct : p))
      toast.success('Draft saved successfully! Sync Pending indicator updated.')
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  const handlePushToShopify = async () => {
    if (!selectedProduct) return
    const payload = {
      title: proposedFixes.title,
      body_html: proposedFixes.description,
      meta_title: proposedFixes.meta_title,
      meta_description: proposedFixes.meta_description,
    }
    if (!payload.title && !payload.body_html && !payload.meta_title && !payload.meta_description) {
      toast.error('Please generate at least one AI fix before pushing to Shopify.')
      return
    }

    setConfirmationModal({
      title: 'Push AI Fixes to Shopify',
      message: `Are you sure you want to push these AI-generated updates to the LIVE Shopify store?`,
      confirmText: 'Push Updates',
      confirmClass: 'bg-brand hover:opacity-90',
      onConfirm: async () => {
        setIsSyncingPrice(true); // Reuse syncing state for general push
        try {
          const linkedStores = selectedProduct.stores?.split(',').map(s => s.trim()) || ['TDO']
          const result = await apiService.pushProductUpdate(selectedProduct.sku, { ...payload, stores: linkedStores }, false)
          if (result.status === 'failed') {
            toast.error('Shopify Push Failed: ' + (result.message || result.summary || 'Store connection or backup error'))
            return
          }
          toast.success('Changes pushed to Shopify successfully!')
          setSelectedProduct(null)
          fetchData(true)
          setConfirmationModal(null);
        } catch (err) {
          console.error('Push failed:', err)
          toast.error('Push failed');
        } finally {
          setIsSyncingPrice(false);
        }
      }
    });
  }

  const handleTagUpdate = (productId, category, action, tag) => {
    const product = products.find(p => p.product_id === productId || p.internal_id === productId);
    if (!product) return;

    const currentTags = JSON.parse(JSON.stringify(product.tags_categorized || { top: [], bestseller: [], special: [] }));

    if (!currentTags[category]) currentTags[category] = [];
    if (action === 'add') {
      if (!currentTags[category].includes(tag)) currentTags[category].push(tag);
    } else {
      currentTags[category] = currentTags[category].filter(t => t !== tag);
    }

    // Local Update (useState + localStorage)
    setProducts(prev => prev.map(p => (p.product_id === productId || p.internal_id === productId)
      ? { ...p, tags_categorized: currentTags, sync_status: { ...(p.sync_status || {}), tags: true } }
      : p
    ));

    // Save to localStorage
    const drafts = readJsonStorage(MERCH_DRAFTS_STORAGE_KEY, {});
    drafts[productId] = currentTags;
    writeJsonStorage(MERCH_DRAFTS_STORAGE_KEY, drafts);

    toast.info(`Tag ${action === 'add' ? 'added' : 'removed'} to drafts`, { icon: '📝' });
  };

  const pushToShopifyMerch = async (product) => {
    setConfirmationModal({
      title: 'Sync Tags to Shopify',
      message: `Are you sure you want to push tag updates for ${product.sku} to Shopify?`,
      confirmText: 'Push Tags',
      confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: async () => {
        setIsSyncingTags(true);
        setPushingStyle(product.sku);
        try {
          const res = await apiService.updateMerchTags(product.sku, product.tags_categorized);
          if (res.status === 'success' || res.status === 'partial_success') {
            toast.success(res.message || 'Pushed to Shopify and saved!');
            const drafts = readJsonStorage(MERCH_DRAFTS_STORAGE_KEY, {});
            delete drafts[product.internal_id || product.product_id];
            writeJsonStorage(MERCH_DRAFTS_STORAGE_KEY, drafts);
            setProducts(prev => prev.map(p =>
              (p.internal_id === product.internal_id || p.product_id === product.product_id)
                ? { ...p, sync_status: { ...(p.sync_status || {}), tags: false }, needs_sync: false }
                : p
            ));
            setConfirmationModal(null);
          } else {
            toast.error(res.message || 'Push failed');
          }
        } catch (err) {
          toast.error('Push failed: ' + (err.response?.data?.detail || err.message));
        } finally {
          setIsSyncingTags(false);
          setPushingStyle(null);
        }
      }
    });
  };

  const pushPriceToShopify = async (product) => {
    setConfirmationModal({
      title: 'Sync Price to Shopify',
      message: `Do you want to push this price ($${product.retail_price}) on shopify?`,
      confirmText: 'Push to Shopify',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: async () => {
        setIsSyncingPrice(true);
        setPushingStyle(product.sku);
        try {
          const res = await apiService.pushProductUpdate(product.sku, {
            force_shopify: true,
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price
          });
          if (res.status === 'success') {
            toast.success('Price pushed to Shopify!');
            setProducts(prev => prev.map(p => p.sku === product.sku ? { ...p, sync_status: { ...(p.sync_status || {}), price: false, wholesale: false }, has_pushed_price: true } : p));
            setConfirmationModal(null);
          } else {
            toast.error(res.message || 'Push failed');
          }
        } catch (err) {
          toast.error('Push failed: ' + (err.response?.data?.detail || err.message));
        } finally {
          setIsSyncingPrice(false);
          setPushingStyle(null);
        }
      }
    });
  };

  const handleRevert = async (type = 'all', targetProd = null) => {
    const product = targetProd || selectedProduct
    if (!product) return

    const title = type === 'all' ? 'Full Product Revert' : `Revert ${type.toUpperCase()}`
    const message = type === 'all'
      ? `Are you sure you want to FULLY REVERT ${product.sku} to its last known good state? This will undo all recent changes.`
      : `Are you sure you want to revert the ${type.toUpperCase()} of ${product.sku} to its backup version?`

    setConfirmationModal({
      title,
      message,
      confirmText: 'Confirm Revert',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        setIsReverting(true);
        try {
          const payload = {}
          if (type === 'title') payload.title = product.backup_title
          if (type === 'description') payload.description = product.backup_description
          if (type === 'meta_title') payload.meta_title = product.backup_meta_title
          if (type === 'meta_description') payload.meta_description = product.backup_meta_description

          if (type === 'all') {
            await apiService.revertUpdate(product.sku, 'all')
          } else {
            await apiService.pushProductUpdate(product.sku, payload, true)
          }

          toast.success(`Successfully reverted ${type === 'all' ? 'product' : type}`)
          await fetchData(true)
          setSelectedProduct(null)
          setConfirmationModal(null);
        } catch (err) {
          console.error('Revert failed:', err)
          toast.error('Failed to revert: ' + (err.response?.data?.detail || err.message))
        } finally {
          setIsReverting(false);
        }
      }
    });
  }

  const handleRevertPrice = async (product) => {
    setConfirmationModal({
      title: 'Revert Price Changes',
      message: `Are you sure you want to revert the price for ${product.sku} to its last live version?`,
      confirmText: 'Revert Price',
      confirmClass: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: async () => {
        setIsReverting(true);
        try {
          await apiService.revertUpdate(product.sku, 'price');
          toast.success('Price reverted!');
          fetchData(true);
          setConfirmationModal(null);
        } catch (err) {
          toast.error('Revert failed');
        } finally {
          setIsReverting(false);
        }
      }
    });
  };

  const savePrice = async () => {
    if (!editingPrice) return
    const { sku, value, field, store_key, id } = editingPrice
    const newVal = parseFloat(value)
    setProducts(prev => prev.map(p => {
      if (p.internal_id === id) {
        const isRetailDirty = field === 'retail' ? newVal !== p.live_retail_price : p.sync_status?.price
        const isWholesaleDirty = field === 'wholesale' ? newVal !== p.live_wholesale_price : p.sync_status?.wholesale
        const nextStorePrices = store_key && p.store_prices?.[store_key]
          ? { ...p.store_prices, [store_key]: { ...p.store_prices[store_key], price: newVal } }
          : p.store_prices
        const backupRetail = field === 'retail' ? (p.backup_retail_price ?? p.retail_price) : p.backup_retail_price
        const backupWholesale = field === 'wholesale' ? (p.backup_wholesale_price ?? p.wholesale_price) : p.backup_wholesale_price
        return { ...p, store_prices: nextStorePrices, retail_price: field === 'retail' ? newVal : p.retail_price, wholesale_price: field === 'wholesale' ? newVal : p.wholesale_price, backup_retail_price: backupRetail, backup_wholesale_price: backupWholesale, sync_status: { ...(p.sync_status || {}), price: isRetailDirty, wholesale: isWholesaleDirty } }
      }
      return p
    }))
    setEditingPrice(null)
    try {
      const payload = {}
      if (field === 'retail') payload.retail_price = newVal
      if (field === 'wholesale') payload.wholesale_price = newVal
      await apiService.pushProductUpdate(sku, payload, true)
    } catch (err) {
      console.error('Price update failed:', err)
      fetchData(true)
    }
  }

  const handleTimeframeChange = async (sku, timeframe, internalId) => {
    try {
        const data = await apiService.getProductAnalytics(sku, timeframe);
        setProducts(prev => prev.map(p => {
          if (p.internal_id === internalId) {
            return {
              ...p,
              localTimeframe: timeframe,
              pageviews: data.pageviews,
              sell_thru: data.sell_thru,
              most_sold_color: data.most_sold_color,
              most_sold_size: data.most_sold_size,
              sales_breakdown: data.sales_breakdown,
              analytics_notes: data.analytics_notes
            }
          }
          return p;
        }));
    } catch (err) {
      console.error('Failed to update timeframe:', err);
    }
  }




  // remove ACTIVE

  const getStatusBadge = (status, hideActive = false) => {
    const s = status?.toLowerCase() || 'unknown'
    if (s === 'active') {
      if (hideActive) return null
      return (
        <span className="bg-[#f0fdf4] text-[#166534] px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider border border-[#dcfce7] flex items-center gap-1.5 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          active
        </span>
      )
    }
    if (s === 'draft') {
      return (
        <span className="bg-[#f8fafc] text-[#64748b] px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider border border-[#f1f5f9] flex items-center gap-1.5 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]" />
          draft
        </span>
      )
    }
    // UNKNOWN — status not yet set in DB (distinct from DRAFT)
    return (
      <span className="bg-[#fffbeb] text-[#92400e] px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider border border-[#fde68a] flex items-center gap-1.5 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
        {s === 'unknown' ? 'no status' : s}
      </span>
    )
  }

  // Removed top-level loading check to allow localized loading in the table body

  let filtered = products.filter(p => {
    if (activeStoreFilter === 'ALL') return true;
    return p.store_health?.[activeStoreFilter] !== 'MISSING';
  });
  // Apply sort
  if (sortMetric !== 'none') {
    const getVal = (p) => {
      if (sortMetric === 'views') return p.pageviews_details?.days_90 || 0;
      if (sortMetric === 'sold') return p.sell_thru_details?.days_90 || 0;
      if (sortMetric === 'returns') return p.returns_details?.days_90 || 0;
      return 0;
    };
    if (sortOrder === 'avg') {
      const vals = filtered.map(getVal);
      const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
      filtered.sort((a, b) => Math.abs(getVal(a) - mean) - Math.abs(getVal(b) - mean));
    } else {
      filtered.sort((a, b) => (getVal(b) - getVal(a)) * (sortOrder === 'lowest' ? -1 : 1));
    }
  }
  const visibleTotalCount = activeStoreFilter === 'ALL' ? totalCount : filtered.length
  const totalPages = Math.ceil(visibleTotalCount / itemsPerPage)
  const currentItems = filtered

  return (
    <div className="audit-dashboard-content">
      {/* Header */}
      <Header
        title="PRODUCT WORKSPACE"
        eyebrow="Catalog Health"
        search={auditSearch}
        setSearch={setAuditSearch}
        activeStoreFilter={activeStoreFilter}
        setActiveStoreFilter={setActiveStoreFilter}
        showStoreFilter={false}
      />

      <KpiGrid stats={stats} />

      <WorkspaceToolbar
        activeVendor={activeVendor}
        setActiveVendor={setActiveVendor}
        activeStoreFilter={activeStoreFilter}
        setActiveStoreFilter={setActiveStoreFilter}
        stats={stats}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        tagSearch={tagSearch}
        setTagSearch={setTagSearch}
        sortMetric={sortMetric}
        setSortMetric={setSortMetric}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 w-[50px] border-b border-slate-200" />
              <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[80px]">ASSET</th>
              <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[250px]">STYLE / PRODUCT</th>
              <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider">VENDOR</th>
              <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">VIEWS (30/60/90)</th>
              <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">SOLD (30/60/90)</th>
              <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">RETURNS (30/60/90)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-32 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-brand" size={40} />
                    <div className="text-slate-400 font-extrabold text-sm uppercase tracking-widest">Updating Catalog View...</div>
                  </div>
                </td>
              </tr>
            ) : currentItems.map(p => (
              <Fragment key={p.internal_id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors" style={{ transform: 'translateZ(0)' }}>
                  <td className="p-5 text-center">
                    <ChevronRight
                      size={20}
                      onClick={() => toggleExpand(p.internal_id)}
                      className={`cursor-pointer transition-transform text-slate-400 ${expandedRows.has(p.internal_id) ? 'rotate-90' : ''}`}
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
                      <div className="text-[0.7rem] text-slate-400 font-bold truncate max-w-[180px]" title={p.title}>{p.title}</div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="text-[0.8rem] font-bold text-slate-600 uppercase tracking-tight">
                      {p.vendor || 'Unknown'}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center gap-10">
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.pageviews_details?.days_30 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.pageviews_details?.days_60 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-indigo-600 font-black scale-105">{(p.pageviews_details?.days_90 || 0).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center gap-10">
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.sell_thru_details?.days_30 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.sell_thru_details?.days_60 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-emerald-600 font-black scale-105">{(p.sell_thru_details?.days_90 || 0).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center gap-3">
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.returns_details?.days_30 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(p.returns_details?.days_60 || 0).toLocaleString()}</span>
                      <span className="text-[0.8rem] text-rose-600 font-black scale-105">{(p.returns_details?.days_90 || 0).toLocaleString()}</span>
                    </div>
                  </td>
                </tr>

                {expandedRows.has(p.internal_id) && (() => {
                  const linkedStores = STORE_KEYS.filter(sKey => p.store_prices?.[sKey]?.linked);
                  const selectedStoreKey = activeStoreTabs[p.internal_id];
                  const activeStoreKey = linkedStores.includes(selectedStoreKey) ? selectedStoreKey : (linkedStores[0] || 'TDO');
                  const activeStore = p.store_prices?.[activeStoreKey] || {};
                  const activeColorVars = activeStore.color_variants || {};
                  const activeColorTotals = activeStore.color_totals || {};
                  const activeStoreVariants = Array.isArray(activeStore.variants) ? activeStore.variants : [];
                  const variantColors = [...new Set(activeStoreVariants.map(v => v.color).filter(Boolean))];
                  const colorKeys = Object.keys(activeColorVars).length > 0 ? Object.keys(activeColorVars) : variantColors;
                  const selectedColor = selectedColors[p.internal_id];
                  const activeColor = colorKeys.includes(selectedColor) ? selectedColor : (colorKeys[0] || null);
                  const activeVariants = Object.keys(activeColorVars).length > 0
                    ? Object.entries(activeColorVars[activeColor] || {}).map(([size, inv]) => ({ size, inventory: inv, color: activeColor }))
                    : activeStoreVariants.filter(v => !activeColor || v.color === activeColor);
                  const displayTotalStock = activeStore.inventory ?? 0;
                  const displayPrice = activeStoreKey === 'TDO' ? (p.retail_price ?? activeStore.price) : (p.wholesale_price ?? activeStore.price);
                  const activeAdminLink = p.admin_links?.[activeStoreKey.toLowerCase()];
                  const activePriceField = activeStoreKey === 'TDO' ? 'retail' : 'wholesale';
                  const activeSyncKey = activeStoreKey === 'TDO' ? 'price' : 'wholesale';


                  return (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="p-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 grid gap-4 shadow-sm" style={{ gridTemplateColumns: '200px 1fr' }}>
                          {/* Left: image */}
                          <div className="text-center border-r border-slate-100 pr-8">
                            <div className="rounded-xl shadow-sm overflow-hidden bg-slate-100 aspect-[2/3] border border-slate-200">
                              <img
                                src={p.main_image}
                                alt="expanded"
                                loading="lazy"
                                className="w-full transition-opacity duration-500 opacity-0"
                                onLoad={(e) => e.target.classList.remove('opacity-0')}
                              />
                            </div>
                            <div className="mt-4 flex justify-center gap-2.5">
                              <span className="text-[0.65rem] font-extrabold bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-xl">{p.image_count} IMAGES</span>
                              <span className="text-[0.65rem] font-extrabold bg-green-50 text-green-700 px-2.5 py-1.5 rounded-xl">{p.image_width}x{p.image_height}</span>
                            </div>
                            <div className="mt-4">
                              {p.vendor === 'The Dress Outlet' && (
                                <button
                                  onClick={() => { setSelectedProduct({ ...p, isAnalytics: true }) }}
                                  className="w-full bg-indigo-600 text-white border-none py-3 rounded-xl text-[0.85rem] font-extrabold cursor-pointer shadow-[0_4px_10px_rgba(79,70,229,0.25)] hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                  <TrendingUp size={16} /> Analytics Hub
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedProduct(p)
                                  setProposedFixes({ title: p.local_title || null, description: p.local_description || null, meta_title: p.local_meta_title || null, meta_description: p.local_meta_description || null })
                                  setActiveIssue(null)
                                }}
                                className="mt-3 w-full bg-white border border-slate-200 py-3 rounded-xl text-[0.85rem] font-extrabold text-brand cursor-pointer transition-all hover:border-brand hover:shadow-md"
                              >
                                Notes Hub
                              </button>
                            </div>
                          </div>

                          {/* Right: details */}
                          <div className="min-w-0">
                            {/* STORE SWITCHER */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <h3 className="m-0 text-[1.4rem] font-black text-slate-900 tracking-tight">{p.sku}</h3>
{getStatusBadge(activeStore.status)}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-1.5">
                                  {STORE_KEYS.map(sKey => {
                                    const storeObj = p.store_prices?.[sKey];
                                    if (!storeObj?.linked) return null;
                                  const isActive = activeStoreKey === sKey;
                                  return (
                                    <button
                                      key={sKey}
                                      onClick={() => setActiveStoreTabs(prev => ({ ...prev, [p.internal_id]: sKey }))}
                                      className={`px-3 py-1.5 rounded-lg text-[0.7rem] font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${isActive ? 'bg-slate-900 text-white shadow-md shadow-slate-200' : 'bg-white text-slate-600 hover:bg-slate-50 hover:shadow-sm border border-slate-200/60'}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : storeObj.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                        {STORE_LABELS[sKey]}
                                      </button>
                                    );
                                  })}
                                </div>
                                {activeAdminLink && (
                                  <a
                                    href={activeAdminLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[0.7rem] font-black transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 no-underline tracking-wide"
                                  >
                                    <span>Open in Shopify</span>
                                    <ArrowUpRight size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="text-[0.85rem] text-slate-500 font-semibold">{p.title}</div>

                            {/* TAGS MANAGEMENT */}
                            <div className="mt-4 mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
                              <div className="text-[0.6rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-100">
                                    <Tag size={12} className="text-slate-400" />
                                  </div>
                                  TAGS MANAGEMENT
                                </div>
                                {(p.sync_status?.tags || p.needs_sync) && (
                                  <button
                                    onClick={() => pushToShopifyMerch(p)}
                                    disabled={pushingStyle === p.sku}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[0.65rem] font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                  >
                                    {pushingStyle === p.sku ? <RefreshCw size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                                    PUSH
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[0.6rem] font-black text-indigo-600 uppercase tracking-[0.15em] bg-indigo-50 px-2.5 py-1 rounded-lg">Top Tags</span>
                                    {addingTag?.product_id === p.internal_id && addingTag?.category === 'top' ? (
                                      <input
                                        autoFocus
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newTagInput) {
                                            handleTagUpdate(p.internal_id, 'top', 'add', newTagInput);
                                            setAddingTag(null);
                                            setNewTagInput('');
                                          }
                                        }}
                                        className="text-[0.65rem] px-2 py-1 rounded-lg border-2 border-indigo-200 outline-none w-20"
                                        placeholder="..."
                                      />
                                    ) : (
                                      <button onClick={() => { setAddingTag({ product_id: p.internal_id, category: 'top' }); setNewTagInput(''); }} className="text-indigo-300 hover:text-indigo-600 transition-colors"><Plus size={14} /></button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.tags_categorized?.top?.map((tag, idx) => (
                                      <span key={idx} className="group relative inline-flex items-center gap-1.5 text-[0.65rem] font-black px-2.5 py-1 rounded-lg bg-white border border-indigo-100 text-indigo-700 shadow-sm transition-all hover:border-indigo-300">
                                        {tag}
                                        <button onClick={() => handleTagUpdate(p.internal_id, 'top', 'remove', tag)} className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-rose-500 transition-all"><X size={12} /></button>
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[0.6rem] font-black text-amber-600 uppercase tracking-[0.15em] bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1"><Flame size={10} /> Bestseller</span>
                                    {addingTag?.product_id === p.internal_id && addingTag?.category === 'bestseller' ? (
                                      <input
                                        autoFocus
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newTagInput) {
                                            handleTagUpdate(p.internal_id, 'bestseller', 'add', newTagInput);
                                            setAddingTag(null);
                                            setNewTagInput('');
                                          }
                                        }}
                                        className="text-[0.65rem] px-2 py-1 rounded-lg border-2 border-amber-200 outline-none w-20"
                                        placeholder="..."
                                      />
                                    ) : (
                                      <button onClick={() => { setAddingTag({ product_id: p.internal_id, category: 'bestseller' }); setNewTagInput(''); }} className="text-amber-300 hover:text-amber-600 transition-colors"><Plus size={14} /></button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.tags_categorized?.bestseller?.map((tag, idx) => (
                                      <span key={idx} className="group relative inline-flex items-center gap-1.5 text-[0.65rem] font-black px-2.5 py-1 rounded-lg bg-white border border-amber-100 text-amber-700 shadow-sm transition-all hover:border-amber-300">
                                        {tag}
                                        <button onClick={() => handleTagUpdate(p.internal_id, 'bestseller', 'remove', tag)} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-rose-500 transition-all"><X size={12} /></button>
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[0.6rem] font-black text-rose-500 uppercase tracking-[0.15em] bg-rose-50 px-2.5 py-1 rounded-lg w-fit mb-3">Special Tags</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {["No PROM", "No Formal", "Discontinued", "Push PROM"].map(tag => {
                                      const isActive = p.tags_categorized?.special?.includes(tag);
                                      return (
                                        <button
                                          key={tag}
                                          onClick={() => handleTagUpdate(p.internal_id, 'special', isActive ? 'remove' : 'add', tag)}
                                          className={`text-[0.6rem] font-black px-2.5 py-1 rounded-lg border-2 transition-all ${isActive ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white border-slate-100 text-slate-400 hover:border-rose-200 hover:text-rose-600'}`}
                                        >
                                          {tag}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Store-specific price and inventory */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 mt-4">
                              <div className="bg-white p-4 rounded-xl border border-slate-200 relative">
                                <div className="text-[0.65rem] font-extrabold text-green-800 tracking-wider mb-2 uppercase flex justify-between">
                                  PRICE ({activeStoreKey})
                                </div>
                                {p.sync_status?.[activeSyncKey] && <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_0_2px_white]" title="Sync Required" />}
                                <div className="flex items-center gap-2.5">
                                  {editingPrice?.id === p.internal_id && editingPrice?.field === activePriceField ? (
                                    <>
                                      <input type="number" value={editingPrice.value} onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })} className="w-[130px] text-base font-extrabold border-2 border-emerald-500 rounded-lg px-2.5 py-1.5 outline-none" />
                                        <Check size={20} color="#10b981" onClick={() => {
                                          if (!editingPrice) return;
                                          const { sku, value, field } = editingPrice;
                                          const newVal = parseFloat(value);
                                          setConfirmationModal({
                                            title: 'Push Price to Shopify',
                                            message: `Push updated ${field} price ($${newVal.toFixed(2)}) for ${sku} to Shopify?`,
                                            confirmText: 'Push to Shopify',
                                            confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
                                            onConfirm: async () => {
                                              setConfirmationModal(null);
                                              await savePrice();
                                            }
                                          });
                                        }} className="cursor-pointer" />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[1.2rem] font-black text-emerald-700">{displayPrice != null ? `$${displayPrice}` : 'Not synced'}</span>
                                      <Pencil size={16} color="#475569" onClick={() => setEditingPrice({ id: p.internal_id, sku: p.sku, field: activePriceField, store_key: activeStoreKey, value: displayPrice ?? '', product_id: p.product_id, tdo_id: p.tdo_product_id, wdo_id: p.wdo_product_id, kos_id: p.kos_product_id, im_id: p.im_product_id })} className="cursor-pointer" />
                                                                            {(activePriceField === 'retail' ? (p.backup_retail_price && p.backup_retail_price !== p.retail_price) : (p.backup_wholesale_price && p.backup_wholesale_price !== p.wholesale_price)) && <RotateCcw size={14} color="#e11d48" onClick={() => handleRevertPrice(p)} className="cursor-pointer" title="Revert Price" />}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200 relative">
                                <div className="text-[0.65rem] font-extrabold text-red-800 tracking-wider mb-2 uppercase">
                                  TOTAL STOCK
                                </div>
                                <div className="text-[1.2rem] font-black text-rose-700">{displayTotalStock} Units</div>
                              </div>

                            </div>

                            {/* AVAILABLE COLORS */}
                            {activeColorVars && Object.keys(activeColorVars).length > 0 && (
                              <div className="mb-4">
                                <div className="text-[0.65rem] font-extrabold text-slate-600 tracking-wider mb-2 uppercase">AVAILABLE COLORS ({activeStoreKey})</div>
                                <div className="flex gap-2 flex-wrap">
                                  {Object.keys(activeColorVars).map(c => {
                                    const bestColor = p.most_sold_color ? p.most_sold_color.split('(')[0].trim() : '';
                                    const isBest = bestColor && c.toLowerCase() === bestColor.toLowerCase();
                                    return (
                                      <button
                                        key={c}
                                        onClick={() => setSelectedColors({ ...selectedColors, [p.internal_id]: c })}
                                        className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-bold border transition-all relative ${activeColor === c ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                      >
                                        {c} <span className="opacity-75">{activeColorTotals?.[c] || 0}</span>
                                        {isBest && (
                                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.45rem] font-black uppercase tracking-wider bg-amber-300 text-amber-900 border border-amber-400 shadow-sm align-middle">
                                            BEST
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Size Grid Header with Timeframe Filter */}
                            <div className="flex items-center justify-between mb-3 px-1">
                              <div className="text-[0.65rem] font-extrabold text-slate-600 tracking-wider uppercase">Inventory & Sales Breakdown</div>
                              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all hover:bg-white hover:border-brand">
                                <TrendingUp size={14} className="text-brand" />
                                <select
                                  value={p.localTimeframe || activeTimeframe}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleTimeframeChange(p.sku, val, p.internal_id);
                                    setActiveTimeframe(val); // Update global as well for consistency
                                  }}
                                  className="bg-transparent border-none text-[0.75rem] font-black outline-none cursor-pointer appearance-none text-slate-900 pr-4"
                                >
                                  <option value="7">7 Days</option>
                                  <option value="30">30 Days</option>
                                  <option value="60">60 Days</option>
                                  <option value="90">90 Days</option>
                                </select>
                                <ChevronDown size={12} className="text-slate-400 -ml-4 pointer-events-none" />
                              </div>
                            </div>

                            {/* Size Grid */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8 shadow-sm">
                              <div className="overflow-x-auto flex">
                                {activeVariants.length === 0 && (
                                  <div className="w-full p-6 text-center text-sm font-bold text-slate-400">
                                    No size-level inventory synced for {activeStoreKey}.
                                  </div>
                                )}
                                {activeVariants.map(v => {
                                  const bestSizeName = p.most_sold_size ? p.most_sold_size.split('(')[0].trim() : '';
                                  const isBestSize = bestSizeName && v.size.toString() === bestSizeName;
                                  return (
                                  <div key={v.size} className="w-[90px] shrink-0 border-r border-slate-200 flex flex-col relative">
                                    <div className="bg-slate-50 py-2.5 text-[0.75rem] font-black text-center border-b border-slate-200 text-slate-500 uppercase">
                                      {v.size}
                                      {isBestSize && (
                                        <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded-full text-[0.4rem] font-black uppercase tracking-wider bg-amber-300 text-amber-900 border border-amber-400 shadow-sm align-middle">
                                          BEST
                                        </span>
                                      )}
                                    </div>
                                    <div className="p-3.5 text-center flex flex-col items-center justify-center border-b border-slate-100 h-[65px]">
                                      <span className="text-base font-extrabold text-slate-900">{v.inventory}</span>
                                    </div>
                                    <div className="bg-amber-50/50 py-3 text-[0.7rem] font-bold text-center text-amber-800">
                                      {(() => {
                                        const timeframe = p.localTimeframe || activeTimeframe;
                                        if (p.sales_breakdown?.[activeColor]?.[v.size]) {
                                          return p.sales_breakdown[activeColor][v.size];
                                        }
                                        const vKey = `${activeColor?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
                                        if (timeframe === '7' && p.units_sold_7_by_variant?.[vKey] !== undefined) return p.units_sold_7_by_variant[vKey];
                                        if (timeframe === '30' && p.units_sold_30_by_variant?.[vKey] !== undefined) return p.units_sold_30_by_variant[vKey];
                                        if (timeframe === '60' && p.units_sold_60_by_variant?.[vKey] !== undefined) return p.units_sold_60_by_variant[vKey];
                                        if (timeframe === '90' && p.units_sold_by_variant?.[vKey] !== undefined) return p.units_sold_by_variant[vKey];

                                        const variants = p.variants_merch || p.variants || [];
                                        const vMatch = variants.find(vm => vm.size === v.size && (!activeColor || activeColor === "Default" || vm.color === activeColor));
                                        if (vMatch) {
                                          if (timeframe === '7') return vMatch.sold_7 || 0;
                                          if (timeframe === '30') return vMatch.sold_30 || 0;
                                          if (timeframe === '60') return vMatch.sold_60 || 0;
                                          return vMatch.sold_90 || 0;
                                        }
                                        return 0;
                                      })()}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Revert actions */}
                            <div className="flex gap-4 flex-wrap">
                              {p.has_backup && !Object.values(p.sync_status || {}).some(v => v === true) && (p.tdo_product_id || p.wdo_product_id || p.kos_product_id) && (
                                <button onClick={() => handleRevert('all', p)} className="bg-red-50 text-red-600 border border-red-200 px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold cursor-pointer flex items-center gap-2.5 hover:bg-red-100 transition-all">
                                  <RotateCcw size={16} /> Undo Push (Revert)
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl mt-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">
            Showing <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, visibleTotalCount)}</span> of <span className="text-slate-900">{visibleTotalCount}</span> Products
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {(() => {
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);
                if (endPage - startPage < 4) {
                  startPage = Math.max(1, endPage - 4);
                }
                const pages = [];
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(i);
                }
                return pages.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => { setCurrentPage(pageNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${currentPage === pageNum ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
            </div>
            <button
              onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AuditDetailsModal
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        activeIssue={activeIssue}
        setActiveIssue={setActiveIssue}
        proposedFixes={proposedFixes}
        handleProposeFix={handleProposeFix}
        isFixing={isFixing}
        activeStoreFix={activeStoreFix}
        handleSaveLocally={handleSaveLocally}
        handlePushToShopify={handlePushToShopify}
        handleRevert={handleRevert}
      />
      <ConfirmationDialog
        confirmation={confirmationModal}
        busy={isSyncingPrice || isSyncingTags || isReverting}
        onClose={() => setConfirmationModal(null)}
      />
    </div>
  )
}

export default MerchandisingReport
