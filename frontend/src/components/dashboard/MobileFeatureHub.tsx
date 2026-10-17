import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  X,
  ScanLine,
  FileText,
  PackagePlus,
  Home,
} from 'lucide-react';
import { navigationGroups } from '../../config/navigation';

export const MobileFeatureHub: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter items in real time when searching
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return navigationGroups;
    }

    const q = searchQuery.toLowerCase().trim();
    return navigationGroups
      .map((group) => {
        const matchingItems = group.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.shortName.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        );
        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="lg:hidden space-y-4 pb-2 animate-in fade-in duration-200">
      {/* 1. Page Title & Subtitle */}
      <div className="pt-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
          Trang chủ
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Truy cập nhanh công việc của bạn
        </p>
      </div>

      {/* 2. Search Input */}
      <div className="relative w-full">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm chức năng..."
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#161922] border border-gray-200 dark:border-[#222736] rounded-xl text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#5865f2] transition-colors shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            title="Xóa tìm kiếm"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 3. Thao tác nhanh (Quick Actions) */}
      {!searchQuery && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
            Thao tác nhanh
          </h2>

          <div className="bg-white dark:bg-[#161922] border border-gray-200 dark:border-[#222736] rounded-2xl grid grid-cols-3 divide-x divide-gray-100 dark:divide-[#222736] overflow-hidden shadow-2xs">
            {/* Action 1: Quét xuất hàng (Highlighted) */}
            <Link
              to="/scan"
              className="flex flex-col items-center justify-center py-4 px-2 gap-2 text-center hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 active:bg-indigo-100/60 dark:active:bg-indigo-900/30 transition-colors group cursor-pointer"
            >
              <div className="text-[#5865f2] dark:text-[#7b85f5] group-hover:scale-110 transition-transform">
                <ScanLine size={24} strokeWidth={1.9} />
              </div>
              <span className="text-xs font-semibold text-[#5865f2] dark:text-[#7b85f5] leading-tight">
                Quét xuất hàng
              </span>
            </Link>

            {/* Action 2: Đơn hàng */}
            <Link
              to="/orders"
              className="flex flex-col items-center justify-center py-4 px-2 gap-2 text-center hover:bg-gray-50 dark:hover:bg-white/[0.03] active:bg-gray-100 dark:active:bg-white/[0.06] transition-colors group cursor-pointer"
            >
              <div className="text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform">
                <FileText size={24} strokeWidth={1.8} />
              </div>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">
                Đơn hàng
              </span>
            </Link>

            {/* Action 3: Nhập kho */}
            <Link
              to="/purchase-receipts"
              className="flex flex-col items-center justify-center py-4 px-2 gap-2 text-center hover:bg-gray-50 dark:hover:bg-white/[0.03] active:bg-gray-100 dark:active:bg-white/[0.06] transition-colors group cursor-pointer"
            >
              <div className="text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform">
                <PackagePlus size={24} strokeWidth={1.8} />
              </div>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">
                Nhập kho
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. Tất cả chức năng (All Features Categorized Grid) */}
      <div className="space-y-3 pt-1">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
          Tất cả chức năng
        </h2>

        {filteredGroups.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-white dark:bg-[#161922] border border-gray-200 dark:border-[#222736] text-xs text-gray-400">
            Không tìm thấy chức năng nào phù hợp với "{searchQuery}"
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                {/* Category Header */}
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                  {group.title}
                </div>

                {/* 2-Column Grid Card Container */}
                <div className="bg-white dark:bg-[#161922] border border-gray-200 dark:border-[#222736] rounded-2xl grid grid-cols-2 divide-x divide-gray-100 dark:divide-[#222736] divide-y divide-gray-100 dark:divide-[#222736] overflow-hidden shadow-2xs">
                  {group.items.map((item) => {
                    const IconComp = item.icon || Home;
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        className="flex items-center gap-3 px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] active:bg-gray-100 dark:active:bg-white/[0.06] transition-colors group cursor-pointer"
                      >
                        <div className="text-[#5865f2] dark:text-[#7b85f5] group-hover:scale-110 transition-transform shrink-0">
                          <IconComp size={20} strokeWidth={1.8} />
                        </div>
                        <span className="text-xs sm:text-[13px] font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors truncate">
                          {item.shortName || item.name}
                        </span>
                      </Link>
                    );
                  })}

                  {/* Even-alignment empty placeholder block if odd number of items */}
                  {group.items.length % 2 !== 0 && (
                    <div className="px-3.5 py-3 bg-transparent select-none pointer-events-none" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
