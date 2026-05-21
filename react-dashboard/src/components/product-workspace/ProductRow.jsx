import { Fragment, memo } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import ProductAnalyticsPanel from '../merchandising/ProductAnalyticsPanel'

const ProductRow = memo(
  ({ product, isExpanded, processingOps, onToggle, onClickDetail, getStatusBadge }) => {
    const hasProcessingOp = !!processingOps[product.sku]
    return (
      <Fragment>
        <tr
          className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ transform: 'translateZ(0)' }}
          onClick={() => onClickDetail(product)}
        >
          <td className="p-5 text-center">
            <ChevronRight
              size={20}
              onClick={(e) => { e.stopPropagation(); onToggle(product.internal_id) }}
              className={`cursor-pointer transition-transform text-slate-400 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </td>
          <td className="p-5">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              <img
                src={product.main_image}
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
                  {product.style}
                </div>
                {hasProcessingOp && <RefreshCw size={14} className="animate-spin text-brand shrink-0" />}
                {getStatusBadge(product.shopify_status, true)}
              </div>
              <div className="text-[0.7rem] text-slate-400 font-bold truncate max-w-[180px]" title={product.title}>{product.title}</div>
            </div>
          </td>
          <td className="p-5">
            <div className="text-[0.8rem] font-bold text-slate-600 uppercase tracking-tight">
              {product.vendor || 'Unknown'}
            </div>
          </td>
          <td className="p-5 text-center">
            <div className="flex justify-center gap-10">
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.pageviews_details?.days_30 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.pageviews_details?.days_60 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-indigo-600 font-black scale-105">{(product.pageviews_details?.days_90 || 0).toLocaleString()}</span>
            </div>
          </td>
          <td className="p-5 text-center">
            <div className="flex justify-center gap-10">
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.sell_thru_details?.days_30 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.sell_thru_details?.days_60 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-emerald-600 font-black scale-105">{(product.sell_thru_details?.days_90 || 0).toLocaleString()}</span>
            </div>
          </td>
          <td className="p-5 text-center">
            <div className="flex justify-center gap-3">
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.returns_details?.days_30 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-slate-500 font-bold opacity-60">{(product.returns_details?.days_60 || 0).toLocaleString()}</span>
              <span className="text-[0.8rem] text-rose-600 font-black scale-105">{(product.returns_details?.days_90 || 0).toLocaleString()}</span>
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr className="bg-slate-50">
            <td colSpan={7} className="p-4">
              <ProductAnalyticsPanel p={product} />
            </td>
          </tr>
        )}
      </Fragment>
    )
  },
  (prevProps, nextProps) => {
    if (prevProps.isExpanded !== nextProps.isExpanded) return false
    const prev = prevProps.product
    const next = nextProps.product
    if (prevProps.processingOps[prev.sku] !== nextProps.processingOps[next.sku]) return false
    if (prev.tdo_status !== next.tdo_status) return false
    if (prev.tdo_price !== next.tdo_price) return false
    if (prev.retail_price !== next.retail_price) return false
    if (prev.wholesale_price !== next.wholesale_price) return false
    if (prev.total_inventory !== next.total_inventory) return false
    if (prev.tags !== next.tags) return false
    if (prev.shopify_status !== next.shopify_status) return false
    if (prev.store_health !== next.store_health) return false
    if (prev.stores !== next.stores) return false
    if (prev.sync_status !== next.sync_status) return false
    if (prev.pageviews_details?.days_30 !== next.pageviews_details?.days_30) return false
    if (prev.pageviews_details?.days_60 !== next.pageviews_details?.days_60) return false
    if (prev.pageviews_details?.days_90 !== next.pageviews_details?.days_90) return false
    if (prev.sell_thru_details?.days_30 !== next.sell_thru_details?.days_30) return false
    if (prev.sell_thru_details?.days_60 !== next.sell_thru_details?.days_60) return false
    if (prev.sell_thru_details?.days_90 !== next.sell_thru_details?.days_90) return false
    if (prev.returns_details?.days_30 !== next.returns_details?.days_30) return false
    if (prev.returns_details?.days_60 !== next.returns_details?.days_60) return false
    if (prev.returns_details?.days_90 !== next.returns_details?.days_90) return false
    return true
  }
)

ProductRow.displayName = 'ProductRow'
export default ProductRow
