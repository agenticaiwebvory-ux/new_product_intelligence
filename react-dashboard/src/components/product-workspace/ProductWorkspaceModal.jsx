import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronRight, Package, RefreshCw, Pencil, Check, ArrowUpRight,
  TrendingUp, RotateCcw, Palette, Maximize, Tag, X, Flame, Plus
} from 'lucide-react';

const STORE_KEYS = ['TDO', 'WDO', 'KOS', 'IM'];

const ProductWorkspaceModal = ({
  drawerProductId,
  setDrawerProductId,
  currentItems,
  isMerchMode,
  selectedColors,
  setSelectedColors,
  addingTag,
  setAddingTag,
  newTagInput,
  setNewTagInput,
  breakdownTimeRanges,
  setBreakdownTimeRanges,
  activeStoreTabs,
  setActiveStoreTabs,
  editingPrice,
  setEditingPrice,
  pushingStyle,
  handleTagUpdate,
  pushToShopifyMerch,
  handleRevert,
  setSelectedProduct,
  setProposedFixes,
  setActiveIssue,
  savePrice
}) => {
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);

  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const rangeMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(event.target)) {
        setShowRangeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const drawerProduct = currentItems.find(prod => prod.internal_id === drawerProductId);
  if (!drawerProduct) return null;

  const linkedStores = STORE_KEYS.filter(sKey => drawerProduct.store_prices?.[sKey]?.linked);
  const selectedStoreKey = activeStoreTabs[drawerProduct.internal_id];
  const activeStoreKey = linkedStores.includes(selectedStoreKey) ? selectedStoreKey : (linkedStores[0] || 'TDO');
  const activeStore = drawerProduct.store_prices?.[activeStoreKey] || {};
  const activeColorVars = activeStore.color_variants || {};
  const activeColorTotals = activeStore.color_totals || {};
  const activeStoreVariants = Array.isArray(activeStore.variants) ? activeStore.variants : [];
  const variantColors = [...new Set(activeStoreVariants.map(v => v.color).filter(Boolean))];
  const colorKeys = Object.keys(activeColorVars).length > 0 ? Object.keys(activeColorVars) : variantColors;
  const selectedColor = selectedColors[drawerProduct.internal_id];
  const activeColor = colorKeys.includes(selectedColor) ? selectedColor : (colorKeys[0] || null);

  const activeVariants = Object.keys(activeColorVars).length > 0
    ? Object.entries(activeColorVars[activeColor] || {}).map(([size, inv]) => ({ size, inventory: inv, color: activeColor }))
    : activeStoreVariants.filter(v => !activeColor || v.color === activeColor);

  const displayTotalStock = activeStore.inventory ?? (drawerProduct.total_inventory ?? 0);
  const displayPrice = activeStore.price ?? (drawerProduct.retail_price ?? 0);
  const activeAdminLink = drawerProduct.admin_links?.[activeStoreKey.toLowerCase()];
  const activePriceField = activeStoreKey === 'TDO' ? 'retail' : 'wholesale';
  const activeSyncKey = activeStoreKey === 'TDO' ? 'price' : 'wholesale';
  const breakdownRange = breakdownTimeRanges[drawerProduct.internal_id] || '90';
  const activeTags = activeStoreKey === 'TDO'
    ? (drawerProduct.tags_categorized || { top: [], bestseller: [], special: [] })
    : null;

  // Pre-calculate color metrics for merchandising mode
  const colors = [...new Set(activeStoreVariants.map(v => v.color) || [])];
  const colorMetrics = colors.reduce((acc, c) => {
    const vars = activeStoreVariants.filter(v => v.color === c) || [];
    acc[c] = {
      inv: vars.reduce((sum, v) => sum + (v.inventory || 0), 0),
      sold: vars.reduce((sum, v) => {
        const vKey = `${c?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
        if (breakdownRange === '30') return sum + (drawerProduct.units_sold_30_by_variant?.[vKey] || 0);
        if (breakdownRange === '60') return sum + (drawerProduct.units_sold_60_by_variant?.[vKey] || 0);
        return sum + (drawerProduct.units_sold_by_variant?.[vKey] || 0);
      }, 0)
    };
    return acc;
  }, {});

  // Resolve navigation indexes
  const currentIndex = currentItems.findIndex(prod => prod.internal_id === drawerProduct.internal_id);
  const hasTdoData = isMerchMode || !!drawerProduct.store_prices?.TDO?.linked;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop Overlay */}
      <div
        onClick={() => setDrawerProductId(null)}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
      />

      {/* Floating Sleek Left Navigation Button */}
      <button
        disabled={currentIndex === 0}
        onClick={() => setDrawerProductId(currentItems[currentIndex - 1].internal_id)}
        className={`absolute left-6 md:left-8 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center transition-all z-50 ${
          currentIndex === 0
            ? 'opacity-30 cursor-not-allowed text-slate-300'
            : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-600 hover:scale-110 cursor-pointer hover:shadow-indigo-100/50'
        }`}
        title="Previous Product (Left Arrow / Swipe Right)"
      >
        <ChevronRight size={16} className="rotate-180" />
      </button>

      {/* Floating Sleek Right Navigation Button */}
      <button
        disabled={currentIndex === currentItems.length - 1}
        onClick={() => setDrawerProductId(currentItems[currentIndex + 1].internal_id)}
        className={`absolute right-6 md:right-8 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center transition-all z-50 ${
          currentIndex === currentItems.length - 1
            ? 'opacity-30 cursor-not-allowed text-slate-300'
            : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-600 hover:scale-110 cursor-pointer hover:shadow-indigo-100/50'
        }`}
        title="Next Product (Right Arrow / Swipe Left)"
      >
        <ChevronRight size={16} />
      </button>

      {/* Central Modal Card */}
      <div
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const tagName = e.target.tagName.toLowerCase();
          if (tagName === 'input' || tagName === 'button' || tagName === 'select' || tagName === 'textarea' || e.target.closest('button') || e.target.closest('a') || e.target.closest('.cursor-pointer')) return;
          dragStartX.current = e.clientX;
          dragStartY.current = e.clientY;
          isDragging.current = true;
        }}
        onPointerUp={(e) => {
          if (!isDragging.current) return;
          isDragging.current = false;
          const diffX = e.clientX - dragStartX.current;
          const diffY = e.clientY - dragStartY.current;
          if (Math.abs(diffX) > 65 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            if (diffX > 0 && currentIndex > 0) {
              setDrawerProductId(currentItems[currentIndex - 1].internal_id);
            } else if (diffX < 0 && currentIndex < currentItems.length - 1) {
              setDrawerProductId(currentItems[currentIndex + 1].internal_id);
            }
          }
        }}
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-zoomIn z-10 select-none cursor-grab active:cursor-grabbing"
      >
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[0.65rem] font-extrabold uppercase tracking-widest bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">
                {isMerchMode ? 'Merchandising Details' : 'Product Workspace'}
              </span>
              <span className={`text-[0.6rem] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                drawerProduct.shopify_status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}>
                {drawerProduct.shopify_status}
              </span>
              <span className="text-[0.65rem] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Product {currentIndex + 1} of {currentItems.length}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-black text-slate-900 tracking-tight">
              {drawerProduct.sku || drawerProduct.style}
            </h2>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setDrawerProductId(null)}
              className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200/50 hover:shadow-sm"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* HERO HEADER AREA */}
          <div className="flex gap-4 bg-slate-50 rounded-2xl border border-slate-200 p-3 shadow-sm items-stretch">
            {/* Left Side: Product Image (Aspect 2:3, compact & tall) */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-[110px] h-[165px] rounded-xl shadow-sm overflow-hidden bg-slate-100 border border-slate-200 relative">
                <img
                  src={drawerProduct.main_image}
                  alt={drawerProduct.sku}
                  loading="lazy"
                  className="w-full h-full object-cover transition-opacity duration-300 opacity-0"
                  onLoad={(e) => e.target.classList.remove('opacity-0')}
                />
              </div>
              <div className="mt-1.5 flex flex-col gap-0.5 items-center">
                <span className="text-[0.55rem] font-bold bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded uppercase tracking-wider">{drawerProduct.image_count || 1} Images</span>
                <span className="text-[0.55rem] font-bold bg-green-50 text-green-700 px-1.5 py-0.2 rounded uppercase tracking-wider">{drawerProduct.image_width || 1000}x{drawerProduct.image_height || 1500}</span>
              </div>
            </div>

            {/* Right Side: Consolidated metadata & actions */}
            <div className="flex-1 flex flex-col justify-between py-0.5 pl-1">
              {/* Row 1: Brand/Vendor and Best metrics */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {drawerProduct.vendor && (
                  <div>
                    <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Brand/Vendor</span>
                    <span className="text-[0.75rem] font-black text-slate-700 uppercase bg-slate-200/50 px-2 py-0.5 rounded">{drawerProduct.vendor}</span>
                  </div>
                )}

                {/* Best Color / Size badges right next to it */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {drawerProduct.most_sold_color && drawerProduct.most_sold_color !== 'N/A' && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <Palette size={10} className="text-amber-500" />
                      <span className="text-[0.58rem] font-bold text-amber-700 uppercase">Best Color: {drawerProduct.most_sold_color}</span>
                    </div>
                  )}
                  {drawerProduct.most_sold_size && drawerProduct.most_sold_size !== 'N/A' && (
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <Maximize size={10} className="text-emerald-500" />
                      <span className="text-[0.58rem] font-bold text-emerald-700 uppercase">Best Size: {drawerProduct.most_sold_size}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Action Buttons & Core Metrics (Price, Stock, Best Variant) */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm mt-3">
                {/* Left: Actions */}
                <div className="flex gap-1.5 items-center">
                  {activeStoreKey === 'TDO' && !isMerchMode && (
                    <button
                      onClick={() => { setSelectedProduct({ ...drawerProduct, isAnalytics: true }); }}
                      className="bg-indigo-600 text-white border-none py-1 px-2.5 rounded-lg text-[0.62rem] font-black cursor-pointer shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-1"
                    >
                      <TrendingUp size={11} /> Analytics Hub
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedProduct(drawerProduct);
                      setProposedFixes({ title: drawerProduct.local_title || null, description: drawerProduct.local_description || null, meta_title: drawerProduct.local_meta_title || null, meta_description: drawerProduct.local_meta_description || null });
                      setActiveIssue(null);
                    }}
                    className="bg-white border border-slate-200 py-1 px-2.5 rounded-lg text-[0.62rem] font-black text-brand cursor-pointer transition-all hover:border-brand hover:shadow-sm flex items-center justify-center gap-1"
                  >
                    Notes Hub
                  </button>
                </div>

                {/* Right: Metrics */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Price Metric Badge */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[0.65rem] font-bold text-slate-600 relative">
                    <span className="text-slate-400">PRICE ({activeStoreKey}):</span>
                    {editingPrice?.id === drawerProduct.internal_id && editingPrice?.field === activePriceField ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          type="number"
                          value={editingPrice.value}
                          onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                          className="w-[60px] text-[0.65rem] font-extrabold border border-emerald-500 rounded px-1 py-0.2 outline-none"
                        />
                        <Check size={11} className="text-emerald-500 cursor-pointer hover:scale-115 transition-transform" onClick={savePrice} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-emerald-700">
                          {displayPrice != null ? `$${displayPrice}` : '—'}
                        </span>
                        {!isMerchMode && (
                          <Pencil
                            size={9}
                            className="text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => setEditingPrice({
                              id: drawerProduct.internal_id,
                              sku: drawerProduct.sku,
                              field: activePriceField,
                              store_key: activeStoreKey,
                              value: displayPrice ?? '',
                              product_id: drawerProduct.product_id,
                              tdo_id: drawerProduct.tdo_product_id,
                              wdo_id: drawerProduct.wdo_product_id,
                              kos_id: drawerProduct.kos_product_id,
                              im_id: drawerProduct.im_product_id
                            })}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Total Stock Badge */}
                  <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[0.65rem] font-bold text-slate-600">
                    <span className="text-slate-400">STOCK:</span>
                    <span className="font-extrabold text-rose-700">{displayTotalStock} Units</span>
                  </div>

                  {/* Best Variant Badge */}
                  {(drawerProduct.most_sold_color || drawerProduct.most_sold_size) && (
                    <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[0.65rem] font-bold text-slate-600">
                      <span className="text-slate-400">BEST VARIANT:</span>
                      <span className="font-extrabold text-indigo-700 uppercase">
                        {drawerProduct.most_sold_color && drawerProduct.most_sold_size
                          ? `${drawerProduct.most_sold_color} / ${drawerProduct.most_sold_size}`
                          : drawerProduct.most_sold_color || drawerProduct.most_sold_size || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Store Switcher Selector & Shopify Link button */}
              {!isMerchMode && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner mt-2">
                  <div className="flex items-center gap-1">
                    {STORE_KEYS.map(sKey => {
                      const storeObj = drawerProduct.store_prices?.[sKey];
                      if (!storeObj?.linked) return null;
                      const isActive = activeStoreKey === sKey;

                      return (
                        <button
                          key={sKey}
                          onClick={() => setActiveStoreTabs(prev => ({ ...prev, [drawerProduct.internal_id]: sKey }))}
                          className={`px-2 py-0.5 rounded-lg text-[0.6rem] font-black transition-all flex items-center gap-1 cursor-pointer border ${
                            isActive
                              ? sKey === 'TDO' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' :
                                sKey === 'WDO' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' :
                                sKey === 'KOS' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                                'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <span>{sKey}</span>
                          <span className={`text-[0.45rem] px-1 rounded font-extrabold uppercase ${
                            storeObj.status === 'ACTIVE'
                              ? isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600'
                              : isActive ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {storeObj.status === 'ACTIVE' ? 'ACT' : 'DFT'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeAdminLink && (
                    <a
                      href={activeAdminLink}
                      target="_blank"
                      rel="noreferrer"
                      className={`ml-auto px-2 py-0.5 rounded-lg text-[0.6rem] font-black transition-all shadow-sm flex items-center gap-1 no-underline text-white border border-transparent hover:scale-105 active:scale-95 ${
                        activeStoreKey === 'TDO' ? 'bg-[#0f172a] hover:bg-slate-800' :
                        activeStoreKey === 'IM' ? 'bg-[#6b21a8] hover:bg-purple-700' :
                        activeStoreKey === 'WDO' ? 'bg-[#1e3a8a] hover:bg-blue-800' :
                        'bg-[#881337] hover:bg-rose-800'
                      }`}
                    >
                      <span>Shopify {activeStoreKey}</span>
                      <ArrowUpRight size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DETAILS PANELS OR MERCHANDISING CARDS */}
          <div className={`grid grid-cols-1 ${activeStoreKey === 'TDO' && hasTdoData ? 'lg:grid-cols-12' : ''} gap-3`}>
            {/* Colors Column */}
            <div className={`${activeStoreKey === 'TDO' && hasTdoData ? 'lg:col-span-5' : 'w-full'}`}>
              {isMerchMode ? (
                // MERCHANDISING MODE DETAIL PANELS
                colors.length > 0 && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 h-full flex flex-col justify-between">
                    <div>
                      <div className="text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">AVAILABLE COLORS</div>
                      <div className="flex flex-wrap gap-1.5">
                        {colors.map(color => {
                          const hasInv = colorMetrics[color]?.inv > 0;
                          const isActive = activeColor === color;

                          return (
                            <button
                              key={color}
                              onClick={() => setSelectedColors(prev => ({ ...prev, [drawerProduct.internal_id]: color }))}
                              className={`px-2 py-0.5 rounded-lg text-[0.62rem] font-black transition-all shadow-sm border flex items-center gap-1.5 cursor-pointer 
                                ${isActive
                                  ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200'
                                  : hasInv
                                    ? 'bg-pink-50 text-pink-600 border-pink-100 hover:border-pink-300'
                                    : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'}`}
                            >
                              <span className="uppercase tracking-tight">{color}</span>
                              <div className={`flex items-center gap-1 border-l pl-1.5 ${isActive ? 'border-white/20' : hasInv ? 'border-pink-200' : 'border-slate-100'}`}>
                                <span className={`text-[0.55rem] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{colorMetrics[color]?.inv}</span>
                                <span className={`text-[0.55rem] font-black ${isActive ? 'text-white' : hasInv ? 'text-pink-600' : 'text-amber-500'}`}>{colorMetrics[color]?.sold}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                // CATALOG/UNIFIED DETAIL PANELS WITH STORE TABS
                colorKeys.length > 0 && (
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/80 h-full flex flex-col justify-between">
                    <div>
                      <div className="text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">
                        AVAILABLE COLORS ({activeStoreKey})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {colorKeys.map(color => {
                          const isActive = activeColor === color;
                          let count = activeColorTotals?.[color];
                          if (count === undefined) {
                            const matchingVars = activeStoreVariants.filter(v => v.color === color);
                            count = matchingVars.reduce((sum, v) => sum + (v.inventory ?? 0), 0);
                          }

                          return (
                            <button
                              key={color}
                              onClick={() => setSelectedColors(prev => ({ ...prev, [drawerProduct.internal_id]: color }))}
                              className={`px-2 py-0.5 rounded-lg text-[0.62rem] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isActive
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'
                              }`}
                            >
                              <span className="uppercase tracking-tight">{color}</span>
                              <span className={`text-[0.55rem] px-1 py-0.2 rounded ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Tags Column */}
            {hasTdoData && activeStoreKey === 'TDO' && activeTags && (
              <div className="lg:col-span-7">
                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3 h-full flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Tag size={13} className="text-slate-400" />
                        TAGS MANAGEMENT
                      </div>
                      {(drawerProduct.sync_status?.tags || drawerProduct.needs_sync) && (
                        <button
                          onClick={() => pushToShopifyMerch(drawerProduct)}
                          disabled={pushingStyle === drawerProduct.sku}
                          className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[0.65rem] font-black transition-all shadow-sm shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                        >
                          {pushingStyle === drawerProduct.sku ? <RefreshCw size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                          <span>PUSH TAGS</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-0.5">
                      {/* Top Tags */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[0.6rem] font-black text-indigo-600 uppercase tracking-[0.1em] bg-indigo-50 px-2 py-0.5 rounded-md">Top Tags</span>
                          {addingTag?.product_id === drawerProduct.internal_id && addingTag?.category === 'top' ? (
                            <input
                              autoFocus
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onBlur={() => { setAddingTag(null); setNewTagInput(''); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTagInput) {
                                  handleTagUpdate(drawerProduct.internal_id, 'top', 'add', newTagInput, activeStoreKey);
                                  setAddingTag(null);
                                  setNewTagInput('');
                                }
                              }}
                              className="text-[0.65rem] px-2 py-0.5 rounded-lg border border-indigo-200 outline-none w-20 bg-white"
                              placeholder="..."
                            />
                          ) : (
                            <button
                              onClick={() => { setAddingTag({ product_id: drawerProduct.internal_id, category: 'top' }); setNewTagInput(''); }}
                              className="text-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {activeTags?.top?.map((tag, idx) => (
                            <span key={idx} className="group relative inline-flex items-center gap-1 text-[0.62rem] font-extrabold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm transition-all hover:bg-indigo-100/50">
                              {tag}
                              <button onClick={() => handleTagUpdate(drawerProduct.internal_id, 'top', 'remove', tag, activeStoreKey)} className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-rose-500 transition-all cursor-pointer"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bestseller Tags */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[0.6rem] font-black text-amber-600 uppercase tracking-[0.1em] bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1"><Flame size={10} /> Bestseller</span>
                          {addingTag?.product_id === drawerProduct.internal_id && addingTag?.category === 'bestseller' ? (
                            <input
                              autoFocus
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onBlur={() => { setAddingTag(null); setNewTagInput(''); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTagInput) {
                                  handleTagUpdate(drawerProduct.internal_id, 'bestseller', 'add', newTagInput, activeStoreKey);
                                  setAddingTag(null);
                                  setNewTagInput('');
                                }
                              }}
                              className="text-[0.65rem] px-2 py-0.5 rounded-lg border border-amber-200 outline-none w-20 bg-white"
                              placeholder="..."
                            />
                          ) : (
                            <button
                              onClick={() => { setAddingTag({ product_id: drawerProduct.internal_id, category: 'bestseller' }); setNewTagInput(''); }}
                              className="text-amber-300 hover:text-amber-600 transition-colors cursor-pointer"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {activeTags?.bestseller?.map((tag, idx) => (
                            <span key={idx} className="group relative inline-flex items-center gap-1 text-[0.62rem] font-extrabold px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 shadow-sm transition-all hover:bg-amber-100/50">
                              {tag}
                              <button onClick={() => handleTagUpdate(drawerProduct.internal_id, 'bestseller', 'remove', tag, activeStoreKey)} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-rose-500 transition-all cursor-pointer"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Special Tags */}
                      <div className="flex flex-col">
                        <div className="text-[0.6rem] font-black text-rose-500 uppercase tracking-[0.1em] bg-rose-50 px-2 py-0.5 rounded-md w-fit mb-2">Special Tags</div>
                        <div className="flex flex-wrap gap-1">
                          {["No PROM", "No Formal", "Discontinued", "Push PROM"].map(tag => {
                            const isActive = activeTags?.special?.includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => handleTagUpdate(drawerProduct.internal_id, 'special', isActive ? 'remove' : 'add', tag, activeStoreKey)}
                                className={`text-[0.58rem] font-extrabold px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-600 hover:bg-rose-50/30'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SIZES BREAKDOWN MATRIX */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[0.55rem] font-black text-slate-400 uppercase tracking-[0.1em]">
                Size Breakdown & Sales Trend
              </div>
              <div className="relative" ref={rangeMenuRef}>
                <button
                  onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 transition-all text-[0.6rem] font-black shadow-sm cursor-pointer select-none h-[22px]"
                >
                  <span>{breakdownRange === '7' ? '7 Days' : breakdownRange === '30' ? '30 Days' : breakdownRange === '60' ? '60 Days' : '90 Days'}</span>
                  <svg className={`text-slate-400 transition-transform shrink-0 ${showRangeDropdown ? 'rotate-180' : ''}`} width="6" height="4" viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6L0 0H8L4 6Z" fill="currentColor"/>
                  </svg>
                </button>

                {showRangeDropdown && (
                  <div className="absolute right-0 mt-1 w-24 bg-white border border-slate-200/80 rounded-lg shadow-xl py-1 z-[999] overflow-hidden animate-fadeIn">
                    {['7', '30', '60', '90'].map((range) => {
                      const isActive = breakdownRange === range;
                      return (
                        <button
                          key={range}
                          onClick={() => {
                            setBreakdownTimeRanges(prev => ({ ...prev, [drawerProduct.internal_id]: range }));
                            setShowRangeDropdown(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-[0.6rem] font-black transition-all flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-slate-50 text-brand'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span>{range} Days</span>
                          {isActive && <Check size={10} className="text-brand shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto flex custom-scrollbar">
                {activeVariants.length === 0 && (
                  <div className="w-full p-4 text-center text-xs font-bold text-slate-400">
                    No size-level variant inventory found.
                  </div>
                )}
                {activeVariants.map((v, idx) => (
                  <div key={idx} className="w-[80px] shrink-0 border-r border-slate-100 last:border-0 flex flex-col relative">
                    <div className="bg-slate-50 py-1 text-[0.6rem] font-black text-center border-b border-slate-100 text-slate-500 uppercase">
                      {v.size}
                    </div>
                    <div className="p-1.5 text-center flex flex-col items-center justify-center border-b border-slate-50 h-[38px]">
                      <span className="text-xs font-extrabold text-slate-800">{v.inventory}</span>
                    </div>
                    <div className="bg-amber-50/20 py-1 text-[0.6rem] font-extrabold text-center text-amber-700">
                      {(() => {
                        if (drawerProduct.sales_breakdown?.[activeColor]?.[v.size]) {
                          return drawerProduct.sales_breakdown[activeColor][v.size];
                        }
                        const vKey = `${activeColor?.toString().toLowerCase()}-${v.size?.toString().toLowerCase()}`;
                        if (breakdownRange === '7' && drawerProduct.units_sold_7_by_variant?.[vKey] !== undefined) return drawerProduct.units_sold_7_by_variant[vKey];
                        if (breakdownRange === '30' && drawerProduct.units_sold_30_by_variant?.[vKey] !== undefined) return drawerProduct.units_sold_30_by_variant[vKey];
                        if (breakdownRange === '60' && drawerProduct.units_sold_60_by_variant?.[vKey] !== undefined) return drawerProduct.units_sold_60_by_variant[vKey];
                        if (drawerProduct.units_sold_by_variant?.[vKey] !== undefined) return drawerProduct.units_sold_by_variant[vKey];

                        const variants = drawerProduct.variants_merch || drawerProduct.variants || [];
                        const vMatch = variants.find(vm => vm.size === v.size && (!activeColor || activeColor === "Default" || vm.color === activeColor));
                        if (vMatch) {
                          if (breakdownRange === '7') return vMatch.sold_7 || 0;
                          if (breakdownRange === '30') return vMatch.sold_30 || 0;
                          if (breakdownRange === '60') return vMatch.sold_60 || 0;
                          return vMatch.sold_90 || 0;
                        }
                        return 0;
                      })()}
                      <span className="text-[0.55rem] block text-slate-400 font-bold tracking-tight">sold</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revert Actions */}
          {drawerProduct.has_backup && !Object.values(drawerProduct.sync_status || {}).some(v => v === true) && (
            <div className="pt-6 border-t border-slate-200/60 flex justify-end">
              <button
                onClick={() => handleRevert('all', drawerProduct)}
                className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-[0.75rem] font-black hover:bg-red-100 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Undo Push (Revert)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductWorkspaceModal;
