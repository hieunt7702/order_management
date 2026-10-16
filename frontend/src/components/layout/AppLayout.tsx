import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { LayoutGrid, ShoppingBag, QrCode, Warehouse, Settings } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex h-[100dvh] bg-[#f9f9fa] dark:bg-[#0f1115] text-[#151a1e] dark:text-[#dcddde] overflow-hidden font-sans transition-colors duration-300">
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f9f9fa] dark:bg-[#0f1115]">
        <AppHeader />

        {/* Page Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 md:px-6 md:py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-5">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (md:hidden) - eMoney Liquid Glass Style Sát Bottom */}
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40">
          <nav className="relative w-full rounded-t-[20px] bg-white/75 dark:bg-[#11141e]/80 backdrop-blur-2xl backdrop-saturate-[190%] border-t border-white/60 dark:border-white/10 shadow-[0_-6px_28px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-around px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
            {/* Liquid glass top specular highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none rounded-t-[20px]" />

            {/* Tổng quan */}
            <Link
              to="/"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                location.pathname === '/'
                  ? 'text-[#5865f2] dark:text-[#7b85f5]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Tổng quan"
            >
              <LayoutGrid size={21} className={location.pathname === '/' ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              {location.pathname === '/' && (
                <span className="w-1 h-1 rounded-full bg-[#5865f2] dark:bg-[#7b85f5] mt-1 shadow-xs" />
              )}
            </Link>

            {/* Đơn hàng */}
            <Link
              to="/orders"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                location.pathname.startsWith('/orders')
                  ? 'text-[#5865f2] dark:text-[#7b85f5]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Đơn hàng"
            >
              <ShoppingBag size={21} className={location.pathname.startsWith('/orders') ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              {location.pathname.startsWith('/orders') && (
                <span className="w-1 h-1 rounded-full bg-[#5865f2] dark:bg-[#7b85f5] mt-1 shadow-xs" />
              )}
            </Link>

            {/* Central Elevated QR Button with Liquid Orb Glow */}
            <Link
              to="/scan"
              className="flex items-center justify-center -mt-6 flex-1 group relative z-10"
              title="Quét barcode"
            >
              {/* Liquid ambient backdrop glow */}
              <div
                className={`absolute w-14 h-14 rounded-full blur-xl pointer-events-none transition-all duration-300 ${
                  location.pathname === '/scan'
                    ? 'bg-[#5865f2]/80 scale-125'
                    : 'bg-[#5865f2]/50 scale-100'
                }`}
              />
              <div
                className={`relative w-[54px] h-[54px] rounded-full flex items-center justify-center text-white transition-all ring-[3.5px] ring-white/90 dark:ring-[#11141e] shadow-[0_8px_24px_rgba(88,101,242,0.45)] ${
                  location.pathname === '/scan'
                    ? 'bg-gradient-to-tr from-[#4351df] via-[#5865f2] to-[#7b85f5] scale-105'
                    : 'bg-gradient-to-tr from-[#5865f2] to-[#6d79f3] active:scale-95'
                }`}
              >
                <QrCode size={26} className="stroke-[2.2]" />
              </div>
            </Link>

            {/* Kho & Tồn */}
            <Link
              to="/inventory"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                location.pathname.startsWith('/inventory')
                  ? 'text-[#5865f2] dark:text-[#7b85f5]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Kho & Tồn"
            >
              <Warehouse size={21} className={location.pathname.startsWith('/inventory') ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              {location.pathname.startsWith('/inventory') && (
                <span className="w-1 h-1 rounded-full bg-[#5865f2] dark:bg-[#7b85f5] mt-1 shadow-xs" />
              )}
            </Link>

            {/* Cài đặt */}
            <Link
              to="/settings"
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                location.pathname.startsWith('/settings')
                  ? 'text-[#5865f2] dark:text-[#7b85f5]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title="Cài đặt"
            >
              <Settings size={21} className={location.pathname.startsWith('/settings') ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
              {location.pathname.startsWith('/settings') && (
                <span className="w-1 h-1 rounded-full bg-[#5865f2] dark:bg-[#7b85f5] mt-1 shadow-xs" />
              )}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
};
