import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Search,
  LayoutGrid,
} from 'lucide-react';
import { navigationGroups, type NavItem } from '../../config/navigation';

const COLOR_CONFIG: Record<
  string,
  {
    gradient: string;
    text: string;
    border: string;
    glow: string;
  }
> = {
  indigo: {
    gradient: 'from-indigo-500/20 to-indigo-600/10 dark:from-indigo-500/30 dark:to-indigo-600/15',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-600/10 dark:from-emerald-500/30 dark:to-emerald-600/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]',
  },
  amber: {
    gradient: 'from-amber-500/20 to-amber-600/10 dark:from-amber-500/30 dark:to-amber-600/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  },
  rose: {
    gradient: 'from-rose-500/20 to-rose-600/10 dark:from-rose-500/30 dark:to-rose-600/15',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]',
  },
  purple: {
    gradient: 'from-purple-500/20 to-purple-600/10 dark:from-purple-500/30 dark:to-purple-600/15',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-600/10 dark:from-blue-500/30 dark:to-blue-600/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]',
  },
  cyan: {
    gradient: 'from-cyan-500/20 to-cyan-600/10 dark:from-cyan-500/30 dark:to-cyan-600/15',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(6,182,212,0.25)]',
  },
  orange: {
    gradient: 'from-orange-500/20 to-orange-600/10 dark:from-orange-500/30 dark:to-orange-600/15',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/60',
    glow: 'group-hover:shadow-[0_0_20px_rgba(249,115,22,0.25)]',
  },
};

export const MobileFeatureHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = useMemo(() => {
    let items = navigationGroups.flatMap((g) =>
      g.items.map((item) => ({ ...item, groupTitle: g.title, groupId: g.id }))
    );

    if (activeTab !== 'ALL') {
      items = items.filter((i) => i.groupId === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.shortName.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }

    return items;
  }, [activeTab, searchQuery]);

  return (
    <div className="lg:hidden space-y-3 p-3.5 sm:p-4 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 shadow-xs animate-in fade-in duration-300">
      {/* Header with Title and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center shrink-0">
            <LayoutGrid size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
              <span>Chức năng & Tiện ích hệ thống</span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] border border-indigo-200/50">
                {filteredItems.length}
              </span>
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Truy cập nhanh tất cả các màn hình quản lý và nghiệp vụ
            </p>
          </div>
        </div>

        {/* Search input in mobile hub */}
        <div className="relative w-full sm:w-60">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm chức năng..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#5865f2]"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            activeTab === 'ALL'
              ? 'bg-[#5865f2] text-white shadow-xs'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Tất cả (16)
        </button>
        {navigationGroups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveTab(g.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === g.id
                ? 'bg-[#5865f2] text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {g.title.split('&')[0].trim()} ({g.items.length})
          </button>
        ))}
      </div>

      {/* Grid of All Features */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
        {filteredItems.map((item) => {
          const IconComp = item.icon;
          const color = COLOR_CONFIG[item.colorScheme] || COLOR_CONFIG.indigo;

          return (
            <Link
              key={item.id}
              to={item.href}
              className={`p-2.5 rounded bg-white dark:bg-[#181b22] border border-gray-200/90 dark:border-gray-800 hover:border-[#5865f2]/60 dark:hover:border-[#5865f2]/60 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between active:scale-[0.98] ${color.glow}`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-2">
                {/* Modern Icon badge */}
                <div
                  className={`w-9 h-9 rounded bg-gradient-to-br ${color.gradient} ${color.text} border ${color.border} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
                >
                  <IconComp size={18} strokeWidth={2.2} />
                </div>

                {item.badge ? (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase ${
                      item.badge === 'SCAN'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  <ArrowRight
                    size={13}
                    className="text-gray-300 dark:text-gray-600 group-hover:text-[#5865f2] group-hover:translate-x-0.5 transition-all mt-1 shrink-0"
                  />
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-[#5865f2] transition-colors leading-snug line-clamp-1">
                  {item.shortName || item.name}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-snug">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
