import { Fragment } from 'react'
import {
  ChevronDown, TrendingUp, Tag, X, Plus, Flame,
  Pencil, Check, ArrowUpRight, RotateCcw, RefreshCw, Package
} from 'lucide-react'

const STORE_KEYS = ['TDO', 'WDO', 'KOS', 'IM']
const STORE_LABELS = { TDO: 'TDO', WDO: 'WDO', KOS: 'KOS', IM: 'IM' }

export default function ProductDetailContent({
  p,
  selectedColors, setSelectedColors,
  activeStoreTabs, setActiveStoreTabs,
  editingPrice, setEditingPrice,
  activeTimeframe,
  addingTag, setAddingTag,
  newTagInput, setNewTagInput,
  setSelectedProduct, setProposedFixes, setActiveIssue,
  handleTagUpdate, handleTimeframeChange, handleRevertPrice,
  handleRevert, pushToShopifyMerch, savePrice,
  setConfirmationModal, getStatusBadge, pushingStyle,
  pushPriceToShopify,
}) {
  const linkedStores = STORE_KEYS.filter(sKey => p.store_prices?.[sKey]?.linked)
  const selectedStoreKey = activeStoreTabs[p.internal_id]
  const activeStoreKey = linkedStores.includes(selectedStoreKey) ? selectedStoreKey : (linkedStores[0] || 'TDO')
  const activeStore = p.store_prices?.[activeStoreKey] || {}
  const activeColorVars = activeStore.color_variants || {}
  const activeColorTotals = activeStore.color_totals || {}
  const activeStoreVariants = Array.isArray(activeStore.variants) ? activeStore.variants : []
  const variantColors = [...new Set(activeStoreVariants.map(v => v.color).filter(Boolean))]
  const colorKeys = Object.keys(activeColorVars).length > 0 ? Object.keys(activeColorVars) : variantColors
  const selectedColor = selectedColors[p.internal_id]
  const activeColor = colorKeys.includes(selectedColor) ? selectedColor : (colorKeys[0] || null)
  const activeVariants = Object.keys(activeColorVars).length > 0
    ? Object.entries(activeColorVars[activeColor] || {}).map(([size, inv]) => ({ size, inventory: inv, color: activeColor }))
    : activeStoreVariants.filter(v => !activeColor || v.color === activeColor)
  const bestSizeForColor = p.sales_breakdown?.[activeColor]
    ? Object.entries(p.sales_breakdown[activeColor]).sort(([,a], [,b]) => b - a)[0]?.[0]
    : null
  const displayTotalStock = activeStore.inventory ?? 0
  const displayPrice = activeStoreKey === 'TDO' ? (p.retail_price ?? activeStore.price) : (p.wholesale_price ?? activeStore.price)
  const activeAdminLink = p.admin_links?.[activeStoreKey.toLowerCase()]
  const activePriceField = activeStoreKey === 'TDO' ? 'retail' : 'wholesale'
  const activeSyncKey = activeStoreKey === 'TDO' ? 'price' : 'wholesale'
  const activeBackupPrice = activeStoreKey === 'TDO' ? p.backup_retail_price : p.backup_wholesale_price
  const canRevertActivePrice = activeBackupPrice !== null && activeBackupPrice !== undefined && activeBackupPrice !== displayPrice

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: '200px 1fr' }}>
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
              <div className="text-[0.65rem] font-extrabold text-green-800 tracking-wider mb-2 uppercase flex justify-between items-center">
                <span>PRICE ({activeStoreKey})</span>
                <div className="flex items-center gap-1.5">
                  {canRevertActivePrice && (
                    <button
                      onClick={() => handleRevertPrice(p, activeStoreKey)}
                      disabled={pushingStyle === p.sku}
                      className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[0.65rem] font-black hover:bg-rose-100 transition-all disabled:opacity-50 cursor-pointer"
                      title={`Revert to $${Number(activeBackupPrice).toFixed(2)}`}
                    >
                      <RotateCcw size={10} />
                      REVERT
                    </button>
                  )}
                  {p.sync_status?.[activeSyncKey] && (
                    <button
                      onClick={() => pushPriceToShopify(p, activeStoreKey)}
                      disabled={pushingStyle === p.sku}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-lg text-[0.65rem] font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 cursor-pointer"
                    >
                      {pushingStyle === p.sku ? <RefreshCw size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                      PUSH
                    </button>
                  )}
                </div>
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
                        title: 'Save Price Draft',
                        message: `Save updated ${field} price ($${newVal.toFixed(2)}) for ${sku} as a local draft? You must push it to Shopify to apply the change live.`,
                        confirmText: 'Save Draft',
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
                    <Pencil size={16} color="#475569" onClick={() => setEditingPrice({ id: p.internal_id, sku: p.sku, field: activePriceField, store_key: activeStoreKey, value: displayPrice ?? '', product_id: p.product_id, tdo_id: p.tdo_product_id, wdo_id: p.wdo_product_id, kos_id: p.kos_product_id, im_id: p.im_product_id, stores: p.stores })} className="cursor-pointer" />
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
                      className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-bold border transition-all relative ${activeColor === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
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
        </div>
      </div>

      {/* Divider */}
      <hr className="border-slate-200 -mx-4" />

      {/* Size bubble — separate card */}
      <div className="border border-slate-200 rounded-xl shadow-sm p-4">
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
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto flex w-full">
            {/* Label column */}
            <div className="w-[80px] shrink-0 flex flex-col border-r border-slate-200">
              <div className="bg-slate-50 py-2.5 text-[0.75rem] font-black text-center border-b border-slate-200 text-slate-500 uppercase tracking-wider">SIZE</div>
              <div className="p-3.5 text-center border-b border-slate-100 h-[65px] flex items-center justify-center text-[0.7rem] font-extrabold text-slate-400 uppercase tracking-wider">QTY</div>
              <div className="bg-amber-50/50 py-3 text-[0.7rem] font-bold text-center text-amber-600 uppercase tracking-wider">SOLD</div>
            </div>
            {activeVariants.length === 0 && (
              <div className="w-full p-6 text-center text-sm font-bold text-slate-400">
                No size-level inventory synced for {activeStoreKey}.
              </div>
            )}
            {activeVariants.map(v => {
              const isBestSize = bestSizeForColor && v.size.toString() === bestSizeForColor;
              return (
                <div key={v.size} className="flex-1 min-w-[85px] border-r border-slate-200 flex flex-col relative">
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
        <div className="flex gap-4 flex-wrap mt-4">
          {p.has_backup && !Object.values(p.sync_status || {}).some(v => v === true) && (p.tdo_product_id || p.wdo_product_id || p.kos_product_id) && (
            <button onClick={() => handleRevert('all', p)} className="bg-red-50 text-red-600 border border-red-200 px-[18px] py-2.5 rounded-xl text-[0.85rem] font-extrabold cursor-pointer flex items-center gap-2.5 hover:bg-red-100 transition-all">
              <RotateCcw size={16} /> Undo Push (Revert)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
