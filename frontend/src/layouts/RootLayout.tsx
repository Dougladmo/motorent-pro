import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Menu, AlertTriangle, RefreshCw, X, Sun, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

export const RootLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const { error, refreshData } = useApp();
  const { theme, toggleTheme } = useTheme();

  const showError = !!error && !errorDismissed;

  const handleRetry = () => {
    setErrorDismissed(false);
    refreshData();
  };

  // Reset dismiss when error changes
  React.useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            Norte Motos
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-amber-500 transition-colors" title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Error Banner */}
        {showError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
            <p className="flex-1 text-sm text-red-700">
              <span className="font-semibold">Erro ao carregar dados: </span>
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>
            <button
              onClick={() => setErrorDismissed(true)}
              className="text-red-400 hover:text-red-600 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
