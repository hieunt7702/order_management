import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Store,
  Warehouse,
  Building2,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { shopsApi } from '../../services/shopsApi';
import { warehousesApi } from '../../services/warehousesApi';
import { Select } from '../ui/Select';
import { useClickOutside } from '../../hooks/useClickOutside';

export const AppHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, currentTenant, memberships, switchTenant, logout } =
    useAuthStore();
  const {
    selectedShopId,
    setSelectedShopId,
    selectedWarehouseId,
    setSelectedWarehouseId,
    shops,
    warehouses,
    setContextData,
  } = useWorkspaceStore();

  const [isDark, setIsDark] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Robust click outside hook for user avatar menu
  useClickOutside(() => setIsUserMenuOpen(false), isUserMenuOpen, userMenuRef);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    loadContextData();
  }, [currentTenant?.id]);

  const loadContextData = async () => {
    if (!currentTenant?.id) return;
    try {
      const [fetchedShops, fetchedWhs] = await Promise.all([
        shopsApi.findAll(),
        warehousesApi.findAll(),
      ]);
      setContextData({ shops: fetchedShops, warehouses: fetchedWhs });
    } catch (err) {
      console.error('Error fetching shops/warehouses context:', err);
    }
  };

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
    logout();
    navigate('/login');
  };

  const isWarehouseRelevantPage =
    location.pathname.startsWith('/inventory') ||
    location.pathname.startsWith('/scan');

  return (
    <header className="flex-shrink-0 bg-white dark:bg-[#14151a] border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 flex items-center justify-between z-20 transition-colors pt-[env(safe-area-inset-top,0px)] h-[calc(60px+env(safe-area-inset-top,0px))]">
      {/* Left: Context Selectors (Shop & Warehouse) */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Shop Selector */}
        <div className="flex items-center">
          <Select
            value={selectedShopId || 'ALL'}
            onChange={(val) => setSelectedShopId(String(val))}
            options={[
              { value: 'ALL', label: 'Tất cả Shop', icon: Store },
              ...shops.map((s: any) => ({
                value: s.id,
                label: `${s.name} (${s.code || s.name})`,
                icon: Store,
              })),
            ]}
            placeholder="Tất cả Shop"
            icon={Store}
            size="sm"
            className="w-28 sm:w-44 md:w-48"
            menuWidth="w-56"
          />
        </div>

        {/* Warehouse Selector (Only on warehouse-relevant screens) */}
        {isWarehouseRelevantPage && warehouses.length > 0 && (
          <div className="flex items-center">
            <Select
              value={selectedWarehouseId || ''}
              onChange={(val) => setSelectedWarehouseId(String(val))}
              options={[
                { value: '', label: 'Tất cả kho', icon: Warehouse },
                ...warehouses.map((w: any) => ({
                  value: w.id,
                  label: w.name,
                  icon: Warehouse,
                })),
              ]}
              placeholder="Chọn kho..."
              icon={Warehouse}
              size="sm"
              className="w-28 sm:w-40 md:w-44"
              menuWidth="w-52"
            />
          </div>
        )}
      </div>

      {/* Right: Actions, Theme Toggle, User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
        {/* Refresh Context Button */}
        <button
          onClick={loadContextData}
          className="hidden sm:flex p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Làm mới dữ liệu shop/kho"
        >
          <RefreshCw size={15} />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          title="Đổi chủ đề sáng/tối"
        >
          {isDark ? (
            <Moon size={16} className="text-indigo-400" />
          ) : (
            <Sun size={16} className="text-amber-500" />
          )}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-[#5865f2] text-white flex items-center justify-center font-medium text-xs shadow-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                {user?.name || 'Tài khoản'}
              </span>
              <span className="text-xs text-gray-400 font-normal">
                {currentTenant?.role || 'User'}
              </span>
            </div>
            <ChevronDown size={13} className="text-gray-400 hidden md:block" />
          </button>

          {/* Mobile backdrop for avatar dropdown */}
          {isUserMenuOpen && (
            <div
              className="sm:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs cursor-pointer"
              onClick={() => setIsUserMenuOpen(false)}
              onTouchStart={() => setIsUserMenuOpen(false)}
            />
          )}

          {isUserMenuOpen && (
            <div className="fixed sm:absolute right-2 sm:right-0 top-[64px] sm:top-auto sm:mt-2 w-[calc(100vw-16px)] sm:w-64 rounded bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 shadow-2xl py-1.5 z-50 animate-slide-up sm:animate-fade-in text-xs">
              {/* User Identity Header */}
              <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
                  {user?.name || 'Tài khoản'}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              {/* Current Workspace Section */}
              <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-[#141822]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Building2 size={12} className="text-[#5865f2]" /> Workspace
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-[#5865f2]/10 text-[#5865f2] dark:text-indigo-400 border border-[#5865f2]/20">
                    {currentTenant?.role}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {currentTenant?.name || 'Workspace'}
                </p>
              </div>

              {/* Switch Workspace list if multiple */}
              {memberships.length > 1 && (
                <div className="py-1 border-b border-gray-100 dark:border-gray-800">
                  <div className="px-3.5 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Đổi Workspace ({memberships.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar">
                    {memberships.map((m) => {
                      const isActive = m.tenantId === currentTenant?.id;
                      return (
                        <button
                          key={m.tenantId}
                          onClick={() => {
                            switchTenant(m.tenantId);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#5865f2]/10 text-[#5865f2] dark:text-indigo-400 font-semibold'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">
                            {m.tenantName}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-normal shrink-0">
                            {m.role}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Logout button */}
              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
