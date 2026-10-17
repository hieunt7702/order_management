import React, { type ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  ShoppingBag,
  ScanLine,
  RotateCcw,
  FileSpreadsheet,
  Package,
  PackagePlus,
  Warehouse,
  Receipt,
  Store,
  Building2,
  Users,
  ShieldAlert,
  Settings,
  Command,
  Truck,
  CircleDollarSign,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  highlight?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: 'Nghiệp vụ chính',
    items: [
      { name: 'Tổng quan', href: '/', icon: LayoutGrid },
      { name: 'Đơn hàng', href: '/orders', icon: ShoppingBag },
      { name: 'Quét xuất hàng', href: '/scan', icon: ScanLine, highlight: true },
      { name: 'Xử lý đơn hoàn', href: '/order-returns', icon: RotateCcw },
      { name: 'Import Shopee', href: '/imports', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Kho & Sản phẩm',
    items: [
      { name: 'Sản phẩm & SKU', href: '/products', icon: Package },
      { name: 'Kho & Tồn kho', href: '/inventory', icon: Warehouse },
      { name: 'Nhập kho (Phiếu nhập)', href: '/purchase-receipts', icon: PackagePlus },
      { name: 'Nhà cung cấp', href: '/suppliers', icon: Truck },
    ],
  },
  {
    title: 'Tài chính & Shop',
    items: [
      { name: 'Thu chi & Đối soát tiền', href: '/cashflow', icon: CircleDollarSign, highlight: true },
      { name: 'Công nợ Nhà cung cấp', href: '/supplier-debts', icon: Building2 },
      { name: 'Đối soát tài chính', href: '/settlements', icon: Receipt },
      { name: 'Quản lý Shop', href: '/shops', icon: Store },
    ],
  },
  {
    title: 'Hệ thống & Quyền',
    items: [
      { name: 'Thành viên & Quyền', href: '/members', icon: Users },
      { name: 'Nhật ký kiểm toán', href: '/audit', icon: ShieldAlert },
      { name: 'Cài đặt hệ thống', href: '/settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { currentTenant } = useAuthStore();

  return (
    <aside className="hidden md:flex w-[270px] flex-shrink-0 bg-white dark:bg-[#14151a] border-r border-gray-200 dark:border-gray-800 flex-col transition-colors duration-300">
      {/* Header / Logo */}
      <div className="h-[60px] flex items-center gap-3 px-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-none w-8 h-8 rounded bg-[#5865f2] text-white flex items-center justify-center shadow-sm">
          <Command className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-sm leading-tight text-gray-900 dark:text-white truncate">
            {currentTenant?.name || 'Shopee Order'}
          </span>
          <span className="text-[10px] font-medium text-gray-400 truncate">
            {currentTenant?.code || 'WORKSPACE'}
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
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
                  key={item.name}
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
                  {item.highlight && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      SCAN
                    </span>
                  )}
                  {isActive && !item.highlight && (
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
