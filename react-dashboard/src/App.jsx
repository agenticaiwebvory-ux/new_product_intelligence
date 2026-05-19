import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import LoginPage from './components/LoginPage'
import ControlPanel from './components/ControlPanel'
import ScraperDashboard from './components/ScraperDashboard'
import MerchandisingReport from './components/MerchandisingReport'
import { RefreshCw, Home, Package, Store, Tag, GitCommitHorizontal, Construction } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { loginSucceeded, logoutUser } from './features/auth/authSlice'
import { clearDashboardStats, fetchDashboardStats } from './features/dashboard/dashboardSlice'
import { setActiveView, setSidebarCollapsed, setSidebarLinks } from './features/layout/layoutSlice'

// ---------------------------------------------------------------------------
// PlaceholderView — shown for sidebar sections not yet built into full views
// ---------------------------------------------------------------------------
const VIEW_META = {
  home: { icon: Home, label: 'Dashboard Home', desc: 'High-level KPI overview and store health summary.' },
  products: { icon: Package, label: 'Products', desc: 'Full multi-store product catalog browser.' },
  stores: { icon: Store, label: 'Stores', desc: 'Per-store configuration, credentials, and live connection status.' },
  tags: { icon: Tag, label: 'Tags', desc: 'Tag management and bulk tag operations across all stores.' },
  changes: { icon: GitCommitHorizontal, label: 'Product Changes / Updates', desc: 'Audit log of product edits, price changes, and Shopify syncs.' },
}

const PlaceholderView = ({ view }) => {
  const meta = VIEW_META[view] || { icon: Construction, label: view, desc: 'This section is under development.' }
  const Icon = meta.icon
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-6">
          <Icon size={32} className="text-indigo-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">{meta.label}</h2>
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">{meta.desc}</p>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-widest">
          <Construction size={12} />
          Coming Soon
        </span>
      </div>
    </div>
  )
}

function App() {
  const dispatch = useAppDispatch()
  const { isLoggedIn, user } = useAppSelector((state) => state.auth)
  const { activeView, isSidebarCollapsed, sidebarLinks } = useAppSelector((state) => state.layout)
  const [appLoading, setAppLoading] = useState(() => Boolean(isLoggedIn))

  useEffect(() => {
    if (isLoggedIn) {
      dispatch(fetchDashboardStats()).finally(() => setAppLoading(false))
    }
  }, [dispatch, isLoggedIn])

  const handleLogin = (userData) => {
    setAppLoading(true)
    dispatch(loginSucceeded(userData))
  }

  const handleLogout = async () => {
    await dispatch(logoutUser())
    dispatch(clearDashboardStats())
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (appLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="text-brand animate-pulse" size={32} />
          </div>
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-white text-2xl font-black tracking-tight mb-2">TDO INTELLIGENCE</h1>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing unified dashboard catalog...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#fff', fontWeight: 'bold' } }} />
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => dispatch(setActiveView(view))}
        user={user}
        onLogout={handleLogout}
        sidebarLinks={sidebarLinks}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={(isCollapsed) => dispatch(setSidebarCollapsed(isCollapsed))}
      />
      <main className="flex-1 overflow-y-auto h-screen px-8 pb-8 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <style>{`
          body { margin: 0; padding: 0; overflow: hidden; }
          main::-webkit-scrollbar { width: 2px; }
          main::-webkit-scrollbar-track { background: transparent; }
          main::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
          main::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}</style>
        {activeView === 'scraper' && <ScraperDashboard />}
        {activeView === 'merchandise' && <MerchandisingReport />}
        {activeView === 'control_panel' && (
          <ControlPanel
            user={user}
            sidebarLinks={sidebarLinks}
            setSidebarLinks={(links) => dispatch(setSidebarLinks(links))}
          />
        )}
        {/* New sidebar sections — placeholder views until dedicated components are built */}
        {['home', 'products', 'stores', 'tags', 'changes'].includes(activeView) && (
          <PlaceholderView view={activeView} />
        )}
      </main>
    </div>
  )
}

export default App
