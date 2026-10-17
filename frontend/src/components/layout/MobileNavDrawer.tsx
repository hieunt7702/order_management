import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  Command,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigationStore';
import { useAuthStore } from '../../stores/authStore';
import { navigationGroups, type NavItem } from '../../config/navigation';

const COLOR_CLASSES: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    hoverBg: string;
    activeBg: string;
  }
> = {
  indigo: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20',
    hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
    activeBg: 'bg-indigo-50/80 dark:bg-indigo-950/50',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
    activeBg: 'bg-emerald-50/80 dark:bg-emerald-950/50',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/30',
    activeBg: 'bg-amber-50/80 dark:bg-amber-950/50',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    hoverBg: 'hover:bg-rose-50 dark:hover:bg-rose-950/30',
    activeBg: 'bg-rose-50/80 dark:bg-rose-950/50',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-950/30',
    activeBg: 'bg-purple-50/80 dark:bg-purple-950/50',
  },
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
    activeBg: 'bg-blue-50/80 dark:bg-blue-950/50',
  },
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-500/20',
    hoverBg: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/30',
    activeBg: 'bg-cyan-50/80 dark:bg-cyan-950/50',
  },
  orange: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/20',
    hoverBg: 'hover:bg-orange-50 dark:hover:bg-orange-950/30',
    activeBg: 'bg-orange-50/80 dark:bg-orange-950/50',
  },
};

export const MobileNavDrawer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobileMenuOpen, closeMobileMenu } = useNavigationStore();
  const { user, currentTenant, logout } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isDark, setIsDark] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Close drawer on route change
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => searchInputRef.current?.focus(), 150);
      return () => {
        document.body.style.overflow = '';
        clearTimeout(timer);
      };
    }
  }, [isMobileMenuOpen]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    if (!(document as any).startViewTransition) {
      document.documentElement.classList.toggle('dark', nextDark);
      setIsDark(nextDark);
      return;
    }
    (document as any).startViewTransition(() => {
      document.documentElement.classList.toggle('dark', nextDark);
      setIsDark(nextDark);
    });
  };

  const handleLogout = () => {
    closeMobileMenu();
    logout();
    navigate('/login');
  };

  // Filtered Navigation items
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return navigationGroups
      .map((group) => {
        if (selectedCategory !== 'ALL' && group.id !== selectedCategory) {
          return null;
        }

        const filteredItems = group.items.filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            item.shortName.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.href.toLowerCase().includes(query)
          );
        });

        if (filteredItems.length === 0) return null;

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter(Boolean) as typeof navigationGroups;
  }, [searchQuery, selectedCategory]);

  if (!isMobileMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden select-none animate-in fade-in duration-200">
      {/* Dark backdrop blur overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={closeMobileMenu}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-[#14151a] text-gray-900 dark:text-gray-100 h-full flex flex-col shadow-2xl z-10 border-r border-gray-200 dark:border-gray-800 animate-in slide-in-from-left duration-300 ease-out">
        {/* Top Header / Brand */}
        <div className="h-[64px] px-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#121317] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded bg-[#5865f2] text-white flex items-center justify-center shadow-xs shrink-0">
              <Command className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                {currentTenant?.name || 'Shopee Order'}
              </span>
              <span className="text-[11px] font-mono text-gray-400 truncate">
                {currentTenant?.code || 'WORKSPACE'} • {currentTenant?.role || 'Admin'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeMobileMenu}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Search Bar */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-[#14151a]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 shrink-0 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm nhanh chức năng (Đơn hàng, Kho, Thu chi...)"
              className="w-full pl-9 pr-8 py-2 rounded text-xs bg-gray-100 dark:bg-[#1a1b22] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#5865f2] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Tất cả
            </button>
            {navigationGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedCategory(g.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === g.id
                    ? 'bg-[#5865f2] text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {g.title.split('&')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Groups List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-600 dark:text-gray-300">
                Không tìm thấy chức năng phù hợp
              </p>
              <p className="text-[11px]">Thử tìm với từ khóa khác như: đơn, kho, thu chi, ncc</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="px-2 pt-1 pb-0.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {group.title}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.href);

                    const IconComponent = item.icon;
                    const colorStyle = COLOR_CLASSES[item.colorScheme] || COLOR_CLASSES.indigo;

                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        onClick={closeMobileMenu}
                        className={`flex items-start gap-3 p-2.5 rounded transition-all cursor-pointer group border ${
                          isActive
                            ? 'bg-[#5865f2]/10 dark:bg-[#5865f2]/15 border-[#5865f2]/30 dark:border-[#5865f2]/40 shadow-xs'
                            : 'bg-white dark:bg-[#181b22] border-gray-100 dark:border-gray-800/80 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#1d212a]'
                        }`}
                      >
                        {/* Icon Box */}
                        <div
                          className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} transition-transform group-active:scale-95`}
                        >
                          <IconComponent size={18} strokeWidth={2} />
                        </div>

                        {/* Text and Description */}
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-semibold truncate ${
                                isActive
                                  ? 'text-[#5865f2] dark:text-indigo-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.badge && (
                              <span
                                className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase ${
                                  item.badge === 'SCAN'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5 leading-tight">
                            {item.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ChevronRight
                          size={14}
                          className={`mt-2 shrink-0 transition-transform ${
                            isActive
                              ? 'text-[#5865f2]'
                              : 'text-gray-300 dark:text-gray-600 group-hover:translate-x-0.5'
                          }`}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions (User profile, Dark Mode, Logout) */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-[#121317] shrink-0 space-y-2">
          {/* User profile card */}
          <div className="flex items-center justify-between gap-2 p-2 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || 'Tài khoản'}
                </span>
                <span className="text-[10px] text-gray-400 truncate">
                  {user?.email}
                </span>
              </div>
            </div>

            {/* Dark mode switch */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
              title="Đổi giao diện Sáng / Tối"
            >
              {isDark ? (
                <Moon size={16} className="text-indigo-400" />
              ) : (
                <Sun size={16} className="text-amber-500" />
              )}
            </button>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Đăng xuất khỏi hệ thống</span>
          </button>
        </div>
      </div>
    </div>
  );
};
