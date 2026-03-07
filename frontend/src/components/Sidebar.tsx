import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bike, Users, Banknote, HelpCircle, UserCog, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/payments', label: 'Cobranças', icon: <Banknote size={20} /> },
    { path: '/motorcycles', label: 'Motos', icon: <Bike size={20} /> },
    { path: '/subscribers', label: 'Assinantes', icon: <Users size={20} /> },
    { path: '/users', label: 'Usuários', icon: <UserCog size={20} /> },
    { path: '/architecture', label: 'Como usar', icon: <HelpCircle size={20} /> },
  ];

  const emailInitial = user?.email?.charAt(0).toUpperCase() ?? 'A';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-30 h-screen bg-white border-r border-slate-200
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static
      `}>
        {/* Header: logo + collapse button */}
        <div className="flex items-center py-4 border-b border-slate-200 px-4 relative">
          <div className={`flex-1 flex items-center justify-center overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            <img src="/logo.png" alt="Norte Motos" className="h-16 w-auto object-contain" />
          </div>
          {isCollapsed && (
            <div className="flex-1 flex items-center justify-center">
              <img src="/logo.png" alt="Norte Motos" className="h-8 w-8 object-contain" />
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white hover:bg-blue-600 border border-slate-200 rounded-full items-center justify-center text-slate-500 hover:text-white transition-colors z-10 shadow-sm"
            title={isCollapsed ? 'Expandir menu' : 'Contrair menu'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        <nav className="mt-6 px-3">
          {!isCollapsed && (
            <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-widest text-orange-500">Menu</p>
          )}
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setIsOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) => `
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isCollapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-blue-500 text-white border-l-4 border-orange-500 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-orange-500'}
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-200">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {emailInitial}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{user?.email ?? 'Admin'}</p>
                </div>
                <button
                  onClick={logout}
                  title="Sair"
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded flex-shrink-0"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={logout}
              title="Sair"
              className="mt-3 w-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
