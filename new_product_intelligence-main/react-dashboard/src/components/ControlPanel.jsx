import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, UserPlus, Link as LinkIcon, Globe, Check, X, LayoutDashboard, Settings, ChevronDown } from 'lucide-react'
import { authService } from '../services/api'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { fetchUsers } from '../features/users/usersSlice'

const PERMISSION_MODULES = [
  { id: 'perm_dashboard', label: 'Dashboard', icon: LayoutDashboard, color: '#A855F7', bg: '#F5F3FF' },
  { id: 'perm_settings', label: 'Control Panel', icon: Settings, color: '#EA580C', bg: '#FFEDD5' },
]

const inputCls = 'w-full px-3 py-3 border-[1.5px] border-slate-200 rounded-xl outline-none bg-white text-slate-900 text-[0.9rem] font-semibold focus:border-brand transition-all'
const labelCls = 'text-[0.7rem] font-extrabold text-slate-500 uppercase tracking-wider block mb-2'

const ControlPanel = ({ user: currentUser, sidebarLinks, setSidebarLinks }) => {
  const dispatch = useAppDispatch()
  const users = useAppSelector((state) => state.users.items)
  const loadingUsers = useAppSelector((state) => state.users.status === 'loading')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkIcon, setNewLinkIcon] = useState('link')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editRoleValue, setEditRoleValue] = useState('')
  const [editPermissions, setEditPermissions] = useState({})
  const [editPassword, setEditPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regRole, setRegRole] = useState('user')
  const [regPermissions, setRegPermissions] = useState({ perm_dashboard: true, perm_settings: false })
  const [isRegistering, setIsRegistering] = useState(false)

  const canManageTeam = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'

  useEffect(() => {
    if (canManageTeam) dispatch(fetchUsers())
  }, [canManageTeam, dispatch])

  const handleAddLink = (e) => {
    e.preventDefault()
    if (!newLinkLabel || !newLinkUrl) return
    setSidebarLinks([...sidebarLinks, { label: newLinkLabel, url: newLinkUrl, icon: newLinkIcon }])
    setNewLinkLabel('')
    setNewLinkUrl('')
  }

  const handleDeleteLink = (index) => setSidebarLinks(sidebarLinks.filter((_, i) => i !== index))

  const handleRegisterUser = async () => {
    if (!regName || !regPass) return toast.error('Please fill in name and password')
    setIsRegistering(true)
    try {
      const data = await authService.register(regName, regPass, regRole, regPermissions)
      if (data.success) { toast.success('User registered successfully!'); setRegName(''); setRegPass(''); dispatch(fetchUsers()) }
      else toast.error(data.message || 'Registration failed')
    } catch (err) {
      toast.error('Error registering user')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleStartEdit = (user) => {
    setEditingUserId(user.id)
    setEditRoleValue(user.role)
    const perms = {}
    PERMISSION_MODULES.forEach(m => { perms[m.id] = !!user[m.id] })
    setEditPermissions(perms)
    setEditPassword('')
  }

  const handleSaveUser = async (id) => {
    try {
      const data = await authService.updateUser(id, editRoleValue, editPermissions, editPassword)
      if (data.success) { dispatch(fetchUsers()); setEditingUserId(null); toast.success('User updated successfully') }
    } catch (err) {
      toast.error('Failed to update user')
    }
  }

  const toggleEditPermission = (permId) => setEditPermissions(prev => ({ ...prev, [permId]: !prev[permId] }))
  const toggleRegPermission = (permId) => setRegPermissions(prev => ({ ...prev, [permId]: !prev[permId] }))

  const selectCls = 'w-full px-3 py-3 border-[1.5px] border-slate-200 rounded-xl outline-none bg-white appearance-none text-[0.9rem] font-bold text-slate-900 cursor-pointer focus:border-brand transition-all'

  return (
    <div className="py-8 px-12 max-w-[1200px] mx-auto">
      <header className="mb-12">
        <h1 className="text-[2.25rem] font-black text-slate-900 tracking-tight m-0">
          Control{' '}
          <span className="bg-gradient-to-r from-brand to-indigo-500 bg-clip-text text-transparent">Panel</span>
        </h1>
        <p className="text-slate-500 text-[1.1rem] mt-2">Manage your dashboard links and team permissions</p>
      </header>

      {/* Sidebar Links */}
      <section className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm mb-12">
        <div className="mb-8">
          <h2 className="text-[1.25rem] font-extrabold text-slate-900 flex items-center gap-3 m-0">
            <LinkIcon size={22} color="#A855F7" /> Sidebar Navigation Links
          </h2>
          <p className="text-[0.9rem] text-slate-500 mt-1">Assign external brand dashboards or useful URLs.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="text-left border-b-2 border-slate-100">
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase">Label</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase">URL</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase">Type</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sidebarLinks.length === 0 && (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400 italic">No custom links added.</td></tr>
              )}
              {sidebarLinks.map((link, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-[18px] font-bold text-slate-900">{link.label}</td>
                  <td className="px-4 py-[18px]"><code className="bg-slate-100 px-2 py-1 rounded-md text-[0.85rem] text-brand">{link.url}</code></td>
                  <td className="px-4 py-[18px]">{link.icon === 'shopify' ? '🛍️ Shopify' : '🔗 Default'}</td>
                  <td className="px-4 py-[18px] text-right">
                    <button onClick={() => handleDeleteLink(idx)} className="bg-red-50 border border-red-200 p-2 rounded-xl text-red-600 cursor-pointer hover:bg-red-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAddLink} className="grid gap-6 p-8 bg-slate-50 rounded-[20px] border border-slate-200 items-end" style={{ gridTemplateColumns: '1fr 1fr 150px auto' }}>
          <div>
            <label className={labelCls}>Label</label>
            <input type="text" placeholder="e.g. Shopify Admin" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>URL</label>
            <input type="url" placeholder="https://" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Icon</label>
            <div className="relative flex items-center">
              <select value={newLinkIcon} onChange={(e) => setNewLinkIcon(e.target.value)} className={selectCls}>
                <option value="link">🔗 Default Link</option>
                <option value="shopify">🛍️ Shopify Admin</option>
              </select>
              <ChevronDown size={14} color="#64748b" className="absolute right-3 pointer-events-none" />
            </div>
          </div>
          <button type="submit" className="bg-brand text-white px-6 py-3 rounded-xl border-none font-extrabold cursor-pointer shadow-[0_4px_10px_rgba(168,85,247,0.2)] hover:bg-brand-dark transition-all">
            Add Link
          </button>
        </form>
      </section>

      {/* Team Access */}
      {canManageTeam ? (
        <section className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm">
          <div className="mb-8">
            <h2 className="text-[1.25rem] font-extrabold text-slate-900 flex items-center gap-3 m-0">
              <Shield size={22} color="#A855F7" /> Team Access & Module Control
            </h2>
            <p className="text-[0.9rem] text-slate-500 mt-1">Manage system roles and feature permissions.</p>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b-2 border-slate-100">
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase w-[25%]">User</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase w-[20%]">Role</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase w-[35%]">Active Modules</th>
                <th className="px-4 py-3 text-[0.75rem] font-extrabold text-slate-400 uppercase text-right w-[20%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400">Loading team members...</td></tr>
              ) : users.map(u => (
                <React.Fragment key={u.id}>
                  <tr className={`border-b border-slate-100 ${editingUserId === u.id ? 'bg-violet-50/30' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-4 py-[18px] font-bold text-slate-900">{u.username}</td>
                    <td className="px-4 py-[18px]">
                      {editingUserId === u.id ? (
                        <div className="relative flex items-center w-fit">
                          <select value={editRoleValue} onChange={(e) => setEditRoleValue(e.target.value)}
                            className="pl-2.5 pr-7 py-1.5 rounded-lg border-[1.5px] border-brand outline-none appearance-none bg-white text-[0.8rem] font-bold text-slate-900 cursor-pointer"
                          >
                            <option value="user">User Role</option>
                            <option value="admin">Admin Role</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                          <ChevronDown size={12} color="#A855F7" className="absolute right-2 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md text-[0.7rem] font-black uppercase">{u.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-[18px]">
                      <div className="flex gap-2 flex-wrap">
                        {PERMISSION_MODULES.map(m => {
                          const isActive = editingUserId === u.id ? editPermissions[m.id] : !!u[m.id]
                          if (!isActive && editingUserId !== u.id) return null
                          return (
                            <div
                              key={m.id}
                              onClick={() => editingUserId === u.id && toggleEditPermission(m.id)}
                              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[0.75rem] font-black transition-all ${editingUserId === u.id ? 'cursor-pointer' : 'cursor-default'} ${!isActive && editingUserId === u.id ? 'opacity-50' : ''}`}
                              style={{
                                background: isActive ? m.bg : '#f1f5f9',
                                color: isActive ? m.color : '#94a3b8',
                                border: editingUserId === u.id ? (isActive ? `1px solid ${m.color}` : '1px solid #e2e8f0') : 'none',
                              }}
                            >
                              <m.icon size={14} />
                              {m.label.toUpperCase()}
                              {editingUserId === u.id && (isActive ? <Check size={12} /> : <X size={12} />)}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-[18px] text-right">
                      {editingUserId === u.id ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleSaveUser(u.id)} className="bg-green-50 border border-green-200 text-green-700 p-1.5 rounded-lg cursor-pointer hover:bg-green-100 transition-all"><Check size={16} /></button>
                          <button onClick={() => setEditingUserId(null)} className="bg-red-50 border border-red-200 text-red-600 p-1.5 rounded-lg cursor-pointer hover:bg-red-100 transition-all"><X size={16} /></button>
                        </div>
                      ) : (
                        <button onClick={() => handleStartEdit(u)} className="bg-transparent border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[0.8rem] font-bold cursor-pointer hover:bg-slate-100 transition-all">
                          Settings
                        </button>
                      )}
                    </td>
                  </tr>
                  {editingUserId === u.id && (
                    <tr>
                      <td colSpan="4" className="px-4 pb-5 bg-violet-50/20">
                        <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-violet-200">
                          <label className="text-[0.75rem] font-extrabold text-slate-500 whitespace-nowrap">CHANGE PASSWORD:</label>
                          <input
                            type="password"
                            placeholder="Leave blank to keep current"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg flex-1 outline-none focus:border-brand text-[0.9rem]"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Register Section */}
          <div className="mt-10 p-10 bg-violet-50 rounded-3xl border border-violet-200">
            <h3 className="text-[1.1rem] font-extrabold text-brand mb-6 flex items-center gap-2.5 m-0">
              <UserPlus size={20} /> Register New Member
            </h3>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div>
                <label className={labelCls}>Username</label>
                <input type="text" placeholder="john_doe" value={regName} onChange={(e) => setRegName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" placeholder="••••••••" value={regPass} onChange={(e) => setRegPass(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Default Role</label>
                <div className="relative flex items-center">
                  <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className={selectCls}>
                    <option value="user">User (Standard Access)</option>
                    <option value="admin">Admin (Manager Access)</option>
                    <option value="super_admin">Super Admin (Full Control)</option>
                  </select>
                  <ChevronDown size={14} color="#64748b" className="absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <label className={`${labelCls} mb-4`}>Initial Permissions</label>
              <div className="flex gap-6">
                {PERMISSION_MODULES.map(m => (
                  <div
                    key={m.id}
                    onClick={() => toggleRegPermission(m.id)}
                    className="flex items-center gap-3 px-5 py-3.5 rounded-2xl cursor-pointer transition-all flex-1 border"
                    style={{
                      background: regPermissions[m.id] ? m.bg : 'white',
                      borderColor: regPermissions[m.id] ? m.color : '#E2E8F0',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: regPermissions[m.id] ? m.color : '#CBD5E1', background: regPermissions[m.id] ? m.color : 'transparent' }}
                    >
                      {regPermissions[m.id] && <Check size={14} color="white" />}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <m.icon size={20} color={regPermissions[m.id] ? m.color : '#64748B'} />
                      <span className="text-[0.9rem] font-extrabold" style={{ color: regPermissions[m.id] ? m.color : '#64748B' }}>{m.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleRegisterUser}
              disabled={isRegistering}
              className="w-full bg-brand text-white py-[18px] rounded-2xl border-none font-black text-[1.05rem] cursor-pointer shadow-[0_8px_20px_rgba(168,85,247,0.25)] hover:bg-brand-dark transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isRegistering ? 'Registering...' : 'Activate Account & Grant Access'}
            </button>
          </div>
        </section>
      ) : (
        <div className="p-12 text-center bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 text-slate-500">
          <Shield size={40} className="mb-4 opacity-50 mx-auto" />
          <h3 className="text-[1.25rem] font-extrabold text-slate-600">Administrative Section Restricted</h3>
          <p className="mt-2">You have access to manage Sidebar Links, but only Administrators can manage Team Access and Permissions.</p>
        </div>
      )}
    </div>
  )
}

export default ControlPanel
