import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import LoginPage from './components/LoginPage'

import ControlPanel from './components/ControlPanel'
import ScraperDashboard from './components/ScraperDashboard'
import MerchandisingReport from './components/MerchandisingReport'
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
  const [appLoading, setAppLoading] = useState(true)

  useEffect(() => {
    if (isLoggedIn) {
      dispatch(fetchDashboardStats()).finally(() => setAppLoading(false))
    } else {
      setAppLoading(false)
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
      </main>
    </div>
  )
}

export default App
