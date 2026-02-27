import React from 'react';
import { Search, Menu, MessageCircle, CheckCircle2, LogOut } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { NotificationPopup } from './NotificationPopup';
import * as api from '../../src/services/api';

export const TopNav: React.FC = () => {
  const { auth, setMobileMenuOpen, updateUser } = useStore();

  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showDisconnectMenu, setShowDisconnectMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDisconnectMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConnectTelegram = () => {
    if (!auth.user?.username) return;
    const baseUrl = (import.meta as any).env?.VITE_TELEGRAM_BOT_URL || 'https://t.me/updatesBoadlyXbot';
    const botUrl = `${baseUrl}?start=${auth.user.username}`;
    window.open(botUrl, '_blank');
  };

  const handleDisconnectTelegram = async () => {
    try {
      setIsDisconnecting(true);
      setShowDisconnectMenu(false);
      await api.disconnectTelegram();
      await refreshProfile();
    } catch (err) {
      console.error('Failed to disconnect telegram', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const refreshProfile = React.useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const user = await api.getProfile();
      updateUser(user);
    } catch (err) {
      console.error('Failed to refresh profile', err);
    }
  }, [auth.isAuthenticated, updateUser]);

  React.useEffect(() => {
    const handleFocus = () => {
      refreshProfile();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshProfile]);

  return (
    <header className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 bg-[#0F1117]/80 backdrop-blur-md gap-3">
      <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all md:hidden flex-shrink-0">
        <Menu size={22} />
      </button>

      <div className="flex-1 max-w-xl hidden sm:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search projects, tasks, or team members..."
            className="w-full bg-[#1A1D25] border border-white/5 rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white placeholder:text-white/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          {auth.user?.id && (
            auth.user.telegram_username ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowDisconnectMenu(!showDisconnectMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all text-sm font-medium"
                >
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="hidden sm:inline">Connected to Telegram as @{auth.user.telegram_username}</span>
                  <span className="sm:hidden">@{auth.user.telegram_username}</span>
                </button>

                {showDisconnectMenu && (
                  <div className="absolute top-12 left-0 w-full sm:w-auto sm:min-w-[200px] bg-[#1A1D25] border border-white/5 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <button
                      onClick={handleDisconnectTelegram}
                      disabled={isDisconnecting}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Disconnect Telegram</span>
                      <LogOut size={16} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleConnectTelegram}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2AABEE]/10 text-[#2AABEE] hover:bg-[#2AABEE]/20 border border-[#2AABEE]/30 transition-all text-sm font-medium"
              >
                <MessageCircle size={16} />
                <span className="hidden sm:inline">Connect Telegram</span>
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <NotificationPopup />

          <div className="flex items-center gap-3 pl-3 md:pl-4 border-l border-white/5">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-white">{auth.user?.name || 'User'}</p>
              <p className="text-xs text-white/40">{auth.user?.username ? `@${auth.user.username}` : auth.user?.email || ''}</p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden ring-2 ring-white/5 flex-shrink-0">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.user?.name || 'boardlyx'}`} alt="avatar" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
