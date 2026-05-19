import React, { useState, useEffect, useRef } from 'react'
import {
  Search, ChevronRight, Package,
  RefreshCw, Filter, Pencil, Check, ArrowUpRight, ChevronDown,
  Eye, TrendingUp, RotateCcw, Palette, Maximize,
  Tag, X, Flame, Plus
} from 'lucide-react'
import AuditDetailsModal from './AuditDetailsModal'
import Header from './Header'
import ConfirmationDialog from './common/ConfirmationDialog'
import KpiGrid from './merchandising/KpiGrid'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

const MerchandisingReport = ({ globalStats, initialMode }) => {
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(!globalStats)
  const [auditSearch, setAuditSearch] = useState('')
  const [merchSearch, setMerchSearch] = useState('')
  const [activeVendor, setActiveVendor] = useState(initialMode === 'MERCH' ? 'TDO_MERCH' : 'ALL')
  const [activeStoreFilter, setActiveStoreFilter] = useState('ALL')
  const [activeTimeframe, setActiveTimeframe] = useState('30')
  const [sortTimeframe, setSortTimeframe] = useState('none')
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [activeIssue, setActiveIssue] = useState(null)
  const [proposedFixes, setProposedFixes] = useState({})
  const [isFixing, setIsFixing] = useState(false)
  const [activeStoreFix, setActiveStoreFix] = useState('TDO')
  const [editingPrice, setEditingPrice] = useState(null)
  const [editingInventory, setEditingInventory] = useState(null)
  const [selectedColors, setSelectedColors] = useState({})
  const [addingTag, setAddingTag] = useState(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [breakdownTimeRanges, setBreakdownTimeRanges] = useState({})
  const [pushingStyle, setPushingStyle] = useState(null)
  const isMerchMode = activeVendor === 'TDO_MERCH'
  const vendorRef = useRef(null)
  const [vendorHeight, setVendorHeight] = useState(64)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50
  const [totalCount, setTotalCount] = useState(0)
  const [merchSort, setMerchSort] = useState('newest')
  const [merchTimeframe, setMerchTimeframe] = useState('90')
  const [isVendorMenuOpen, setIsVendorMenuOpen] = useState(false)
  const [confirmationModal, setConfirmationModal] = useState(null)
  const [isSyncingPrice, setIsSyncingPrice] = useState(false)
  const [isSyncingTags, setIsSyncingTags] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  const vendorMenuRef = useRef(null)

  useEffect(() => {
    if (globalStats) {
      const raw = globalStats.stats || globalStats
      setStats({
        total: raw.total_styles || 0,
        total_units: raw.total_inventory || 0,
        out_of_stock: raw.out_of_stock || 0,
        kos_missing: raw.kos_missing || 0,
        wdo_missing: raw.wdo_missing || 0,
        tdo_missing: raw.tdo_missing || 0,
        vendors: raw.vendors,
        store_health: raw.store_health,
      })
    }
  }, [globalStats])

  useEffect(() => {
    const updateHeight = () => {
      if (vendorRef.current) setVendorHeight(vendorRef.current.offsetHeight)
    }
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [stats])

  useEffect(() => {
    setCurrentPage(1)
    fetchData(false, activeVendor, 1)
  }, [activeVendor, auditSearch, merchSearch, activeStoreFilter])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vendorMenuRef.current && !vendorMenuRef.current.contains(event.target)) {
        setIsVendorMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData(true, activeVendor, 1)
    }, 400)
    return () => clearTimeout(delayDebounceFn)
  }, [auditSearch, merchSearch, activeStoreFilter])

  useEffect(() => {
    fetchData(true, activeVendor, currentPage)
  }, [currentPage, activeTimeframe, sortTimeframe, merchSort, merchTimeframe])

  const fetchData = async (silent = false, currentVendor = activeVendor, page = currentPage) => {
    if (!silent) setLoading(true)
    try {
      if (currentVendor === 'TDO_MERCH') {
        // --- TDO MERCHANDISE MODE (Port 8003) ---
        const [prodRes, statsRes] = await Promise.all([
          apiService.getMerchProducts({
            page,
            limit: itemsPerPage,
            search: merchSearch,
            vendor: 'ALL',
            sortBy:
              merchSort === 'high_views' ? 'pageviews_desc' :
                merchSort === 'high_sold' ? 'sell_thru_desc' :
                  merchSort === 'high_returns' ? 'return_rate_desc' : null,
            timeRange: merchTimeframe
          }),
          apiService.getMerchStats ? apiService.getMerchStats({
            vendor: 'ALL',
            search: merchSearch,
            timeRange: merchTimeframe
          }) : Promise.resolve({})
        ])

        const drafts = JSON.parse(localStorage.getItem('merch_tags_drafts') || '{}');
        const raw = prodRes.data || prodRes.products || []
        const mapped = raw.map(p => {
          const pid = p.internal_id || p.product_id || p.id;
          const draft = drafts[pid];
          return {
            ...p,
            sku: p.sku || p.style,
            main_image: p.main_image || p.image_url,
            internal_id: pid,
            tags_categorized: draft || p.tags_categorized || { top: [], bestseller: [], special: [], others: [] },
            needs_sync: draft ? true : (p.needs_sync || false),
            shopify_status: p.status ? p.status.toLowerCase() : 'unlinked',
          };
        })

        setProducts(prev => mapped.map(newP => {
          const existing = prev.find(ep => ep.internal_id === newP.internal_id);
          if (existing && (existing.localTimeframe || existing.sales_breakdown)) {
            return {
              ...newP,
              localTimeframe: existing.localTimeframe,
              sales_breakdown: existing.sales_breakdown,
              pageviews_details: existing.pageviews_details,
              sell_thru_details: existing.sell_thru_details,
              variants_merch: existing.variants_merch,
              units_sold_30_by_variant: existing.units_sold_30_by_variant,
              units_sold_60_by_variant: existing.units_sold_60_by_variant,
              units_sold_by_variant: existing.units_sold_by_variant
            };

          }
          return newP;
        }))
        setTotalCount(prodRes.total_count || 0)
        const mStats = statsRes.data || statsRes || {}
        setStats(prev => ({
          ...prev,
          total: mStats.total_styles || 0,
          total_units: mStats.total_inventory || 0,
          total_pageviews: mStats.total_pageviews || 0,
          total_sold_30: mStats.total_sold_30 || 0,
          total_sold_60: mStats.total_sold_60 || 0,
          total_sold_90: mStats.total_sold_90 || 0,
          out_of_stock: mStats.out_of_stock || 0,
          kos_missing: 0, wdo_missing: 0, tdo_missing: 0, im_missing: 0,
          vendors: mStats.vendors || prev?.vendors || [],
          store_health: mStats.store_health || prev?.store_health || {}
        }))
      } else {
        const vendorQuery = currentVendor === 'ALL' ? '' : currentVendor
        const [prodRes, statsRes] = await Promise.all([
          apiService.getProducts(
            vendorQuery,
            page,
            itemsPerPage,
            auditSearch,
            sortTimeframe !== 'none' ? sortTimeframe : activeTimeframe,
            sortTimeframe !== 'none' ? 'sales' : null,
            activeStoreFilter
          ),
          apiService.getDashboardStats(vendorQuery, auditSearch)
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
            ;['TDO', 'WDO', 'KOS', 'IM'].forEach(s => {
              // Try both uppercase and lowercase keys for maximum compatibility
              const store = p.store_prices?.[s] || p.store_prices?.[s.toLowerCase()]
              const isLinked = store?.linked || p[`${s.toLowerCase()}_product_id`]

              if (isLinked) {
                const status = store?.status?.toUpperCase() || p[`${s.toLowerCase()}_status`]?.toUpperCase() || 'DRAFT'
                storeHealth[s] = status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'
              } else {
                storeHealth[s] = 'MISSING'
              }
            })

          return {
            ...p,
            sku: p.style,
            main_image: p.image_url,
            stores: ['TDO', 'WDO', 'KOS', 'IM'].filter(s =>
              p.store_prices?.[s]?.linked ||
              p.store_prices?.[s.toLowerCase()]?.linked ||
              p[`${s.toLowerCase()}_product_id`]
            ).join(','),
            store_health: storeHealth,
            retail_price: p.staged_price,
            shopify_status: (
              (p.store_prices?.TDO || p.store_prices?.tdo)?.status?.toUpperCase() === 'ACTIVE' ||
              (p.store_prices?.WDO || p.store_prices?.wdo)?.status?.toUpperCase() === 'ACTIVE' ||
              (p.store_prices?.KOS || p.store_prices?.kos)?.status?.toUpperCase() === 'ACTIVE' ||
              (p.store_prices?.IM || p.store_prices?.im)?.status?.toUpperCase() === 'ACTIVE'
            ) ? 'active' : 'draft',
            live_retail_price: (p.store_prices?.TDO || p.store_prices?.tdo)?.price || (p.store_prices?.IM || p.store_prices?.im)?.price || (p.store_prices?.WDO || p.store_prices?.wdo)?.price,
            live_wholesale_price: (p.store_prices?.WDO || p.store_prices?.wdo)?.price || (p.store_prices?.IM || p.store_prices?.im)?.price,
            variants: Object.entries(parseSizes(p.staged_sizes)).map(([size, inventory]) => ({ size, inventory })),
            tdo_link: p.admin_links?.tdo,
            wdo_link: p.admin_links?.wdo,
            kos_link: p.admin_links?.kos,
            im_link: p.admin_links?.im,
          }
        })
        setProducts(prev => mapped.map(newP => {
          const existing = prev.find(ep => ep.internal_id === newP.internal_id);
          if (existing && existing.localTimeframe) {
            return {
              ...newP,
              localTimeframe: existing.localTimeframe,
              sales_breakdown: existing.sales_breakdown,
              pageviews_details: existing.pageviews_details,
              sell_thru_details: existing.sell_thru_details,
              variants_merch: existing.variants_merch,
              units_sold_30_by_variant: existing.units_sold_30_by_variant,
              units_sold_60_by_variant: existing.units_sold_60_by_variant,
              units_sold_by_variant: existing.units_sold_by_variant,
              pageviews: existing.pageviews,
              sell_thru: existing.sell_thru,
              most_sold_color: existing.most_sold_color,
              most_sold_size: existing.most_sold_size
            };
          }
          return newP;
        }))
        const raw = statsRes.stats || statsRes
        setStats({
          total: raw.total_styles || 0,
          total_units: raw.total_inventory || 0,
          out_of_stock: raw.out_of_stock || 0,
          kos_missing: raw.kos_missing || 0,
          wdo_missing: raw.wdo_missing || 0,
          tdo_missing: raw.tdo_missing || 0,
          im_missing: raw.im_missing || 0,
          vendors: raw.vendors,
          store_health: raw.store_health,
        })
      }
    } catch (err) {
      console.error('API Error:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) newExpanded.delete(id)
    else newExpanded.add(id)
    setExpandedRows(newExpanded)
  }

  const handleProposeFix = async (rule, store = null) => {
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

  const handleQuickPush = async (product) => {
    const hasInventoryChanges = product.is_dirty_inventory
    const hasPriceChanges = product.is_dirty_price || product.retail_price !== product.live_retail_price
    if (!hasInventoryChanges && !hasPriceChanges) {
      toast('No changes detected. Price and Stock are already in sync.', { icon: 'ℹ️' })
      return
    }
    const changeType = hasPriceChanges && hasInventoryChanges ? 'Price and Stock' : hasPriceChanges ? 'Price' : 'Stock Inventory'

    setConfirmationModal({
      title: `Push ${changeType} Updates`,
      message: `Are you sure you want to push ${changeType} changes for ${product.sku} to LIVE Shopify?`,
      confirmText: 'Sync Now',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: async () => {
        setIsSyncingPrice(true);
        try {
          const payload = { skip_content: true, stores: product.stores?.split(',').map(s => s.trim()) || ['TDO'] }
          if (hasPriceChanges) { payload.retail_price = product.retail_price; payload.wholesale_price = product.wholesale_price }
          if (hasInventoryChanges) payload.sizes = product.variants.reduce((acc, v) => ({ ...acc, [v.size]: v.inventory }), {})

          const result = await apiService.pushProductUpdate(product.sku, payload, false)
          if (result.status === 'failed') {
            toast.error('Quick Push Failed: ' + (result.message || result.summary || 'Unknown backend error'));
            return
          }
          toast.success(`${changeType} pushed to Shopify successfully!`)
          setProducts(prev => prev.map(p => p.internal_id === product.internal_id ? { ...p, sync_status: { title: false, description: false, price: false, wholesale: false }, is_dirty_inventory: false, backup_title: p.title } : p))
          setConfirmationModal(null);
        } catch (err) {
          console.error('Quick push failed:', err)
          toast.error('Failed to push: ' + (err.response?.data?.detail || err.message))
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
    const drafts = JSON.parse(localStorage.getItem('merch_tags_drafts') || '{}');
    drafts[productId] = currentTags;
    localStorage.setItem('merch_tags_drafts', JSON.stringify(drafts));

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
            const drafts = JSON.parse(localStorage.getItem('merch_tags_drafts') || '{}');
            delete drafts[product.internal_id || product.product_id];
            localStorage.setItem('merch_tags_drafts', JSON.stringify(drafts));
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
          toast.error('Push failed');
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
          toast.error('Push failed');
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

  const saveInventory = async () => {
    if (!editingInventory) return
    const { style, size, value, product_id } = editingInventory
    const newQty = parseInt(value)
    setProducts(prev => prev.map(p => {
      if (p.product_id === product_id) {
        const updatedVariants = p.variants?.map(v => v.size === size ? { ...v, inventory: newQty } : v) || []
        const newTotal = updatedVariants.reduce((sum, v) => sum + (v.inventory || 0), 0)
        const originalQty = p.live_inventory?.[size] ?? 0
        return { ...p, variants: updatedVariants, total_inventory: newTotal, is_dirty_inventory: newQty !== originalQty }
      }
      return p
    }))
    setEditingInventory(null)
    try {
      await apiService.adjustInventory(style, { [size]: newQty }, true, true)
    } catch (err) {
      console.error('Inventory update failed:', err)
      fetchData(true)
    }
  }

  const savePrice = async () => {
    if (!editingPrice) return
    const { sku, product_id, value, field } = editingPrice
    const newVal = parseFloat(value)
    setProducts(prev => prev.map(p => {
      if (p.product_id === product_id) {
        const isRetailDirty = field === 'retail' ? newVal !== p.live_retail_price : p.sync_status?.price
        const isWholesaleDirty = field === 'wholesale' ? newVal !== p.live_wholesale_price : p.sync_status?.wholesale
        return { ...p, retail_price: field === 'retail' ? newVal : p.retail_price, wholesale_price: field === 'wholesale' ? newVal : p.wholesale_price, sync_status: { ...(p.sync_status || {}), price: isRetailDirty, wholesale: isWholesaleDirty } }
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
      if (isMerchMode) {
        // In Merch Mode, we should refetch from the Merch API to get consistent 'notes' data
        const res = await apiService.getMerchProducts({ search: sku, timeRange: timeframe, limit: 1 });
        if (res.data && res.data.length > 0) {
          const newData = res.data[0];
          setProducts(prev => prev.map(p => {
            if (p.internal_id === internalId) {
              return {
                ...p,
                ...newData,
                localTimeframe: timeframe
              };
            }
            return p;
          }));
        }
      } else {
        // Audit Mode (legacy behavior)
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
      }
    } catch (err) {
      console.error('Failed to update timeframe:', err);
    }
  }




  const getHealthPill = (status) => {
    if (status === 'MISSING') return (
      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider border border-red-100 flex items-center justify-center gap-1 w-fit mx-auto">
        <span className="w-1 h-1 rounded-full bg-red-400" />
        MISSING
      </span>
    )
    if (status === 'DRAFT') return (
      <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider border border-amber-100 flex items-center justify-center gap-1 w-fit mx-auto">
        <span className="w-1 h-1 rounded-full bg-amber-400" />
        DRAFT
      </span>
    )
    if (status === 'ACTIVE') return (
      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider border border-emerald-100 flex items-center justify-center gap-1 w-fit mx-auto">
        <span className="w-1 h-1 rounded-full bg-emerald-500" />
        ACTIVE
      </span>
    )
    return (
      <span className="bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase border border-slate-100 flex items-center justify-center gap-1 w-fit mx-auto">
        UNKNOWN
      </span>
    )
  }


  // remove ACTIVE

  const getStatusBadge = (status, hideActive = false) => {
    const s = status?.toLowerCase() || 'draft'
    if (s === 'active') {
      if (hideActive) return null;
      return (
        <span className="bg-[#f0fdf4] text-[#166534] px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider border border-[#dcfce7] flex items-center gap-1.5 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          active
        </span>
      )
    }
    return (
      <span className="bg-[#f8fafc] text-[#64748b] px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider border border-[#f1f5f9] flex items-center gap-1.5 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]" />
        draft
      </span>
    )
  }

  // Removed top-level loading check to allow localized loading in the table body

  const filtered = products.filter(p => {
    if (activeStoreFilter === 'ALL') return true;
    return p.store_health?.[activeStoreFilter] !== 'MISSING';
  })
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const currentItems = filtered

  return (
    <div className="audit-dashboard-content">
      {/* Header */}
      <Header
        title={isMerchMode ? "MERCHANDISING ANALYTICS" : "PRODUCT INTELLIGENCE"}
        search={isMerchMode ? merchSearch : auditSearch}
        setSearch={isMerchMode ? setMerchSearch : setAuditSearch}
        activeStoreFilter={activeStoreFilter}
        setActiveStoreFilter={setActiveStoreFilter}
        timeRange={merchTimeframe}
        setTimeRange={setMerchTimeframe}
        showTimeRange={isMerchMode}
        showStoreFilter={!isMerchMode}
      />

      <KpiGrid isMerchMode={isMerchMode} merchTimeframe={merchTimeframe} stats={stats} />

      {/* Vendor Filter Bar */}
      <div ref={vendorRef} className="bg-white/95 backdrop-blur-md sticky top-[81px] z-[900] -mx-8 px-8 py-4 flex items-center gap-4 border-b border-slate-200/60 shadow-sm mb-6">
        {/* Product Intelligence Button */}
        <button
          onClick={() => setActiveVendor('ALL')}
          className={`px-6 py-2.5 rounded-full text-[0.8rem] font-black transition-all flex items-center gap-2.5 shadow-sm border ${!isMerchMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200/50 scale-105' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:scale-105'}`}
        >
          <Search size={16} /> PRODUCT <span className="opacity-70 ml-1.5 text-[0.7rem] font-bold">INTELLIGENCE</span>
        </button>

        {/* Standalone Merch Button */}
        <button
          onClick={() => setActiveVendor('TDO_MERCH')}
          className={`px-6 py-2.5 rounded-full text-[0.8rem] font-black transition-all flex items-center gap-2.5 shadow-sm border ${isMerchMode ? 'bg-brand text-white border-brand shadow-brand/20 scale-105' : 'bg-white text-brand border-indigo-100 hover:bg-indigo-50 hover:scale-105'}`}
        >
          <TrendingUp size={16} /> MERCHANDISING <span className="opacity-70 ml-1.5 text-[0.7rem] font-bold">ANALYTICS</span>
        </button>

        {/* Conditional Filters */}
        {isMerchMode ? (
          <div className="flex items-center gap-3 ml-2 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={merchSort}
                onChange={(e) => setMerchSort(e.target.value)}
                className="appearance-none bg-white border border-slate-200 pl-4 pr-10 py-2.5 rounded-2xl text-[0.8rem] font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm min-w-[160px]"
              >
                <option value="newest">Sort: Newest</option>
                <option value="high_views">High Page Views</option>
                <option value="high_sold">High Units Sold</option>
                <option value="high_returns">High Return Rate</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Timeframe Dropdown */}
            <div className="relative">
              <select
                value={merchTimeframe}
                onChange={(e) => setMerchTimeframe(e.target.value)}
                className="appearance-none bg-white border border-slate-200 pl-4 pr-10 py-2.5 rounded-2xl text-[0.8rem] font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
              >
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 ml-2 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="w-[1px] h-8 bg-slate-100 mx-1" />
            {/* Vendor Dropdown */}
            <div className="relative" ref={vendorMenuRef}>
              <button
                onClick={() => setIsVendorMenuOpen(!isVendorMenuOpen)}
                className="flex items-center gap-3 px-6 py-2.5 rounded-full text-[0.85rem] font-bold border border-slate-200 bg-white text-slate-700 hover:border-slate-300 transition-all min-w-[220px] justify-between shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Filter size={14} />
                  </div>
                  <span className="truncate">
                    {activeVendor === 'ALL' ? 'All Vendors' : activeVendor}
                  </span>
                </div>
                <ChevronDown size={16} className={`transition-transform duration-300 ${isVendorMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isVendorMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[999]">
                  <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <div className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest px-3">Filter by Brand</div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                    <button
                      onClick={() => { setActiveVendor('ALL'); setIsVendorMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-[0.85rem] font-bold flex items-center justify-between transition-all ${activeVendor === 'ALL' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[0.7rem] font-black">A</div>
                        All Vendors
                      </div>
                      <span className="text-[0.7rem] opacity-50">{stats?.vendors?.reduce((sum, v) => sum + (v.style_count || 0), 0) || 0}</span>
                    </button>

                    {stats?.vendors?.filter(v => (v.name || v.vendor) === 'The Dress Outlet').map(v => (
                      <button
                        key={v.name || v.vendor}
                        onClick={() => { setActiveVendor(v.name || v.vendor); setIsVendorMenuOpen(false); }}
                        className={`w-full text-left px-4 py-3 rounded-2xl text-[0.85rem] font-bold flex items-center justify-between transition-all mt-1 ${activeVendor === (v.name || v.vendor) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[0.7rem] font-black">T</div>
                          {v.name || v.vendor}
                        </div>
                        <span className="text-[0.7rem] opacity-50">{v.style_count}</span>
                      </button>
                    ))}

                    <div className="h-px bg-slate-100 my-2 mx-4" />

                    {stats?.vendors?.filter(v => (v.name || v.vendor) !== 'The Dress Outlet').map(v => (
                      <button
                        key={v.name || v.vendor}
                        onClick={() => { setActiveVendor(v.name || v.vendor); setIsVendorMenuOpen(false); }}
                        className={`w-full text-left px-4 py-3 rounded-2xl text-[0.85rem] font-bold flex items-center justify-between transition-all mt-1 ${activeVendor === (v.name || v.vendor) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[0.7rem] font-black">
                            {(v.name || v.vendor || 'V').charAt(0)}
                          </div>
                          {v.name || v.vendor}
                        </div>
                        <span className="text-[0.7rem] opacity-50">{v.style_count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {isMerchMode ? (
              <tr className="bg-slate-50">
                <th className="p-4 w-[50px] border-b border-slate-200" />
                <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[80px]">ASSET</th>
                <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider min-w-[200px]">STYLE / PRODUCT</th>
                <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[120px]">VENDOR</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[100px]">STATUS</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[120px]">INVENTORY</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">VIEWS (30/60/90)</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">SOLD (30/60/90)</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[160px]">RETURNS (30/60/90)</th>
              </tr>
            ) : (
              <tr className="bg-slate-50">
                <th className="p-4 w-[50px] border-b border-slate-200" />
                <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[80px]">ASSET</th>
                <th className="p-4 text-left text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider min-w-[250px]">STYLE / PRODUCT</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[100px]">RETAIL PRICE</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-widest w-[130px]">Total Stock</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-blue-800 bg-blue-50 border-b border-slate-200 uppercase tracking-wider w-[100px]">TDO</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-amber-800 bg-amber-50 border-b border-slate-200 uppercase tracking-wider w-[100px]">WDO</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-red-800 bg-red-50 border-b border-slate-200 uppercase tracking-wider w-[100px]">KOS</th>
                <th className="p-4 text-center text-[0.75rem] font-extrabold text-violet-800 bg-violet-50 border-b border-slate-200 uppercase tracking-wider w-[100px]">IM</th>
                <th className="p-4 text-right text-[0.75rem] font-extrabold text-slate-500 border-b border-slate-200 uppercase tracking-wider w-[140px]">ACTIONS</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isMerchMode ? 9 : 10} className="p-32 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-brand" size={40} />
                    <div className="text-slate-400 font-extrabold text-sm uppercase tracking-widest">Updating Catalog View...</div>
                  </div>
                </td>
              </tr>
            ) : currentItems.map(p => (
              <React.Fragment key={p.internal_id}>
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
                        {isMerchMode ? (
                          (p.top_tags?.length > 0) && (
                            <Tag size={16} className="text-brand opacity-60" />
                          )
                        ) : getStatusBadge(p.shopify_status, true)}
                        {isMerchMode && (p.sync_status?.tags || p.needs_sync) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); pushToShopifyMerch(p); }}
                            disabled={pushingStyle === p.sku}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6rem] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all w-fit cursor-pointer ml-2"
                          >
                            {pushingStyle === p.sku ? <RefreshCw size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                            PUSH
                          </button>
                        )}
                      </div>
                      <div className="text-[0.7rem] text-slate-400 font-bold truncate max-w-[200px]" title={p.title}>{p.title}</div>
                    </div>
                  </td>

                  {isMerchMode && (
                    <>
                      <td className="p-5">
                        <div className="text-[0.8rem] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[120px]" title={p.vendor}>
                          {p.vendor || 'Unknown'}
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        {getStatusBadge(p.shopify_status)}
                      </td>
                    </>
                  )}

                  {isMerchMode ? (
                    <>
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className={`px-3 py-1.5 rounded-xl text-[0.9rem] font-black tracking-tight flex items-center gap-2 border shadow-sm transition-all ${p.total_inventory <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50' : p.total_inventory < 5 ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50'}`}>
                            <Package size={14} className="opacity-70" />
                            {p.total_inventory}
                          </div>
                        </div>
                      </td>
                      {/* space added between */}
                      <td className="p-5 text-center">
                        <div className="flex justify-center gap-10">
                          <span className={`text-[0.8rem] ${merchTimeframe === '30' ? 'text-indigo-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.pageviews?.days_30 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '60' ? 'text-indigo-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.pageviews?.days_60 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '90' ? 'text-indigo-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.pageviews?.days_90 || 0).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex justify-center gap-10">
                          <span className={`text-[0.8rem] ${merchTimeframe === '30' ? 'text-emerald-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.units_sold?.days_30 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '60' ? 'text-emerald-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.units_sold?.days_60 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '90' ? 'text-emerald-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.units_sold?.days_90 || 0).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex justify-center gap-3">
                          <span className={`text-[0.8rem] ${merchTimeframe === '30' ? 'text-rose-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.returns?.days_30 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '60' ? 'text-rose-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.returns?.days_60 || 0).toLocaleString()}</span>
                          <span className={`text-[0.8rem] ${merchTimeframe === '90' ? 'text-rose-600 font-black scale-105' : 'text-slate-500 font-bold opacity-60'}`}>{(p.returns?.days_90 || 0).toLocaleString()}</span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-5 text-center relative group">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {/* Push Icon - Visible only when price is actually different from live */}
                          {p.sync_status?.price && (
                            <button
                              onClick={(e) => { e.stopPropagation(); pushPriceToShopify(p); }}
                              className="p-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100 cursor-pointer"
                              title="Push Price to Shopify"
                            >
                              <RefreshCw size={10} />
                            </button>
                          )}

                          {/* Revert Icon - Enabled ONLY after a push has occurred */}
                          <button
                            disabled={!p.has_pushed_price}
                            onClick={(e) => { e.stopPropagation(); handleRevertPrice(p); }}
                            className={`p-1 rounded-md transition-all shadow-sm border ${p.has_pushed_price ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white cursor-pointer' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50'}`}
                            title={p.has_pushed_price ? "Undo last Shopify push" : "No push to revert"}
                          >
                            <RotateCcw size={10} />
                          </button>
                        </div>

                        {/* edit price */}
                        {editingPrice?.id === p.internal_id && editingPrice?.field === 'retail' ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              autoFocus
                              type="number"
                              value={editingPrice.value}
                              onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') savePrice(); if (e.key === 'Escape') setEditingPrice(null); }}
                              onBlur={savePrice}
                              className="w-[110px] text-[0.85rem] font-black border-2 border-indigo-500 rounded-lg px-2 py-1 outline-none shadow-sm"
                            />
                            <Check size={16} className="text-emerald-500 cursor-pointer hover:scale-110 transition-transform" onClick={savePrice} />
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingPrice({ id: p.internal_id, sku: p.sku, field: 'retail', value: p.retail_price, product_id: p.product_id })}
                            className={`text-[0.9rem] font-black cursor-pointer hover:bg-slate-50 py-1 rounded transition-all ${p.sync_status?.price ? 'text-amber-600' : 'text-slate-700 hover:text-indigo-600'}`}
                          >
                            ${p.retail_price}
                          </div>
                        )}
                        {p.sync_status?.tags && (
                          <button
                            onClick={(e) => { e.stopPropagation(); pushToShopifyMerch(p); }}
                            disabled={pushingStyle === p.sku}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6rem] font-black uppercase tracking-wider bg-brand text-white shadow-md hover:bg-brand/90 transition-all mx-auto"
                          >
                            {pushingStyle === p.sku ? <RefreshCw size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                            Push
                          </button>
                        )}
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className={`px-3 py-1.5 rounded-xl text-[0.9rem] font-black tracking-tight flex items-center gap-2 border shadow-sm transition-all ${p.total_inventory <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/50' : p.total_inventory < 5 ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/50'}`}>
                            <Package size={14} className="opacity-70" />
                            {p.total_inventory}
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center bg-blue-50/10">{getHealthPill(p.store_health?.TDO)}</td>
                      <td className="p-5 text-center bg-amber-50/10">{getHealthPill(p.store_health?.WDO)}</td>
                      <td className="p-5 text-center bg-red-50/10">{getHealthPill(p.store_health?.KOS)}</td>
                      <td className="p-5 text-center bg-violet-50/10">{getHealthPill(p.store_health?.IM)}</td>
                    </>
                  )}
                  {!isMerchMode && (
                    <td className="p-5 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedProduct(p)
                            setProposedFixes({ title: p.local_title || null, description: p.local_description || null, meta_title: p.local_meta_title || null, meta_description: p.local_meta_description || null })
                            setActiveIssue(null)
                          }}
                          className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[0.85rem] font-extrabold text-brand cursor-pointer transition-all hover:border-brand hover:shadow-md"
                        >
                          Notes Hub
                        </button>
                      </div>
                    </td>
                  )}
                </tr>

                {expandedRows.has(p.internal_id) && (() => {
                  const activeColor = selectedColors[p.internal_id] || (p.color_variants ? Object.keys(p.color_variants)[0] : null);
                  const activeVariants = p.color_variants && Object.keys(p.color_variants).length > 0 ? Object.entries(p.color_variants[activeColor] || {}).map(([size, inv]) => ({ size, inventory: inv })) : p.variants;
                  const displayTotalStock = p.color_totals && Object.keys(p.color_totals).length > 0 ? (p.color_totals[activeColor] || 0) : p.total_inventory;

                  // --- FUTURE: COLOR IMAGE SWITCHING (Commented out until image_id is implemented) ---
                  /* 
                  let activeImage = "https://placehold.co/400x600/f8fafc/94a3b8?text=No+Image+Found";
                  if (activeColor && p.all_images) {
                    const cleanColor = activeColor.trim().toLowerCase();
                    const colorMatch = p.all_images.find(img => {
                        const altClean = (img.alt || '').toLowerCase();
                        if (altClean.includes(cleanColor)) return true;
                        if (cleanColor.includes('/')) {
                            const parts = cleanColor.split('/').map(part => part.trim());
                            return parts.every(part => altClean.includes(part));
                        }
                        return false;
                    });
                    if (colorMatch) {
                        activeImage = colorMatch.url;
                    } else if (p.main_image && (!activeColor || activeColor === "Default")) {
                        activeImage = p.main_image;
                    }
                  } else if (p.main_image) {
                      activeImage = p.main_image;
                  } 
                  */
                  // ----------------------------------------------------------------------------------

                  if (isMerchMode) {
                    const colors = [...new Set(p.variants?.map(v => v.color) || [])];
                    const activeColor = selectedColors[p.internal_id] || colors[0];
                    const activeVariants = p.variants?.filter(v => v.color === activeColor) || [];
                    const breakdownRange = breakdownTimeRanges[p.internal_id] || '90';

                    // Pre-calculate color metrics for the buttons
                    const colorMetrics = colors.reduce((acc, c) => {
                      const vars = p.variants?.filter(v => v.color === c) || [];
                      acc[c] = {
                        inv: vars.reduce((sum, v) => sum + (v.inventory || 0), 0),
                        sold: vars.reduce((sum, v) => {
                          const vKey = `${c?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
                          if (breakdownRange === '30') return sum + (p.units_sold_30_by_variant?.[vKey] || 0);
                          if (breakdownRange === '60') return sum + (p.units_sold_60_by_variant?.[vKey] || 0);
                          return sum + (p.units_sold_by_variant?.[vKey] || 0);
                        }, 0)
                      };
                      return acc;
                    }, {});

                    return (
                      <tr className="bg-slate-50">
                        <td colSpan={isMerchMode ? 9 : 10} className="p-4">
                          <div className="bg-white rounded-[1.5rem] border border-slate-200 p-6 grid gap-8 shadow-lg" style={{ gridTemplateColumns: '260px 1fr' }}>
                            {/* LEFT COLUMN: IMAGE */}
                            <div className="text-center">
                              <div className="rounded-[1.5rem] shadow-xl overflow-hidden bg-slate-100 aspect-[2/3] border border-slate-100/50">
                                <img
                                  src={p.main_image}
                                  alt="expanded"
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-opacity duration-500 opacity-0"
                                  onLoad={(e) => e.target.classList.remove('opacity-0')}
                                />
                              </div>
                            </div>

                            {/* RIGHT COLUMN: DETAILS */}
                            <div className="min-w-0">
                              {/* HEADER AREA */}
                              <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter m-0">{p.style}</h3>
                                </div>

                              </div>

                              {/* TAGS MANAGEMENT CARD */}
                              <div className="mb-6 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 p-6 transition-all hover:bg-slate-50">
                                <div className="text-[0.65rem] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100">
                                      <Tag size={14} className="text-slate-400" />
                                    </div>
                                    TAGS MANAGEMENT
                                  </div>
                                  {(p.sync_status?.tags || p.needs_sync) && (
                                    <button
                                      onClick={() => pushToShopifyMerch(p)}
                                      disabled={pushingStyle === p.sku}
                                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[0.7rem] font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                    >
                                      {pushingStyle === p.sku ? <RefreshCw size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                                      PUSH
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  <div>
                                    <div className="flex items-center gap-3 mb-4">
                                      <span className="text-[0.65rem] font-black text-indigo-600 uppercase tracking-[0.15em] bg-indigo-50 px-3 py-1 rounded-lg">Top Tags</span>
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
                                          className="text-[0.7rem] px-2 py-1 rounded-lg border-2 border-indigo-200 outline-none w-24"
                                          placeholder="..."
                                        />
                                      ) : (
                                        <button onClick={() => { setAddingTag({ product_id: p.internal_id, category: 'top' }); setNewTagInput(''); }} className="text-indigo-300 hover:text-indigo-600 transition-colors"><Plus size={16} /></button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {p.tags_categorized?.top?.map((tag, idx) => (
                                        <span key={idx} className="group relative inline-flex items-center gap-2 text-[0.7rem] font-black px-3 py-1.5 rounded-xl bg-white border border-indigo-100 text-indigo-700 shadow-sm transition-all hover:border-indigo-300">
                                          {tag}
                                          <button onClick={() => handleTagUpdate(p.internal_id, 'top', 'remove', tag)} className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-rose-500 transition-all"><X size={14} /></button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-3 mb-4">
                                      <span className="text-[0.65rem] font-black text-amber-600 uppercase tracking-[0.15em] bg-amber-50 px-3 py-1 rounded-lg flex items-center gap-1.5"><Flame size={12} /> Bestseller</span>
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
                                          className="text-[0.7rem] px-2 py-1 rounded-lg border-2 border-amber-200 outline-none w-24"
                                          placeholder="..."
                                        />
                                      ) : (
                                        <button onClick={() => { setAddingTag({ product_id: p.internal_id, category: 'bestseller' }); setNewTagInput(''); }} className="text-amber-300 hover:text-amber-600 transition-colors"><Plus size={16} /></button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {p.tags_categorized?.bestseller?.map((tag, idx) => (
                                        <span key={idx} className="group relative inline-flex items-center gap-2 text-[0.7rem] font-black px-3 py-1.5 rounded-xl bg-white border border-amber-100 text-amber-700 shadow-sm transition-all hover:border-amber-300">
                                          {tag}
                                          <button onClick={() => handleTagUpdate(p.internal_id, 'bestseller', 'remove', tag)} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-rose-500 transition-all"><X size={14} /></button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[0.65rem] font-black text-rose-500 uppercase tracking-[0.15em] bg-rose-50 px-3 py-1 rounded-lg w-fit mb-4">Special Tags</div>
                                    <div className="flex flex-wrap gap-2">
                                      {["No PROM", "No Formal", "Discontinued", "Push PROM"].map(tag => {
                                        const isActive = p.tags_categorized?.special?.includes(tag);
                                        return (
                                          <button
                                            key={tag}
                                            onClick={() => handleTagUpdate(p.internal_id, 'special', isActive ? 'remove' : 'add', tag)}
                                            className={`text-[0.65rem] font-black px-3 py-1.5 rounded-xl border-2 transition-all ${isActive ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-white border-slate-100 text-slate-400 hover:border-rose-200 hover:text-rose-600'}`}
                                          >
                                            {tag}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-4 mb-6 items-stretch">
                                <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-[1.2rem] flex flex-col justify-center min-w-[140px] hover:shadow-md transition-all">
                                  <div className="text-[0.55rem] font-black text-emerald-600/60 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
                                    <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                                    RETAIL PRICE
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-black text-emerald-700">${p.retail_price}</span>
                                    {p.sync_status?.price && <span className="text-[0.5rem] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md uppercase border border-emerald-200">Staged</span>}
                                  </div>
                                </div>

                                <div className="bg-rose-50/40 border border-rose-100 p-4 rounded-[1.2rem] flex flex-col justify-center min-w-[140px] hover:shadow-md transition-all">
                                  <div className="text-[0.55rem] font-black text-rose-600/60 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
                                    <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                                    TOTAL STOCK
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-black text-rose-700">{p.total_inventory} Units</span>
                                  </div>
                                </div>

                                <div className="flex-1 bg-slate-50/30 border border-slate-100 p-4 rounded-[1.2rem] min-w-[280px]">
                                  <div className="text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.1em] mb-3">AVAILABLE COLORS</div>
                                  <div className="flex flex-wrap gap-2">
                                    {colors.map(color => {
                                      const hasInv = colorMetrics[color].inv > 0;
                                      const isActive = activeColor === color;

                                      return (
                                        <button
                                          key={color}
                                          onClick={() => setSelectedColors(prev => ({ ...prev, [p.internal_id]: color }))}
                                          className={`px-3 py-1.5 rounded-lg text-[0.7rem] font-black transition-all shadow-sm border flex items-center gap-2.5 
                                            ${isActive
                                              ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                                              : hasInv
                                                ? 'bg-pink-50 text-pink-600 border-pink-100 hover:border-pink-300'
                                                : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'}`}
                                        >
                                          <span className="uppercase tracking-tight">{color}</span>
                                          <div className={`flex items-center gap-2 border-l pl-2 ${isActive ? 'border-white/20' : hasInv ? 'border-pink-200' : 'border-slate-100'}`}>
                                            <span className={`text-[0.6rem] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{colorMetrics[color].inv}</span>
                                            <span className={`text-[0.6rem] font-black ${isActive ? 'text-white' : hasInv ? 'text-pink-600' : 'text-amber-500'}`}>{colorMetrics[color].sold}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* SIZES DISTRIBUTION - WITH TIMEFRAME */}
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="text-[0.65rem] font-black text-slate-800 uppercase tracking-[0.15em]">Inventory & Sales Breakdown</div>
                                  <div className="flex gap-1.5">
                                    {['30', '60', '90'].map(range => (
                                      <button
                                        key={range}
                                        onClick={() => setBreakdownTimeRanges(prev => ({ ...prev, [p.internal_id]: range }))}
                                        className={`px-2.5 py-1 rounded-lg text-[0.6rem] font-black transition-all border ${breakdownRange === range ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                      >
                                        {range}D
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="overflow-x-auto pb-2 custom-scrollbar">
                                  <div className="inline-flex border border-slate-200 rounded-[1rem] overflow-hidden shadow-md" style={{ transform: 'translateZ(0)' }}>
                                    {activeVariants.map((v, idx) => (
                                      <div key={idx} className="flex flex-col min-w-[85px] border-r border-slate-100 last:border-0" style={{ transform: 'translateZ(0)' }}>
                                        <div className="p-3 text-center text-[0.6rem] font-black uppercase border-b border-slate-100 bg-slate-50 text-slate-400">{v.size}</div>
                                        <div className="bg-white p-4 flex items-center justify-center border-b border-slate-50">
                                          <span className="text-xl font-black text-slate-900">{v.inventory}</span>
                                        </div>
                                        <div className="bg-amber-50/20 p-3 text-center">
                                          <span className="text-lg font-black text-amber-700">
                                            {(() => {
                                              const vKey = `${activeColor?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
                                              if (breakdownRange === '30') return p.units_sold_30_by_variant?.[vKey] || 0;
                                              if (breakdownRange === '60') return p.units_sold_60_by_variant?.[vKey] || 0;
                                              return p.units_sold_by_variant?.[vKey] || 0;
                                            })()}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {p.admin_link && (
                                  <div className="mt-4 flex justify-start">
                                    <a
                                      href={p.admin_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[0.7rem] font-black hover:bg-slate-800 transition-all shadow-md shadow-slate-200 uppercase tracking-wider"
                                    >
                                      <ArrowUpRight size={14} />
                                      Shopify Admin
                                    </a>
                                  </div>
                                )}

                                {/* TDO Analytics (Consistency for Audit Mode) */}
                                {p.vendor === 'The Dress Outlet' && !isMerchMode && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-10 border-t border-slate-100 pt-10">
                                    <div className="bg-indigo-50 p-5 rounded-[18px] border border-indigo-200 flex items-center gap-4">
                                      <div className="bg-indigo-500 text-white p-2.5 rounded-xl"><Eye size={22} /></div>
                                      <div>
                                        <div className="text-[0.65rem] font-extrabold text-indigo-700 uppercase tracking-wider">Pageviews</div>
                                        <div className="text-[1.25rem] font-black text-indigo-900">
                                          {(() => {
                                            const views = p.pageviews_details || p.pageviews;
                                            if (views && typeof views === 'object') {
                                              const val = breakdownRange === '30' ? views.days_30 : breakdownRange === '60' ? views.days_60 : views.days_90;
                                              return (val || 0).toLocaleString();
                                            }
                                            return (p.pageviews || 0).toLocaleString();
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-violet-50 p-5 rounded-[18px] border border-violet-200 flex items-center gap-4">
                                      <div className="bg-violet-500 text-white p-2.5 rounded-xl"><TrendingUp size={22} /></div>
                                      <div>
                                        <div className="text-[0.65rem] font-extrabold text-violet-700 uppercase tracking-wider">Sell Thru / Sold</div>
                                        <div className="text-[1.25rem] font-black text-violet-900">
                                          {(() => {
                                            const st = p.sell_thru_details || p.sell_thru;
                                            const totalSold = typeof p.sell_thru === 'string' ? parseFloat(p.sell_thru) : p.sell_thru;
                                            if (st && typeof st === 'object') {
                                              const val = breakdownRange === '30' ? st.days_30 : breakdownRange === '60' ? st.days_60 : st.days_90;
                                              return (val || 0).toLocaleString();
                                            }
                                            return (totalSold || 0).toLocaleString();
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    {p.most_sold_color && p.most_sold_color !== 'N/A' && (
                                      <div className="bg-amber-50 p-5 rounded-[18px] border border-amber-200 flex items-center gap-4">
                                        <div className="bg-amber-500 text-white p-2.5 rounded-xl"><Palette size={22} /></div>
                                        <div className="min-w-0">
                                          <div className="text-[0.65rem] font-extrabold text-amber-700 uppercase tracking-wider">Best Color</div>
                                          <div className="text-[1.05rem] font-black text-amber-900 truncate">{p.most_sold_color}</div>
                                        </div>
                                      </div>
                                    )}
                                    {p.most_sold_size && p.most_sold_size !== 'N/A' && (
                                      <div className="bg-emerald-50 p-5 rounded-[18px] border border-emerald-200 flex items-center gap-4">
                                        <div className="bg-emerald-500 text-white p-2.5 rounded-xl"><Maximize size={22} /></div>
                                        <div className="min-w-0">
                                          <div className="text-[0.65rem] font-extrabold text-emerald-700 uppercase tracking-wider">Best Size</div>
                                          <div className="text-[1.15rem] font-black text-emerald-900">{p.most_sold_size}</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr className="bg-slate-50">
                      <td colSpan={isMerchMode ? 7 : 10} className="p-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-7 grid gap-10 shadow-md" style={{ gridTemplateColumns: '250px 1fr' }}>
                          {/* Left: image */}
                          <div className="text-center border-r border-slate-100 pr-8">
                            <div className="rounded-2xl shadow-lg overflow-hidden bg-slate-100 aspect-[2/3]">
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
                              {p.vendor === 'The Dress Outlet' && !isMerchMode && (
                                <button
                                  onClick={() => { setSelectedProduct({ ...p, isAnalytics: true }) }}
                                  className="w-full bg-indigo-600 text-white border-none py-3 rounded-xl text-[0.85rem] font-extrabold cursor-pointer shadow-[0_4px_10px_rgba(79,70,229,0.25)] hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                  <TrendingUp size={16} /> Analytics Hub
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Right: details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-4 mb-4">
                              <h3 className="m-0 text-[1.4rem] font-black text-slate-900 tracking-tight">{p.sku}</h3>
                              {getStatusBadge(p.shopify_status)}
                            </div>
                            <div className="text-[0.85rem] text-slate-500 font-semibold">{p.title}</div>


                            {/* Price grid */}
                            <div className="grid gap-4 mb-8 mt-4" style={{ gridTemplateColumns: `repeat(${(p.tdo_product_id ? 1 : 0) + ((p.wdo_product_id || p.kos_product_id || p.im_product_id) ? 1 : 0) + 1}, 1fr)` }}>
                              {p.tdo_product_id && (
                                <div className="bg-green-50 p-5 rounded-2xl border border-green-100 relative">
                                  <div className="text-[0.65rem] font-extrabold text-green-800 tracking-wider mb-2 uppercase flex justify-between">RETAIL (TDO)</div>
                                  {p.sync_status?.price && <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_0_2px_white]" title="Sync Required" />}
                                  <div className="flex items-center gap-2.5">
                                    {editingPrice?.id === p.internal_id && editingPrice?.field === 'retail' ? (
                                      <>
                                        <input type="number" value={editingPrice.value} onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })} className="w-[90px] text-base font-extrabold border-2 border-emerald-500 rounded-lg px-2.5 py-1.5 outline-none" />
                                        <Check size={20} color="#10b981" onClick={savePrice} className="cursor-pointer" />
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[1.2rem] font-black text-green-800">${p.retail_price}</span>
                                        <Pencil size={16} color="#94a3b8" onClick={() => setEditingPrice({ id: p.internal_id, sku: p.sku, field: 'retail', value: p.retail_price, product_id: p.product_id, tdo_id: p.tdo_product_id, wdo_id: p.wdo_product_id, kos_id: p.kos_product_id })} className="cursor-pointer" />
                                        {p.backup_retail_price && p.backup_retail_price !== p.retail_price && <RotateCcw size={14} color="#e11d48" onClick={() => handleRevert('price', p)} className="cursor-pointer" title="Revert Price Only" />}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {(p.wdo_product_id || p.kos_product_id || p.im_product_id) && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative">
                                  <div className="text-[0.65rem] font-extrabold text-slate-600 tracking-wider mb-2 uppercase flex justify-between">
                                    WHOLESALE ({[p.wdo_product_id && 'WDO', p.kos_product_id && 'KOS', p.im_product_id && 'IM'].filter(Boolean).join('/')})
                                    {p.backup_sizes && p.backup_sizes !== p.staged_sizes && <RotateCcw size={14} color="#e11d48" onClick={() => handleRevert('inventory', p)} className="cursor-pointer" title="Revert Inventory Only" />}
                                  </div>
                                  {p.sync_status?.wholesale && <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_0_2px_white]" title="Sync Required" />}
                                  <div className="flex items-center gap-2.5">
                                    {editingPrice?.id === p.internal_id && editingPrice?.field === 'wholesale' ? (
                                      <>
                                        <input type="number" value={editingPrice.value} onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })} className="w-[90px] text-base font-extrabold border-2 border-indigo-500 rounded-lg px-2.5 py-1.5 outline-none" />
                                        <Check size={20} color="#6366f1" onClick={savePrice} className="cursor-pointer" />
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[1.2rem] font-black text-slate-900">${p.wholesale_price}</span>
                                        <Pencil size={16} color="#94a3b8" onClick={() => setEditingPrice({ id: p.internal_id, sku: p.sku, field: 'wholesale', value: p.wholesale_price, product_id: p.product_id, tdo_id: p.tdo_product_id, wdo_id: p.wdo_product_id, kos_id: p.kos_product_id, im_id: p.im_product_id })} className="cursor-pointer" />
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="bg-red-50 p-5 rounded-2xl border border-red-100 relative">
                                <div className="text-[0.65rem] font-extrabold text-red-800 tracking-wider mb-2 uppercase flex justify-between items-center">
                                  TOTAL STOCK
                                  {p.backup_sizes && p.backup_sizes !== p.staged_sizes && <RotateCcw size={14} color="#e11d48" onClick={() => handleRevert('inventory', p)} className="cursor-pointer" title="Revert Inventory Only" />}
                                </div>
                                {p.is_dirty_inventory && <div className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_0_2px_white]" title="Sync Required" />}
                                <div className="text-[1.2rem] font-black text-red-800">{displayTotalStock} Units</div>
                              </div>
                            </div>

                            {/* AVAILABLE COLORS */}
                            {p.color_variants && Object.keys(p.color_variants).length > 0 && (
                              <div className="mb-4">
                                <div className="text-[0.65rem] font-extrabold text-slate-600 tracking-wider mb-2 uppercase">AVAILABLE COLORS</div>
                                <div className="flex gap-2 flex-wrap">
                                  {Object.keys(p.color_variants).map(c => (
                                    <button
                                      key={c}
                                      onClick={() => setSelectedColors({ ...selectedColors, [p.internal_id]: c })}
                                      className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-bold border transition-all ${activeColor === c ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                    >
                                      {c} <span className="opacity-75">{p.color_totals?.[c] || 0}</span>
                                    </button>
                                  ))}
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
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-8 shadow-sm">
                              <div className="overflow-x-auto flex">
                                {activeVariants?.map(v => (
                                  <div key={v.size} className="w-[90px] shrink-0 border-r border-slate-200 flex flex-col relative">
                                    <div className="bg-slate-50 py-2.5 text-[0.75rem] font-black text-center border-b border-slate-200 text-slate-500 uppercase">{v.size}</div>
                                    <div className="p-3.5 text-center flex flex-col items-center justify-center border-b border-slate-100 h-[65px]">
                                      {editingInventory?.style === p.sku && editingInventory?.size === v.size ? (
                                        <div className="flex items-center gap-1.5 justify-center">
                                          <input type="number" value={editingInventory.value} onChange={(e) => setEditingInventory({ ...editingInventory, value: e.target.value })} className="w-[50px] text-[0.9rem] font-extrabold p-1.5 border-2 border-emerald-500 rounded-lg outline-none" />
                                          <Check size={18} color="#10b981" onClick={saveInventory} className="cursor-pointer" />
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 justify-center">
                                          <span className="text-base font-extrabold text-slate-900">{v.inventory}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="bg-amber-50/50 py-3 text-[0.7rem] font-bold text-center text-amber-800">
                                      {(() => {
                                        const timeframe = p.localTimeframe || activeTimeframe;
                                        if (p.sales_breakdown?.[activeColor]?.[v.size]) {
                                          return p.sales_breakdown[activeColor][v.size];
                                        }
                                        const vKey = `${activeColor?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
                                        if (timeframe === '30' && p.units_sold_30_by_variant?.[vKey] !== undefined) return p.units_sold_30_by_variant[vKey];
                                        if (timeframe === '60' && p.units_sold_60_by_variant?.[vKey] !== undefined) return p.units_sold_60_by_variant[vKey];
                                        if ((timeframe === '90' || timeframe === '7') && p.units_sold_by_variant?.[vKey] !== undefined) return p.units_sold_by_variant[vKey];

                                        const variants = p.variants_merch || p.variants || [];
                                        const vMatch = variants.find(vm => vm.size === v.size && (!activeColor || activeColor === "Default" || vm.color === activeColor));
                                        if (vMatch) {
                                          if (timeframe === '7') return vMatch.sold_7 || 0;
                                          if (timeframe === '30') return vMatch.sold_30 || 0;
                                          if (timeframe === '60') return vMatch.sold_60 || 0;
                                          return vMatch.sold_90 || 0;
                                        }
                                        return <span className="opacity-20">0</span>;
                                      })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* TDO Analytics */}
                            {p.vendor === 'The Dress Outlet' && !isMerchMode && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-6 border-t border-slate-100 pt-8">
                                <div className="bg-indigo-50 p-5 rounded-[18px] border border-indigo-200 flex items-center gap-4">
                                  <div className="bg-indigo-500 text-white p-2.5 rounded-xl"><Eye size={22} /></div>
                                  <div>
                                    <div className="text-[0.65rem] font-extrabold text-indigo-700 uppercase tracking-wider">{(p.localTimeframe || activeTimeframe)}D Pageviews</div>
                                    <div className="text-[1.25rem] font-black text-indigo-900">
                                      {(() => {
                                        const views = p.pageviews_details || p.pageviews;
                                        if (views && typeof views === 'object') {
                                          const tf = p.localTimeframe || activeTimeframe;
                                          const val = tf === '7' ? views.days_7 : tf === '30' ? views.days_30 : tf === '60' ? views.days_60 : views.days_90;
                                          return (val || 0).toLocaleString();
                                        }
                                        return (p.pageviews || 0).toLocaleString();
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-violet-50 p-5 rounded-[18px] border border-violet-200 flex items-center gap-4">
                                  <div className="bg-violet-500 text-white p-2.5 rounded-xl"><TrendingUp size={22} /></div>
                                  <div>
                                    <div className="text-[0.65rem] font-extrabold text-violet-700 uppercase tracking-wider">Sell Thru / Sold</div>
                                    <div className="text-[1.25rem] font-black text-violet-900">
                                      {(() => {
                                        const st = p.sell_thru_details || p.sell_thru;
                                        const totalSold = typeof p.sell_thru === 'string' ? parseFloat(p.sell_thru) : p.sell_thru;
                                        if (st && typeof st === 'object') {
                                          const tf = p.localTimeframe || activeTimeframe;
                                          const val = tf === '7' ? st.days_7 : tf === '30' ? st.days_30 : tf === '60' ? st.days_60 : st.days_90;
                                          return (val || 0).toLocaleString();
                                        }
                                        return (totalSold || 0).toLocaleString();
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                {p.most_sold_color && p.most_sold_color !== 'N/A' && (
                                  <div className="bg-amber-50 p-5 rounded-[18px] border border-amber-200 flex items-center gap-4 min-w-[160px]">
                                    <div className="bg-amber-500 text-white p-2.5 rounded-xl"><Palette size={22} /></div>
                                    <div className="min-w-0">
                                      <div className="text-[0.65rem] font-extrabold text-amber-700 uppercase tracking-wider">Best Color</div>
                                      <div className="text-[1.05rem] font-black text-amber-900 whitespace-nowrap overflow-visible">{p.most_sold_color}</div>
                                    </div>
                                  </div>
                                )}
                                {p.most_sold_size && p.most_sold_size !== 'N/A' && (
                                  <div className="bg-emerald-50 p-5 rounded-[18px] border border-emerald-200 flex items-center gap-4 min-w-[160px]">
                                    <div className="bg-emerald-500 text-white p-2.5 rounded-xl"><Maximize size={22} /></div>
                                    <div className="min-w-0">
                                      <div className="text-[0.65rem] font-extrabold text-emerald-700 uppercase tracking-wider">Best Size</div>
                                      <div className="text-[1.15rem] font-black text-emerald-900 whitespace-nowrap overflow-visible">{p.most_sold_size}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-4 flex-wrap">
                              {p.tdo_link && <a href={p.tdo_link} target="_blank" rel="noreferrer" className="bg-slate-900 text-white px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold no-underline flex items-center gap-2.5 shadow-sm hover:bg-slate-800 transition-all">Shopify TDO <ArrowUpRight size={16} /></a>}
                              {p.im_link && <a href={p.im_link} target="_blank" rel="noreferrer" className="bg-purple-900 text-white px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold no-underline flex items-center gap-2.5 shadow-sm hover:bg-purple-800 transition-all">Shopify IM <ArrowUpRight size={16} /></a>}
                              {p.wdo_link && <a href={p.wdo_link} target="_blank" rel="noreferrer" className="bg-blue-900 text-white px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold no-underline flex items-center gap-2.5 shadow-sm hover:bg-blue-800 transition-all">Shopify WDO <ArrowUpRight size={16} /></a>}
                              {p.kos_link && <a href={p.kos_link} target="_blank" rel="noreferrer" className="bg-pink-900 text-white px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold no-underline flex items-center gap-2.5 shadow-sm hover:bg-pink-800 transition-all">Shopify KOS <ArrowUpRight size={16} /></a>}
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
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl mt-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-500">
            Showing <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="text-slate-900">{totalCount}</span> Products
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
