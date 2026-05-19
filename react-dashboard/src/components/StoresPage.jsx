import { useEffect, useState } from 'react'
import { apiService } from '../services/api'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchStoreConnections } from '../features/stores/storesSlice'
import { STORE_KEYS, STORE_LABELS } from '../constants/dashboard'
import { Store, RefreshCw, CheckCircle, XCircle, Globe, AlertTriangle, ExternalLink } from 'lucide-react'

export default function StoresPage() {
  const dispatch = useAppDispatch()
  const connections = useAppSelector((s) => s.stores.connections)
  const [storeList, setStoreList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [storesRes] = await Promise.all([
          apiService.getStores(),
          dispatch(fetchStoreConnections()),
        ])
        setStoreList(storesRes.stores || [])
      } catch (e) {
        setError(e?.response?.data?.detail || e.message || 'Failed to load stores')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dispatch])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-slate-400 font-semibold">
          <RefreshCw className="animate-spin" size={20} /> Loading stores...
        </div>
      </div>
    )
  }

  const storeNames = storeList.length > 0 ? storeList : STORE_KEYS

  return (
    <div className="py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Stores</h1>
        <p className="text-sm font-medium text-slate-400 mt-1">Connected Shopify stores and their live connection status</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm font-bold text-red-700">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        {storeNames.map((key) => {
          const isOnline = connections[key]
          const label = STORE_LABELS[key] || key
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${isOnline ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-center`}>
                    <Globe size={24} className={isOnline ? 'text-emerald-600' : 'text-red-500'} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 uppercase">{label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isOnline ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <CheckCircle size={12} /> Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                          <XCircle size={12} /> Disconnected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {isOnline ? 'Live' : 'Offline'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 font-semibold">Status</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5 capitalize">{isOnline ? 'Operational' : 'Connection Error'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 font-semibold">Store Key</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5 font-mono">{key}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
