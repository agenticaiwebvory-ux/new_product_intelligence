import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  RefreshCw, Pencil, Check, ArrowUpRight, ChevronDown,
  TrendingUp, RotateCcw,
  Tag, X, Flame, Plus
} from 'lucide-react'
import AuditDetailsModal from './AuditDetailsModal'
import Header from './Header'
import ConfirmationDialog from './common/ConfirmationDialog'
import KpiGrid from './merchandising/KpiGrid'
import ProductAnalyticsPanel from './merchandising/ProductAnalyticsPanel'
import ProductDetailContent from './merchandising/ProductDetailContent'
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

const formatMoney = (value) => {
  const number = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : '-'
}

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
  const [detailProduct, setDetailProduct] = useState(null)
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmationModal, setConfirmationModal] = useState(null)
  const [isSyncingPrice, setIsSyncingPrice] = useState(false)
  const [isSyncingTags, setIsSyncingTags] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  const [processingOps, setProcessingOps] = useState({})
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
        const extraParams = { tagSearch, store: activeStoreFilter, status: statusFilter }
        const [prodRes, statsRes, analyticsRes] = await Promise.all([
          apiService.getProducts(vendorQuery, page, itemsPerPage, auditSearch, dateFrom, dateTo, extraParams),
          apiService.getDashboardStats(vendorQuery, auditSearch, dateFrom, dateTo, extraParams),
          apiService.getDashboardAnalytics(vendorQuery, auditSearch, dateFrom, dateTo, extraParams).catch(() => null)
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
  }, [activeVendor, currentPage, itemsPerPage, auditSearch, getDateRange, tagSearch, activeStoreFilter, statusFilter])

  useEffect(() => {
    const { dateFrom, dateTo } = getDateRange()
    const filterKey = [activeVendor, auditSearch, activeStoreFilter, datePreset, dateFrom, dateTo, tagSearch, statusFilter].join('|')
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

  const handlePushToShopify = () => {
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
      onConfirm: () => {
        const sku = selectedProduct.sku
        const linkedStores = selectedProduct.stores?.split(',').map(s => s.trim()) || ['TDO']

        setProcessingOps(prev => ({ ...prev, [sku]: { type: 'pushing_fixes' } }))
        setConfirmationModal(null)
        setSelectedProduct(null)

        apiService.pushProductUpdate(sku, { ...payload, stores: linkedStores }, false)
          .then(result => {
            if (result.status === 'failed') {
              toast.error('Shopify Push Failed: ' + (result.message || result.summary || 'Store connection or backup error'))
            } else {
              toast.success('Changes pushed to Shopify successfully!')
            }
          })
          .catch(err => {
            toast.error('Push failed')
          })
          .finally(() => {
            setProcessingOps(prev => { const n = { ...prev }; delete n[sku]; return n })
            fetchData(true)
          })
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

  const pushToShopifyMerch = (product) => {
    setConfirmationModal({
      title: 'Sync Tags to Shopify',
      message: `Are you sure you want to push tag updates for ${product.sku} to Shopify?`,
      confirmText: 'Push Tags',
      confirmClass: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: () => {
        const sku = product.sku
        const pid = product.internal_id || product.product_id

        setProcessingOps(prev => ({ ...prev, [sku]: { type: 'pushing_tags' } }))
        setConfirmationModal(null)
        setDetailProduct(null)

        apiService.updateMerchTags(sku, product.tags_categorized)
          .then(res => {
            if (res.status === 'success' || res.status === 'partial_success') {
              toast.success(res.message || 'Pushed to Shopify and saved!')
              const drafts = readJsonStorage(MERCH_DRAFTS_STORAGE_KEY, {})
              delete drafts[pid]
              writeJsonStorage(MERCH_DRAFTS_STORAGE_KEY, drafts)
              setProducts(prev => prev.map(p =>
                (p.internal_id === pid || p.product_id === pid)
                  ? { ...p, sync_status: { ...(p.sync_status || {}), tags: false }, needs_sync: false }
                  : p
              ))
            } else {
              toast.error(res.message || 'Push failed')
            }
          })
          .catch(err => {
            toast.error('Push failed: ' + (err.response?.data?.detail || err.message))
          })
          .finally(() => {
            setProcessingOps(prev => { const n = { ...prev }; delete n[sku]; return n })
            fetchData(true)
          })
      }
    });
  };

  const pushPriceToShopify = (product, storeKey = 'TDO') => {
    const normalizedStore = (storeKey || 'TDO').toUpperCase()
    const isRetailStore = normalizedStore === 'TDO'
    const targetPrice = (isRetailStore ? product.retail_price : product.wholesale_price) ?? product.store_prices?.[normalizedStore]?.price
    setConfirmationModal({
      title: 'Sync Price to Shopify',
      message: `Push ${normalizedStore} price ${formatMoney(targetPrice)} for ${product.sku} to Shopify?`,
      confirmText: 'Push to Shopify',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: () => {
        const sku = product.sku
        const payload = { stores: [normalizedStore] }
        if (product.retail_price !== null && product.retail_price !== undefined) {
          payload.retail_price = product.retail_price
        }
        if (product.wholesale_price !== null && product.wholesale_price !== undefined) {
          payload.wholesale_price = product.wholesale_price
        }
        if (isRetailStore && payload.retail_price === undefined) {
          payload.retail_price = targetPrice
        }
        if (!isRetailStore && payload.wholesale_price === undefined) {
          payload.wholesale_price = targetPrice
        }
        
        setProcessingOps(prev => ({ ...prev, [sku]: { type: 'pushing_price', storeKey: normalizedStore } }))
        setConfirmationModal(null)
        setDetailProduct(null)
        
        const backupRetail = product.backup_retail_price
        const backupWholesale = product.backup_wholesale_price
        
        apiService.pushProductUpdate(sku, payload, false)
          .then(res => {
            if (res.status === 'success' || res.status === 'partial_success') {
              toast.success(`${normalizedStore} price pushed to Shopify!`)
              setProducts(prev => prev.map(p => {
                if (p.sku === sku) {
                  return {
                    ...p,
                    backup_retail_price: backupRetail,
                    backup_wholesale_price: backupWholesale,
                    sync_status: { ...(p.sync_status || {}), price: false, wholesale: false }
                  }
                }
                return p
              }))
            } else {
              const detailMsg = res.message || (res.details ? JSON.stringify(res.details) : 'Push failed')
              toast.error('Sync failed: ' + detailMsg)
            }
          })
          .catch(err => {
            const errorMsg = err.response?.data?.detail || err.message || 'Unknown network error'
            toast.error('Push failed: ' + errorMsg)
          })
          .finally(() => {
            setProcessingOps(prev => { const n = { ...prev }; delete n[sku]; return n })
            fetchData(true)
          })
      }
    });
  };

  const handleRevert = (type = 'all', targetProd = null) => {
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
      onConfirm: () => {
        const sku = product.sku
        
        setProcessingOps(prev => ({ ...prev, [sku]: { type: 'reverting', storeKey: type } }))
        setConfirmationModal(null)
        setDetailProduct(null)
        setSelectedProduct(null)

        const apiCall = type === 'all'
          ? apiService.revertUpdate(sku, 'all')
          : apiService.pushProductUpdate(sku, (() => {
              const payload = {}
              if (type === 'title') payload.title = product.backup_title
              if (type === 'description') payload.description = product.backup_description
              if (type === 'meta_title') payload.meta_title = product.backup_meta_title
              if (type === 'meta_description') payload.meta_description = product.backup_meta_description
              return payload
            })(), true)

        apiCall
          .then(() => {
            toast.success(`Successfully reverted ${type === 'all' ? 'product' : type}`)
          })
          .catch(err => {
            toast.error('Failed to revert: ' + (err.response?.data?.detail || err.message))
          })
          .finally(() => {
            setProcessingOps(prev => { const n = { ...prev }; delete n[sku]; return n })
            fetchData(true)
          })
      }
    });
  }

  const handleRevertPrice = (product, storeKey = null) => {
    const normalizedStore = (storeKey || 'TDO').toUpperCase()
    const isRetailStore = normalizedStore === 'TDO'
    const currentPrice = product.store_prices?.[normalizedStore]?.price ?? (isRetailStore ? product.retail_price : product.wholesale_price)
    const restorePrice = isRetailStore ? product.backup_retail_price : product.backup_wholesale_price

    if (restorePrice === null || restorePrice === undefined) {
      toast.error(`No backup price found for ${normalizedStore}`)
      return
    }

    setConfirmationModal({
      title: `Revert ${normalizedStore} Price`,
      message: `Revert ${normalizedStore} price for ${product.sku} from ${formatMoney(currentPrice)} to ${formatMoney(restorePrice)}?`,
      confirmText: 'Revert Price',
      confirmClass: 'bg-rose-600 hover:bg-rose-700',
      onConfirm: () => {
        const sku = product.sku
        
        setProcessingOps(prev => ({ ...prev, [sku]: { type: 'reverting_price', storeKey: normalizedStore } }))
        setConfirmationModal(null)
        setDetailProduct(null)
        
        const backupRetail = product.backup_retail_price
        const backupWholesale = product.backup_wholesale_price
        
        apiService.revertUpdate(sku, 'price', normalizedStore)
          .then(resp => {
            toast.success(`${normalizedStore} price reverted to ${formatMoney(restorePrice)}`)
            setProducts(prev => prev.map(p => {
              if (p.sku === sku) {
                const nextStorePrices = p.store_prices?.[normalizedStore]
                  ? { ...p.store_prices, [normalizedStore]: { ...p.store_prices[normalizedStore], price: backupRetail } }
                  : p.store_prices
                return {
                  ...p,
                  retail_price: backupRetail ?? p.retail_price,
                  wholesale_price: backupWholesale ?? p.wholesale_price,
                  store_prices: nextStorePrices,
                  backup_retail_price: undefined,
                  backup_wholesale_price: undefined,
                  sync_status: { ...(p.sync_status || {}), price: false, wholesale: false }
                }
              }
              return p
            }))
          })
          .catch(err => {
            toast.error('Revert failed: ' + (err.response?.data?.detail || err.message))
          })
          .finally(() => {
            setProcessingOps(prev => { const n = { ...prev }; delete n[sku]; return n })
            fetchData(true)
          })
      }
    });
  };

  const savePrice = async () => {
    if (!editingPrice) return
    const { sku, value, field, store_key, id, stores } = editingPrice
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
      payload.stores = store_key ? [store_key] : (stores?.split(',').map(s => s.trim()) || ['TDO'])
      
      console.log('[savePrice] Submitting draft save to API:', { sku, payload });
      const res = await apiService.pushProductUpdate(sku, payload, true);
      console.log('[savePrice] API draft save success response:', res);
      
      toast.success(`Draft saved successfully for ${sku}`);
    } catch (err) {
      console.error('[savePrice] Price update API call failed:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown network error';
      toast.error(`Price draft failed to save: ${errorMsg}`);
      fetchData(true);
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

  // Keyboard navigation for detail modal
  useEffect(() => {
    if (!detailProduct) return
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return
      }
      const idx = filtered.findIndex(p => p.internal_id === detailProduct.internal_id)
      const prev = idx > 0 ? filtered[idx - 1] : null
      const next = idx < filtered.length - 1 ? filtered[idx + 1] : null
      if (e.key === 'Escape') setDetailProduct(null)
      if (e.key === 'ArrowLeft' && prev) setDetailProduct(prev)
      if (e.key === 'ArrowRight' && next) setDetailProduct(next)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [detailProduct, filtered])

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
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
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
                <tr
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ transform: 'translateZ(0)' }}
                  onClick={() => setDetailProduct(p)}
                >
                  <td className="p-5 text-center">
                    <ChevronRight
                      size={20}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(p.internal_id) }}
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
                        {processingOps[p.sku] && <RefreshCw size={14} className="animate-spin text-brand shrink-0" />}
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

                {expandedRows.has(p.internal_id) && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="p-4">
                      <ProductAnalyticsPanel p={p} />
                    </td>
                  </tr>
                )}
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

      {/* Detail modal */}
      {detailProduct && (() => {
        const liveProduct = filtered.find(p => p.internal_id === detailProduct.internal_id) || detailProduct
        const idx = filtered.findIndex(p => p.internal_id === liveProduct.internal_id)
        const prev = idx > 0 ? filtered[idx - 1] : null
        const next = idx < filtered.length - 1 ? filtered[idx + 1] : null
        return (
          <div
            className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center"
            onClick={() => setDetailProduct(null)}
          >
            <div
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-[95vw] max-w-[1200px] max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => prev && setDetailProduct(prev)}
                    disabled={!prev}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                  </button>
                  <span className="text-[0.85rem] font-bold text-slate-500">{idx + 1} / {filtered.length}</span>
                  <button
                    onClick={() => next && setDetailProduct(next)}
                    disabled={!next}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  onClick={() => setDetailProduct(null)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <ProductDetailContent
                p={liveProduct}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                activeStoreTabs={activeStoreTabs}
                setActiveStoreTabs={setActiveStoreTabs}
                editingPrice={editingPrice}
                setEditingPrice={setEditingPrice}
                activeTimeframe={activeTimeframe}
                setActiveTimeframe={setActiveTimeframe}
                addingTag={addingTag}
                setAddingTag={setAddingTag}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                setSelectedProduct={setSelectedProduct}
                setProposedFixes={setProposedFixes}
                setActiveIssue={setActiveIssue}
                handleTagUpdate={handleTagUpdate}
                handleTimeframeChange={handleTimeframeChange}
                handleRevertPrice={handleRevertPrice}
                handleRevert={handleRevert}
                pushToShopifyMerch={pushToShopifyMerch}
                savePrice={savePrice}
                setConfirmationModal={setConfirmationModal}
                getStatusBadge={getStatusBadge}
                pushingStyle={pushingStyle}
                pushPriceToShopify={pushPriceToShopify}
              />
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default MerchandisingReport
