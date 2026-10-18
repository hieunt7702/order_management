import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Command, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { navigationGroups } from '../../config/navigation';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { currentTenant } = useAuthStore();
  const isDashboardActive = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <aside className="hidden lg:flex w-[275px] flex-shrink-0 bg-white dark:bg-[#14151a] border-r border-gray-200 dark:border-gray-800 flex-col transition-colors duration-300">
      {/* Header / Logo */}
      <Link
        to="/"
        className="h-[60px] flex items-center gap-2.5 px-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
        title="Trang chủ"
      >
        <div className="flex-none w-8 h-8 rounded bg-[#5865f2] text-white flex items-center justify-center shadow-xs">
          <Command className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="font-bold text-sm leading-tight text-gray-900 dark:text-white truncate"
            title={currentTenant?.name || 'Shopee Order'}
          >
            {currentTenant?.name || 'Shopee Order'}
          </span>
          <span className="text-[10px] font-medium text-gray-400 truncate">
            {currentTenant?.code || 'WORKSPACE'}
          </span>
        </div>
      </Link>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {/* Top-level Dashboard Link */}
        <div className="space-y-1">
          <Link
            to="/dashboard"
            data-active={isDashboardActive}
            className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-all duration-150 ${
              isDashboardActive
                ? 'bg-[#5865f2]/10 dark:bg-[#5865f2]/15 text-[#5865f2] dark:text-indigo-400 font-semibold shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1c212d] hover:text-gray-900 dark:hover:text-white font-medium'
            }`}
          >
            <BarChart3
              className={`w-[17px] h-[17px] flex-shrink-0 ${
                isDashboardActive
                  ? 'text-[#5865f2] dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            />
            <span className="truncate">Dashboard</span>
            {isDashboardActive && (
              <div className="ml-auto w-1.5 h-1.5 rounded bg-[#5865f2]" />
            )}
          </Link>
        </div>
        {navigationGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {group.title}
            </div>

            {group.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              const ItemIcon = item.icon;

              return (
                <Link
                  key={item.id}
                  to={item.href}
                  data-active={isActive}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-all duration-150 ${
                    isActive
                      ? 'bg-[#5865f2]/10 dark:bg-[#5865f2]/15 text-[#5865f2] dark:text-indigo-400 font-semibold shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1c212d] hover:text-gray-900 dark:hover:text-white font-medium'
                  }`}
                >
                  <ItemIcon
                    className={`w-[17px] h-[17px] flex-shrink-0 ${
                      isActive
                        ? 'text-[#5865f2] dark:text-indigo-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      {item.badge}
                    </span>
                  )}
                  {isActive && !item.badge && (
                    <div className="ml-auto w-1.5 h-1.5 rounded bg-[#5865f2]" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
        <span>Shopee Order v1.0</span>
        <span className="text-emerald-500 flex items-center gap-1 font-medium">
          <span className="w-1.5 h-1.5 rounded bg-emerald-500 animate-pulse" />
          Live API
        </span>
      </div>
    </aside>
  );
};
