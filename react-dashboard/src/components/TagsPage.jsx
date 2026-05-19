import { useState } from 'react'
import { Tag, Search, RefreshCw, Plus, X, AlertTriangle, Check, Hash, Filter } from 'lucide-react'

const TOP_TAGS = [
  'Best Seller', 'New Arrival', 'Clearance', 'Exclusive', 'Limited Edition',
  'Trending', 'Staff Pick', 'Eco Friendly', 'Sale', 'Back in Stock',
]

const SPECIAL_TAGS = ['No PROM', 'No Formal', 'Discontinued', 'Push PROM']

export default function TagsPage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [customTags, setCustomTags] = useState(['Prom', 'Formal', 'Cocktail', 'Homecoming', 'Bridal'])
  const [newTag, setNewTag] = useState('')

  const tabs = [
    { id: 'all', label: 'All Tags' },
    { id: 'top', label: 'Top Tags' },
    { id: 'special', label: 'Special Tags' },
    { id: 'custom', label: 'Custom Tags' },
  ]

  const addTag = () => {
    const tag = newTag.trim()
    if (tag && !customTags.includes(tag)) {
      setCustomTags([...customTags, tag])
      setNewTag('')
    }
  }

  const removeTag = (tag) => {
    setCustomTags(customTags.filter((t) => t !== tag))
  }

  const filtered = (() => {
    const q = search.toLowerCase()
    if (activeTab === 'top') return TOP_TAGS.filter((t) => t.toLowerCase().includes(q))
    if (activeTab === 'special') return SPECIAL_TAGS.filter((t) => t.toLowerCase().includes(q))
    if (activeTab === 'custom') return customTags.filter((t) => t.toLowerCase().includes(q))
    return [...TOP_TAGS, ...SPECIAL_TAGS, ...customTags].filter((t) => t.toLowerCase().includes(q))
  })()

  return (
    <div className="py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Tags</h1>
        <p className="text-sm font-medium text-slate-400 mt-1">Manage product tags across all stores</p>
      </div>

      {/* Search & Add */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New tag name..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 w-48"
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Tag
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <AlertTriangle size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm font-medium text-blue-800">
          <strong>Store-Specific Tags:</strong> Tags can be managed per product in the{' '}
          <strong>Workspace → Merchandising mode</strong>. Click on a product to expand it and manage tags for each store individually.
        </div>
      </div>

      {/* Tag Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Tags */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Hash size={20} className="text-indigo-500" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Top Tags</h2>
          </div>
          <p className="text-xs font-medium text-slate-400 mb-4">Premium tags used to highlight products as "top" picks. Applied per product with <code className="text-indigo-600 bg-indigo-50 px-1 rounded">top:</code> prefix.</p>
          <div className="flex flex-wrap gap-2">
            {TOP_TAGS.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                <Hash size={12} />
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Special Tags */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Filter size={20} className="text-amber-500" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Special Tags</h2>
          </div>
          <p className="text-xs font-medium text-slate-400 mb-4">Toggle-based tags that control product flags and promotion eligibility.</p>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_TAGS.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold">
                <Filter size={12} />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tag List */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-5">
          {activeTab === 'all' ? 'All Tags' : activeTab === 'top' ? 'Top Tags' : activeTab === 'special' ? 'Special Tags' : 'Custom Tags'}
          <span className="ml-2 text-slate-400 font-bold">({filtered.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {filtered.map((tag) => {
            const isTop = TOP_TAGS.includes(tag)
            const isSpecial = SPECIAL_TAGS.includes(tag)
            const isCustom = customTags.includes(tag)
            return (
              <div key={tag} className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                ${isTop ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : ''}
                ${isSpecial ? 'bg-amber-50 border-amber-100 text-amber-700' : ''}
                ${isCustom ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : ''}
                ${!isTop && !isSpecial && !isCustom ? 'bg-slate-50 border-slate-200 text-slate-600' : ''}
              `}>
                <Hash size={12} />
                {tag}
                {isCustom && (
                  <button onClick={() => removeTag(tag)} className="opacity-0 group-hover:opacity-100 transition-all cursor-pointer ml-1 hover:text-red-500">
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-sm text-slate-400 font-medium py-4">No tags match your search.</div>
          )}
        </div>
      </div>
    </div>
  )
}
