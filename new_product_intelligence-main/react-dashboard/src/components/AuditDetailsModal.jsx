import React from 'react'
import { X, Info } from 'lucide-react'

const AuditDetailsModal = ({
  selectedProduct,
  setSelectedProduct
}) => {
  if (!selectedProduct) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-[500px] rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-8 py-6 border-b border-slate-100 flex items-center justify-between ${selectedProduct.isAnalytics ? 'bg-indigo-50/50' : 'bg-slate-50/50'}`}>
          <div>
            <div className="text-[0.7rem] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">
              {selectedProduct.isAnalytics ? 'Performance Insights' : 'Internal Records'}
            </div>
            <h2 className="m-0 text-xl font-black text-slate-900 tracking-tight">
              Style: <span className={selectedProduct.isAnalytics ? 'text-indigo-600' : 'text-brand'}>{selectedProduct.style || selectedProduct.sku}</span>
            </h2>
          </div>
          <button 
            onClick={() => setSelectedProduct(null)}
            className="p-2 rounded-xl hover:bg-slate-200/50 transition-all text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className={`${selectedProduct.isAnalytics ? 'bg-indigo-500' : 'bg-brand/10'} p-2 rounded-lg`}>
              <Info size={18} className={selectedProduct.isAnalytics ? 'text-white' : 'text-brand'} />
            </div>
            <span className={`text-[0.85rem] font-extrabold ${selectedProduct.isAnalytics ? 'text-indigo-700' : 'text-slate-700'} uppercase tracking-wide`}>
              {selectedProduct.isAnalytics ? 'Analytics Data Notes' : 'Operational Notes'}
            </span>
          </div>

          <div className={`${selectedProduct.isAnalytics ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-6 shadow-inner relative overflow-hidden group`}>
             {/* Subtle Decorative Background Element */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Info size={100} />
            </div>

            <p className={`m-0 text-[1rem] ${selectedProduct.isAnalytics ? 'text-indigo-900' : 'text-slate-600'} leading-relaxed italic relative z-10 font-medium`}>
              {selectedProduct.isAnalytics 
                ? (selectedProduct.analytics_notes || "No performance insights or analytics notes have been recorded for this style yet.")
                : (selectedProduct.notes || "No internal operational notes have been recorded for this style yet.")
              }
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-slate-400">
             <div className={`w-1.5 h-1.5 rounded-full ${selectedProduct.isAnalytics ? 'bg-indigo-300' : 'bg-slate-300'}`} />
             <span className="text-[0.65rem] font-bold uppercase tracking-widest">
               {selectedProduct.isAnalytics ? 'Real-Time Store Data' : 'Permanent Database Record'}
             </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={() => setSelectedProduct(null)}
            className="bg-slate-900 text-white border-none px-8 py-2.5 rounded-xl text-[0.85rem] font-black cursor-pointer hover:bg-slate-700 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuditDetailsModal
