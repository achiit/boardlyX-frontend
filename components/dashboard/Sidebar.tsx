import React from 'react';
import { LayoutDashboard, ListTodo, PieChart, LogOut, ChevronLeft, ChevronRight, Users, X, MessageCircle, Folder } from 'lucide-react';
import { useStore, type PageId } from '../../store/useStore';

const menuItems: { id: PageId; icon: React.ElementType; label: string }[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'tasks', icon: ListTodo, label: 'Tasks' },
  { id: 'teams', icon: Users, label: 'Teams' },
  { id: 'chat', icon: MessageCircle, label: 'Chat' },
  { id: 'resources', icon: Folder, label: 'Resources' },
  { id: 'analytics', icon: PieChart, label: 'Analytics' },
];

export const Sidebar: React.FC = () => {
  const { isSidebarOpen, toggleSidebar, logout, currentPage, setCurrentPage, isMobileMenuOpen, setMobileMenuOpen } = useStore();

  function handleNav(id: PageId) {
    setCurrentPage(id);
    setMobileMenuOpen(false);
  }

  return (
    <>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div
        className={`
          fixed left-0 top-0 h-full bg-[#1A1D25] border-r border-white/5 z-[60] flex flex-col transition-all duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isSidebarOpen ? 'w-64' : 'w-64 md:w-20'}
        `}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">
              <img src="/logo.png" alt="boardlyX logo" className="w-8 h-8 object-contain" />
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-display font-bold text-xl tracking-tight"></span>}
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="text-white/40 hover:text-white transition-colors md:hidden">
            <X size={20} />
          </button>
          <button onClick={toggleSidebar} className="text-white/40 hover:text-white transition-colors hidden md:block">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 mt-6">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group ${isActive ? 'gradient-accent text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                  >
                    <item.icon size={22} className={isActive ? 'text-white' : 'group-hover:text-white'} />
                    <span className={`font-medium ${isSidebarOpen || isMobileMenuOpen ? 'block' : 'hidden md:hidden'}`}>
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 mt-auto">
          <button
            onClick={() => { logout(); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
          >
            <LogOut size={22} />
            <span className={`font-medium ${isSidebarOpen || isMobileMenuOpen ? 'block' : 'hidden md:hidden'}`}>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};
