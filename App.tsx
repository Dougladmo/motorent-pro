import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Payments } from './pages/Payments';
import { Motorcycles } from './pages/Motorcycles';
import { Subscribers } from './pages/Subscribers';
import { Architecture } from './pages/Architecture';
import { AppProvider } from './context/AppContext';
import { Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'payments': return <Payments />;
      case 'motorcycles': return <Motorcycles />;
      case 'subscribers': return <Subscribers />;
      case 'architecture': return <Architecture />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
            <div className="font-bold text-slate-800 flex items-center gap-2">
                MotoRent Pro
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
                <Menu size={24} />
            </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {renderPage()}
            </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
