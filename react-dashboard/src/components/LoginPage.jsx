import { useState } from 'react'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { authService } from '../services/api'

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await authService.login(username, password)
      onLogin({ ...data.user, access_token: data.access_token })
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || err.message || 'Connection error. Please check if the API server is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-12 w-full max-w-md shadow-[0_25px_50px_-12px_rgba(168,85,247,0.1)] animate-fade-in">

        <div className="text-center mb-8">
          <h1 className="text-[28px] font-black mb-2 tracking-tight text-slate-900">
            The Dress Outlet{' '}
            <span className="bg-gradient-to-r from-brand to-indigo-500 bg-clip-text text-transparent">
              Intelligence
            </span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Secure Product Audit Dashboard</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold border border-red-200 mb-6">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 text-slate-500 text-[13px] font-semibold uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
              className="w-full px-[18px] py-3.5 bg-[#fdfdfd] border-[1.5px] border-slate-200 rounded-xl text-slate-900 text-[15px] outline-none transition-all focus:border-brand"
            />
          </div>

          <div>
            <label className="block mb-2 text-slate-500 text-[13px] font-semibold uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-[18px] py-3.5 bg-[#fdfdfd] border-[1.5px] border-slate-200 rounded-xl text-slate-900 text-[15px] outline-none transition-all focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-500 flex items-center"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-500 font-medium cursor-pointer">
            <input
              type="checkbox"
              className="w-4.5 h-4.5 accent-brand cursor-pointer"
              style={{ width: '18px', height: '18px' }}
            />
            Remember for 30 days
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand text-white rounded-xl text-base font-bold cursor-pointer transition-all shadow-[0_4px_12px_rgba(168,85,247,0.25)] hover:bg-brand-dark disabled:opacity-80 mt-6"
          >
            {loading ? 'Verifying...' : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
