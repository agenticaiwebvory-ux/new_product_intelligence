import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import LoginPage from './components/LoginPage'
import ControlPanel from './components/ControlPanel'
import ScraperDashboard from './components/ScraperDashboard'
import MerchandisingReport from './components/MerchandisingReport'
import DashboardHome from './components/DashboardHome'
import ProductsPage from './components/ProductsPage'
import StoresPage from './components/StoresPage'
import TagsPage from './components/TagsPage'
import ChangesPage from './components/ChangesPage'
import { RefreshCw } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { loginSucceeded, logoutUser } from './features/auth/authSlice'
import { clearDashboardStats, fetchDashboardStats } from './features/dashboard/dashboardSlice'
import { setActiveView, setSidebarCollapsed, setSidebarLinks } from './features/layout/layoutSlice'

function App() {
  const dispatch = useAppDispatch()
  const { isLoggedIn, user } = useAppSelector((state) => state.auth)
  const { activeView, isSidebarCollapsed, sidebarLinks } = useAppSelector((state) => state.layout)
  const [appLoading, setAppLoading] = useState(() => Boolean(isLoggedIn))
  const [logoError, setLogoError] = useState(false)

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
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            {logoError ? (
              <div className="w-8 h-8 border-2 border-white rounded flex items-center justify-center">
                <span className="text-white text-[1.1rem] font-black leading-none">O</span>
              </div>
            ) : (
              <img src="/logo.jpg" alt="Logo" className="w-10 h-10 object-contain" onError={() => setLogoError(true)} />
            )}
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
      <Toaster position="top-right" containerStyle={{ zIndex: 10002 }} toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#fff', fontWeight: 'bold' } }} />
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
        {/* New sidebar sections */}
        {activeView === 'home' && <DashboardHome />}
        {activeView === 'products' && <ProductsPage />}
        {activeView === 'stores' && <StoresPage />}
        {activeView === 'tags' && <TagsPage />}
        {activeView === 'changes' && <ChangesPage />}
      </main>
    </div>
  )
}

export default App
