import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bike, Users, Banknote, BookOpen } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/payments', label: 'Cobranças', icon: <Banknote size={20} /> },
    { path: '/motorcycles', label: 'Motos', icon: <Bike size={20} /> },
    { path: '/subscribers', label: 'Assinantes', icon: <Users size={20} /> },
    { path: '/architecture', label: 'Arquitetura', icon: <BookOpen size={20} /> },
  ];

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
        fixed top-0 left-0 z-30 h-screen w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static
      `}>
        <div className="flex items-center justify-center h-16 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bike className="text-blue-400" size={28} />
            <h1 className="text-xl font-bold tracking-tight">MotoRent<span className="text-blue-400">Pro</span></h1>
          </div>
        </div>

        <nav className="mt-6 px-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => `
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 text-slate-400">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    A
                </div>
                <div>
                    <p className="text-sm font-medium text-white">Admin User</p>
                    <p className="text-xs">Dono da Loja</p>
                </div>
            </div>
        </div>
      </aside>
    </>
  );
};
