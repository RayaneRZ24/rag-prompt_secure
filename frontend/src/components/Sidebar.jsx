import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, MessageSquare, ShieldCheck, ScrollText, LogOut, Shield,
} from 'lucide-react'

const links = [
  { to: '/',       icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/chat',   icon: MessageSquare,   label: 'Chat RAG'       },
  { to: '/tests',  icon: ShieldCheck,     label: 'Security Tests' },
  { to: '/logs',   icon: ScrollText,      label: 'Logs'           },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-black border-r border-zinc-800 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
        <div className="p-2 bg-red-600 rounded-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base">RAG Secure</p>
          <p className="text-zinc-500 text-sm">Système sécurisé</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/40'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`
            }>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold uppercase">
            {user?.[0] ?? 'U'}
          </div>
          <div>
          <p className="text-white text-base font-medium">{user}</p>
          <p className="text-zinc-500 text-sm">Administrateur</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-red-950 hover:text-red-400 text-base transition-colors">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </div>
    </aside>
  )
}
