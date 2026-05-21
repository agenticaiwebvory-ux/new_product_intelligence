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
  const navBtnActive = 'text-white bg-white/10 border-white/10 shadow-lg shadow-black/20'
  const navBtnInactive = 'text-white/40 bg-transparent hover:bg-white/5 hover:text-white/60'

  return (
    <aside
      className={`${isCollapsed ? 'w-20 min-w-[80px]' : 'w-[200px] min-w-[200px]'} bg-black border-r border-white/10 flex flex-col h-screen sticky top-0 z-[1000] transition-all duration-300 overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`${isCollapsed ? 'px-3 justify-center' : 'px-6 justify-between'} py-6 flex items-center border-b border-transparent`}
      >
        {!isCollapsed && (
          <div className="text-[1.1rem] font-black text-white/90 leading-tight">
            TDO
            <br />
            <span className="text-white/50 text-[0.78rem]">
              Intelligence
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-white/10 border-none p-2 rounded-xl cursor-pointer text-white/60 flex items-center justify-center transition-all hover:bg-white/20 hover:text-white/80"
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Scrollable Nav */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-3' : 'px-4'} flex flex-col gap-2`}
        style={{ scrollbarWidth: 'thin' }}
      >
        <style>{`div::-webkit-scrollbar{width:4px}div::-webkit-scrollbar-track{background:transparent}div::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:10px}`}</style>


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
          <div className="mt-6 mb-2 text-[0.7rem] text-white/30 font-extrabold uppercase tracking-widest pl-3">
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
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 font-semibold text-[0.9rem] no-underline transition-all hover:bg-white/5 hover:text-white/80 whitespace-nowrap ${isCollapsed ? 'justify-center' : 'justify-start'}`}
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
      <div className="mx-3 mb-3 mt-auto border border-white/10 rounded-lg bg-gradient-to-b from-white/[0.08] via-slate-500/[0.06] to-white/[0.02]">
        {/* Store Connectivity */}
        {(() => {
          const allActive = storeKeys.every(k => connections[k])
          return (
            <div className={`${isCollapsed ? 'py-4 flex justify-center' : 'py-3 px-3.5'}`}>
              {!isCollapsed && (
                <div className="text-[0.65rem] text-white/50 font-extrabold uppercase tracking-widest mb-3">
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
        <div className="border-t border-white/15"></div>

        {/* Footer */}
        <div className={`${isCollapsed ? 'py-4 flex justify-center' : 'py-3 px-3.5 flex items-center justify-between'}`}>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-[0.85rem] font-extrabold text-white/90 truncate">{user?.username}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-0.5 h-3 rounded-full ${user?.role === 'super_admin' ? 'bg-amber-400' : user?.role === 'admin' ? 'bg-indigo-400' : 'bg-white/30'}`} />
                <span className={`text-[0.6rem] font-black uppercase tracking-wider ${user?.role === 'super_admin' ? 'text-amber-400' : user?.role === 'admin' ? 'text-indigo-400' : 'text-white/50'}`}>
                  {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : user?.role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title="Sign Out"
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 hover:bg-white/10 transition-all cursor-pointer ${isCollapsed ? '' : ''}`}
          >
            <Power size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
