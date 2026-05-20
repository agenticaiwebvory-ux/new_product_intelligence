import { useEffect } from 'react'
import { Settings, ExternalLink, Globe, Menu, ChevronLeft, Search, ShoppingBag, Home, Store, Tag, GitCommitHorizontal, LayoutDashboard, Power } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchStoreConnections } from '../features/stores/storesSlice'

const Sidebar = ({ activeView, setActiveView, user, onLogout, sidebarLinks = [], isCollapsed, setIsCollapsed }) => {
  const dispatch = useAppDispatch()
  const connections = useAppSelector((state) => state.stores.connections)
  const storeKeys = Object.keys(connections)

  useEffect(() => {
    dispatch(fetchStoreConnections())
    const interval = setInterval(() => dispatch(fetchStoreConnections()), 60000)
    return () => clearInterval(interval)
  }, [dispatch])

  const canSeeControlPanel = user?.perm_settings === 1 || user?.role === 'super_admin'
  const canSeeDashboard = user?.perm_dashboard === 1 || user?.role === 'super_admin' || user?.role === 'admin'

  const navBtnBase =
    'flex items-center gap-3 px-3.5 py-3 rounded-lg font-bold text-[0.9rem] border border-transparent cursor-pointer transition-all w-full whitespace-nowrap'
  const navBtnActive = 'text-slate-950 bg-slate-100 border-slate-200 shadow-sm'
  const navBtnInactive = 'text-slate-500 bg-transparent hover:bg-slate-50 hover:text-slate-800'

  return (
    <aside
      className={`${isCollapsed ? 'w-20 min-w-[80px]' : 'w-[200px] min-w-[200px]'} bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 z-[1000] transition-all duration-300 overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`${isCollapsed ? 'px-3 justify-center' : 'px-6 justify-between'} py-6 flex items-center border-b border-transparent`}
      >
        {!isCollapsed && (
          <div className="text-[1.1rem] font-black text-slate-900 leading-tight">
            TDO
            <br />
            <span className="text-slate-500 text-[0.78rem]">
              Intelligence
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-slate-100 border-none p-2 rounded-xl cursor-pointer text-slate-500 flex items-center justify-center transition-all hover:bg-slate-200"
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Scrollable Nav */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-3' : 'px-4'} flex flex-col gap-2`}
        style={{ scrollbarWidth: 'thin' }}
      >
        <style>{`div::-webkit-scrollbar{width:4px}div::-webkit-scrollbar-track{background:transparent}div::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:10px}`}</style>


        {/* Workspace (existing) */}
        <button
          onClick={() => setActiveView('merchandise')}
          title="Workspace"
          className={`${navBtnBase} ${activeView === 'merchandise' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <ShoppingBag size={22} className="shrink-0" />
          {!isCollapsed && <span>Workspace</span>}
        </button>

        {/* Dashboard Home */}
        <button
          onClick={() => setActiveView('home')}
          title="Dashboard Home"
          className={`${navBtnBase} ${activeView === 'home' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <LayoutDashboard size={22} className="shrink-0" />
          {!isCollapsed && <span>Dashboard</span>}
        </button>

        {/* Stores */}
        <button
          onClick={() => setActiveView('stores')}
          title="Stores"
          className={`${navBtnBase} ${activeView === 'stores' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <Store size={22} className="shrink-0" />
          {!isCollapsed && <span>Stores</span>}
        </button>

        {/* Tags */}
        <button
          onClick={() => setActiveView('tags')}
          title="Tags"
          className={`${navBtnBase} ${activeView === 'tags' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <Tag size={22} className="shrink-0" />
          {!isCollapsed && <span>Tags</span>}
        </button>

        {/* Product Changes / Updates */}
        {canSeeDashboard && (
          <button
            onClick={() => setActiveView('changes')}
            title="Product Changes / Updates"
            className={`${navBtnBase} ${activeView === 'changes' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <GitCommitHorizontal size={22} className="shrink-0" />
            {!isCollapsed && <span>Changes</span>}
          </button>
        )}

        {/* Product Scraper */}
        <button
          onClick={() => setActiveView('scraper')}
          title="Product Scraper"
          className={`${navBtnBase} ${activeView === 'scraper' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <Search size={22} className="shrink-0" />
          {!isCollapsed && <span>Product Scraper</span>}
        </button>

        {/* Control Panel — admin-gated */}
        {canSeeControlPanel && (
          <button
            onClick={() => setActiveView('control_panel')}
            title="Control Panel"
            className={`${navBtnBase} ${activeView === 'control_panel' ? navBtnActive : navBtnInactive} ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <Settings size={22} className="shrink-0" />
            {!isCollapsed && <span>Control Panel</span>}
          </button>
        )}

        {sidebarLinks.length > 0 && !isCollapsed && (
          <div className="mt-6 mb-2 text-[0.7rem] text-slate-400 font-extrabold uppercase tracking-widest pl-3">
            External
          </div>
        )}

        {sidebarLinks.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={link.label}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 font-semibold text-[0.9rem] no-underline transition-all hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            {link.icon === 'shopify' ? (
              <Globe size={20} color="#95BF47" className="shrink-0" />
            ) : (
              <ExternalLink size={20} className="shrink-0" />
            )}
            {!isCollapsed && <span>{link.label}</span>}
          </a>
        ))}

      </div>

      {/* Bordered Container for Stores + Footer */}
      <div className="mx-3 mb-3 mt-auto border border-slate-200 rounded-lg shadow-sm">
        {/* Store Connectivity */}
        {(() => {
          const allActive = storeKeys.every(k => connections[k])
          return (
            <div className={`${isCollapsed ? 'py-4 flex justify-center' : 'py-3 px-3.5'}`}>
              {!isCollapsed && (
                <div className="text-[0.65rem] text-slate-400 font-extrabold uppercase tracking-widest mb-3">
                  Stores
                </div>
              )}
              <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-start'} items-center gap-1`}>
                {storeKeys.map(store => (
                  <div
                    key={store}
                    title={`${store.toUpperCase()}: ${connections[store] ? 'Online' : 'Offline'}`}
                    className={`w-2 h-2 rounded-full ${
                      connections[store]
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                        : 'bg-red-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          )
        })()}

        {/* Divider line */}
        <div className="border-t border-slate-200/60"></div>

        {/* Footer */}
        <div className={`${isCollapsed ? 'py-4 flex justify-center' : 'py-3 px-3.5 flex items-center justify-between'}`}>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-[0.85rem] font-extrabold text-slate-900 truncate">{user?.username}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-0.5 h-3 rounded-full ${user?.role === 'super_admin' ? 'bg-amber-400' : user?.role === 'admin' ? 'bg-indigo-400' : 'bg-slate-300'}`} />
                <span className={`text-[0.6rem] font-black uppercase tracking-wider ${user?.role === 'super_admin' ? 'text-amber-600' : user?.role === 'admin' ? 'text-indigo-500' : 'text-slate-400'}`}>
                  {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title="Sign Out"
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer ${isCollapsed ? '' : ''}`}
          >
            <Power size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
