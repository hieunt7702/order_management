import React from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { LayoutGrid, ShoppingBag, QrCode, Warehouse, Settings } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#f9f9fa] dark:bg-[#0f1115] text-[#151a1e] dark:text-[#dcddde] overflow-hidden font-sans transition-colors duration-300">
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f9f9fa] dark:bg-[#0f1115]">
        <AppHeader />

        {/* Page Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 md:px-6 md:py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-5">
          <Outlet />
        </main>

        {/* Floating Mobile Bottom Navigation Bar (md:hidden) */}
        <div
          className="md:hidden fixed inset-x-3.5 sm:inset-x-6 max-w-xl mx-auto z-40 pointer-events-none"
          style={{ bottom: 'calc(0.85rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <nav className="pointer-events-auto w-full h-[62px] rounded-full bg-white/90 dark:bg-[#161b26]/90 backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.6)] border border-gray-200/50 dark:border-gray-800/80 flex items-center justify-around px-3">
            {/* Tổng quan */}
            <Link
              to="/"
              className={`flex items-center justify-center flex-1 h-[62px] ${
                location.pathname === '/'
                  ? 'text-[#5865f2] dark:text-indigo-400 font-bold'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              title="Tổng quan"
            >
              <LayoutGrid size={21} />
            </Link>

            {/* Đơn hàng */}
            <Link
              to="/orders"
              className={`flex items-center justify-center flex-1 h-[62px] ${
                location.pathname.startsWith('/orders')
                  ? 'text-[#5865f2] dark:text-indigo-400 font-bold'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              title="Đơn hàng"
            >
              <ShoppingBag size={21} />
            </Link>

            {/* Central Elevated QR Button */}
            <Link
              to="/scan"
              className="flex items-center justify-center -mt-6 flex-1 group relative z-10"
              title="Quét barcode"
            >
              <div
                className={`absolute w-14 h-14 rounded blur-lg pointer-events-none transition-all duration-300 ${
                  location.pathname === '/scan'
                    ? 'bg-[#5865f2]/80 scale-125'
                    : 'bg-[#5865f2]/50 scale-100'
                }`}
              />
              <div
                className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center text-white transition-all shadow-lg ${
                  location.pathname === '/scan'
                    ? 'bg-gradient-to-tr from-[#5865f2] to-[#7b85f5] scale-105'
                    : 'bg-[#5865f2]'
                }`}
              >
                <QrCode size={28} className="stroke-[2.2]" />
              </div>
            </Link>

            {/* Kho & Tồn */}
            <Link
              to="/inventory"
              className={`flex items-center justify-center flex-1 h-[62px] ${
                location.pathname.startsWith('/inventory')
                  ? 'text-[#5865f2] dark:text-indigo-400 font-bold'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              title="Kho & Tồn"
            >
              <Warehouse size={21} />
            </Link>

            {/* Cài đặt */}
            <Link
              to="/settings"
              className={`flex items-center justify-center flex-1 h-[62px] ${
                location.pathname.startsWith('/settings')
                  ? 'text-[#5865f2] dark:text-indigo-400 font-bold'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
              title="Cài đặt"
            >
              <Settings size={21} />
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
};
