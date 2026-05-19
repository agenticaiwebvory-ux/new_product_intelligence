import { Check, X } from 'lucide-react'

const ConfirmationDialog = ({ confirmation, busy, onClose }) => {
  if (!confirmation) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5">
            <Check size={24} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3 m-0">
            {confirmation.title}
          </h3>
          <p className="text-slate-500 text-base leading-relaxed mb-8">
            {confirmation.message}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onClose}
              className="py-4 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmation.onConfirm}
              disabled={busy}
              className={`py-4 rounded-2xl text-[0.9rem] font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 ${confirmation.confirmClass}`}
            >
              {busy ? <X className="animate-spin" size={18} /> : confirmation.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
