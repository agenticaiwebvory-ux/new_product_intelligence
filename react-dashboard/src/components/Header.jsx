import { Filter, ChevronDown, Search } from 'lucide-react';
import { useAppSelector } from '../app/hooks';

const Header = ({ title = "PRODUCT WORKSPACE", eyebrow = "Operations Hub", search, setSearch, activeStoreFilter, setActiveStoreFilter, showStoreFilter = true }) => {
  const storeKeys = useAppSelector((state) => Object.keys(state.stores.connections))

  return (
    <header className="sticky top-0 z-[1000] bg-white/95 backdrop-blur-md pt-5 pb-4 -mx-8 px-8 flex items-center border-b border-slate-200/60">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[1.15rem] font-black tracking-widest text-slate-900 m-0">{title}</h1>
          <span className="text-[0.62rem] font-extrabold text-slate-500 tracking-[0.12em] bg-slate-100 px-2 py-0.5 rounded-md uppercase">{eyebrow}</span>
        </div>
        <p className="m-0 text-[0.75rem] font-semibold text-slate-400">Catalog operations, store inventory, and merchandising signals in one workspace.</p>
      </div>
      <div className="flex gap-4 items-center flex-1 justify-end">
        {showStoreFilter && (
          <div className="relative bg-white border border-slate-200 px-2 rounded-xl h-[42px] flex items-center min-w-[160px] shadow-sm">
          <Filter size={16} color="#A855F7" className="ml-2" />
          <select
            value={activeStoreFilter}
            onChange={(e) => setActiveStoreFilter(e.target.value)}
            className="bg-transparent border-none pl-2 pr-8 text-[0.85rem] font-extrabold outline-none w-full cursor-pointer appearance-none text-slate-900"
          >
            <option value="ALL">All Stores</option>
            {storeKeys.map((store) => (
              <option key={store} value={store.toUpperCase()}>{store.toUpperCase()} Store</option>
            ))}
          </select>
          <ChevronDown size={14} color="#64748b" className="absolute right-3 pointer-events-none" />
        </div>
        )}
        <div className="w-[300px] relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search Styles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 bg-white border border-slate-200 rounded-xl text-[0.9rem] w-full outline-none focus:border-brand"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
