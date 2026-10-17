import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { MobileNavDrawer } from './MobileNavDrawer';
import { useNavigationStore } from '../../stores/navigationStore';
import {
  Home,
  ShoppingBag,
  ScanLine,
  Boxes,
  LayoutGrid,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { isMobileMenuOpen, toggleMobileMenu } = useNavigationStore();

  const isHomeActive = location.pathname === '/';
  const isOrdersActive = location.pathname.startsWith('/orders');
  const isScanActive =
    location.pathname === '/scan' ||
    location.pathname.startsWith('/scan') ||
    location.pathname === '/scan-orders';
  const isInventoryActive =
    location.pathname.startsWith('/inventory') ||
    location.pathname.startsWith('/products');

  return (
    <div className="flex h-[100dvh] bg-[#f9f9fa] dark:bg-[#0f1115] text-[#151a1e] dark:text-[#dcddde] overflow-hidden font-sans transition-colors duration-300">
      <Sidebar />
      <MobileNavDrawer />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f9f9fa] dark:bg-[#0f1115]">
        {/* Hide system header on mobile and tablet when on barcode scan screen */}
        <div className={isScanActive ? 'hidden lg:block' : ''}>
          <AppHeader />
        </div>

        {/* Page Content */}
        <main
          className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar [-webkit-overflow-scrolling:touch] ${
            isScanActive
              ? 'p-2.5 sm:p-3.5 md:px-5 md:py-4 pb-28 md:pb-6'
              : 'p-3.5 sm:p-5 md:px-6 md:py-5 pb-32 md:pb-6'
          }`}
        >
          <div className="flex-1 flex flex-col min-h-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile Floating Glass Pill Navbar (md:hidden) */}
        <div
          className="fixed z-40 md:hidden left-4 right-4 max-w-md mx-auto pb-0 pointer-events-none"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          <nav className="pointer-events-auto bg-white/40 dark:bg-[#0c0e14]/70 backdrop-blur-[40px] backdrop-saturate-[200%] text-slate-600 dark:text-slate-300 shadow-[0_12px_40px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.14)] dark:border-white/15 rounded-[32px] flex items-center justify-around h-[68px] px-2 relative overflow-visible">
            {/* Top specular reflection line */}
            <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

            {/* 1. Trang chủ (Home) */}
            <Link
              to="/"
              data-active={isHomeActive}
              className="flex flex-col items-center justify-center w-16 h-full transition-colors relative group"
              title="Trang chủ"
            >
              <Home
                strokeWidth={isHomeActive ? 1.4 : 1.25}
                className={`w-[24px] h-[24px] transition-all duration-300 z-10 ${
                  isHomeActive
                    ? 'text-[#5865f2] dark:text-[#7b85f5] scale-110 drop-shadow-[0_2px_10px_rgba(88,101,242,0.45)]'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white group-hover:scale-110'
                }`}
              />
              {isHomeActive && (
                <span className="absolute bottom-2 w-1.5 h-1.5 bg-[#5865f2] dark:bg-[#7b85f5] rounded-full shadow-[0_0_8px_rgba(88,101,242,0.8)]" />
              )}
            </Link>

            {/* 2. Đơn hàng Shopee */}
            <Link
              to="/orders"
              data-active={isOrdersActive}
              className="flex flex-col items-center justify-center w-16 h-full transition-colors relative group"
              title="Quản lý Đơn hàng"
            >
              <ShoppingBag
                strokeWidth={isOrdersActive ? 1.4 : 1.25}
                className={`w-[24px] h-[24px] transition-all duration-300 z-10 ${
                  isOrdersActive
                    ? 'text-[#5865f2] dark:text-[#7b85f5] scale-110 drop-shadow-[0_2px_10px_rgba(88,101,242,0.45)]'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white group-hover:scale-110'
                }`}
              />
              {isOrdersActive && (
                <span className="absolute bottom-2 w-1.5 h-1.5 bg-[#5865f2] dark:bg-[#7b85f5] rounded-full shadow-[0_0_8px_rgba(88,101,242,0.8)]" />
              )}
            </Link>

            {/* 3. Center Elevated Action Button: Quét xuất hàng */}
            <div className="relative w-20 h-full flex justify-center">
              <Link
                to="/scan"
                data-active={isScanActive}
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-[60px] h-[60px] outline-none group z-50 flex items-center justify-center"
                title="Quét barcode xuất hàng"
              >
                {/* Pulsing glow backdrop aura */}
                <div
                  className={`absolute -inset-1.5 rounded-full bg-gradient-to-tr from-[#5865f2] to-[#818cf8] blur-md transition-opacity duration-300 animate-pulse ${
                    isScanActive
                      ? 'opacity-85 scale-110'
                      : 'opacity-45 group-hover:opacity-75'
                  }`}
                />

                {/* Primary elevated button circular body */}
                <div
                  className={`absolute inset-0 bg-gradient-to-tr from-[#404eed] via-[#5865f2] to-[#7983f5] rounded-full shadow-[0_8px_24px_rgba(88,101,242,0.55)] flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-active:scale-95 ${
                    isScanActive ? 'scale-105' : ''
                  }`}
                >
                  {/* Subtle specular sheen on hover */}
                  <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Icon with interactive tilt */}
                  <ScanLine
                    strokeWidth={1.4}
                    className="w-[28px] h-[28px] text-white group-hover:rotate-12 transition-transform duration-300 relative z-10"
                  />
                </div>
              </Link>
            </div>

            {/* 4. Hàng tồn kho */}
            <Link
              to="/inventory"
              data-active={isInventoryActive}
              className="flex flex-col items-center justify-center w-16 h-full transition-colors relative group"
              title="Hàng tồn kho"
            >
              <Boxes
                strokeWidth={isInventoryActive ? 1.4 : 1.25}
                className={`w-[24px] h-[24px] transition-all duration-300 z-10 ${
                  isInventoryActive
                    ? 'text-[#5865f2] dark:text-[#7b85f5] scale-110 drop-shadow-[0_2px_10px_rgba(88,101,242,0.45)]'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white group-hover:scale-110'
                }`}
              />

              {isInventoryActive && (
                <span className="absolute bottom-2 w-1.5 h-1.5 bg-[#5865f2] dark:bg-[#7b85f5] rounded-full shadow-[0_0_8px_rgba(88,101,242,0.8)]" />
              )}
            </Link>

            {/* 5. Tất cả chức năng (Open Drawer) */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="flex flex-col items-center justify-center w-16 h-full transition-colors relative group cursor-pointer"
              title="Tất cả chức năng"
            >
              <LayoutGrid
                strokeWidth={isMobileMenuOpen ? 1.4 : 1.25}
                className={`w-[24px] h-[24px] transition-all duration-300 z-10 ${
                  isMobileMenuOpen
                    ? 'text-[#5865f2] dark:text-[#7b85f5] scale-110 drop-shadow-[0_2px_10px_rgba(88,101,242,0.45)]'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white group-hover:scale-110'
                }`}
              />

              {isMobileMenuOpen && (
                <span className="absolute bottom-2 w-1.5 h-1.5 bg-[#5865f2] dark:bg-[#7b85f5] rounded-full shadow-[0_0_8px_rgba(88,101,242,0.8)]" />
              )}
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

