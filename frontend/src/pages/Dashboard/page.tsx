import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Truck,
  ShoppingCart,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Boxes,
  Filter,
  ChevronDown,
  ListFilter,
  X,
  BarChart3,
  LayoutGrid,
  Store,
  Package,
  CheckCircle2,
  RotateCcw,
  CreditCard,
  PackageCheck,
  Receipt,
  Building2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { reportsApi } from '../../services/reportsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { formatCurrency } from '../../utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import { Select } from '../../components/ui/Select';
import { SystemDatePicker } from '../../components/ui/SystemDatePicker';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../../components/ui/Card';
import { MobileFeatureHub } from '../../components/dashboard/MobileFeatureHub';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { StatusChart } from '../../components/dashboard/StatusChart';

const SHOPEE_STATUS_OPTIONS = [
  {
    id: 'COMPLETED',
    label: 'Hoàn thành',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'TO_CONFIRM_RECEIVE',
    label: 'Đã giao (Chờ xác nhận)',
    badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    dotColor: 'bg-sky-500',
  },
  {
    id: 'SHIPPED',
    label: 'Đang giao hàng',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'READY_TO_SHIP',
    label: 'Chờ giao hàng',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'RETRY_SHIP',
    label: 'Giao lại',
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
  },
  {
    id: 'IN_CANCEL',
    label: 'Đang hủy',
    badgeClass: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
  {
    id: 'CANCELLED',
    label: 'Đã hủy',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'TO_RETURN',
    label: 'Trả hàng/Hoàn tiền',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
  },
  {
    id: 'RETURN_REFUND',
    label: 'Đã hoàn tiền',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
    dotColor: 'bg-fuchsia-500',
  },
  {
    id: 'UNPAID',
    label: 'Chưa thanh toán',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
  },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedShopId, setSelectedShopId, shops } = useWorkspaceStore();
  const isMobile = useIsMobile();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Multi-select Shopee Order Statuses
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState<boolean>(false);

  // System Products Search & Sort
  const [productSearch, setProductSearch] = useState<string>('');
  const [productSortBy, setProductSortBy] = useState<'sold' | 'imported' | 'onHand' | 'lowStock'>('sold');

  // Mobile Tab: 'hub' (Menu Chức năng) is DEFAULT on mobile when at '/', 'dashboard' when at '/dashboard'
  const searchParams = new URLSearchParams(location.search);
  const isDirectDashboard = location.pathname === '/dashboard' || searchParams.get('tab') === 'dashboard';
  const [mobileTab, setMobileTab] = useState<'hub' | 'dashboard'>(isDirectDashboard ? 'dashboard' : 'hub');

  // Keep mobileTab synced if URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === '/dashboard' || params.get('tab') === 'dashboard') {
      setMobileTab('dashboard');
    } else if (location.pathname === '/' && !params.get('tab')) {
      setMobileTab('hub');
    }
  }, [location.pathname, location.search]);

  const handleMobileTabChange = (tab: 'hub' | 'dashboard') => {
    setMobileTab(tab);
    if (tab === 'dashboard') {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const statusDrawerRef = useRef<HTMLDivElement>(null);
  useClickOutside(() => setIsStatusDropdownOpen(false), isStatusDropdownOpen, [statusDropdownRef, statusDrawerRef]);

  const toggleStatus = (statusId: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusId) ? prev.filter((s) => s !== statusId) : [...prev, statusId],
    );
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedShopId, fromDate, toDate, selectedStatuses]);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getDashboard({
        shopId: selectedShopId,
        startDate: fromDate || undefined,
        endDate: toDate || undefined,
        platformStatuses: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu báo cáo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mobile & Tablet Segmented Tab Switcher (lg:hidden) */}
      <div className="lg:hidden sticky top-0 z-30 pt-0.5 pb-1 bg-[#f9f9fa] dark:bg-[#0f1115] transition-colors">
        <div className="bg-gray-200/80 dark:bg-[#161922] p-1 rounded-xl border border-gray-200 dark:border-white/[0.08] grid grid-cols-2 gap-1 shadow-2xs">
          {/* Tab 1: Menu Chức năng (MẶC ĐỊNH TRÊN MOBILE) */}
          <button
            type="button"
            onClick={() => handleMobileTabChange('hub')}
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              mobileTab === 'hub'
                ? 'bg-white dark:bg-[#202533] text-[#5865f2] dark:text-[#7b85f5] shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid
              size={15}
              className={mobileTab === 'hub' ? 'text-[#5865f2] dark:text-[#7b85f5]' : 'text-gray-400'}
            />
            <span>Menu Chức năng</span>
          </button>

          {/* Tab 2: Dashboard (Số liệu) */}
          <button
            type="button"
            onClick={() => handleMobileTabChange('dashboard')}
            className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              mobileTab === 'dashboard'
                ? 'bg-white dark:bg-[#202533] text-[#5865f2] dark:text-[#7b85f5] shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart3
              size={15}
              className={mobileTab === 'dashboard' ? 'text-[#5865f2] dark:text-[#7b85f5]' : 'text-gray-400'}
            />
            <span>Dashboard</span>
            {data?.orderStats?.totalOrders !== undefined && (
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                  mobileTab === 'dashboard'
                    ? 'bg-[#5865f2]/10 text-[#5865f2] dark:bg-[#5865f2]/25 dark:text-indigo-300'
                    : 'bg-gray-300/70 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {data.orderStats.totalOrders}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Tab 1: Feature Hub (Mặc định trên mobile) */}
      <div className={`lg:hidden ${mobileTab === 'hub' ? 'block' : 'hidden'}`}>
        <MobileFeatureHub onSelectDashboard={() => handleMobileTabChange('dashboard')} />
      </div>

      {/* Mobile Tab 2 & Desktop: Main Dashboard (Hiển thị khi mobileTab === 'dashboard' hoặc trên Desktop lg:block) */}
      <div className={`${mobileTab === 'dashboard' ? 'block' : 'hidden'} lg:block space-y-4 animate-in fade-in duration-150`}>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              <span className="sm:hidden">Tổng quan</span>
              <span className="hidden sm:inline">Tổng quan Vận hành & Doanh thu</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              <span className="sm:hidden">Số liệu theo thời gian thực</span>
              <span className="hidden sm:inline">Dữ liệu tổng hợp từ hệ thống theo thời gian thực</span>
            </p>
          </div>

          {/* Filter Controls: Shop Selector, Shopee Status Multi-select, Date Filter & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Shop Selector */}
            {shops && shops.length > 0 && (
              <div className="w-full sm:w-[190px]">
                <Select
                  value={selectedShopId || ''}
                  onChange={(val: any) => setSelectedShopId(val ? String(val) : null)}
                  options={[
                    { value: '', label: `Tất cả shop (${shops.length})`, icon: Store },
                    ...shops.map((s) => ({ value: s.id, label: s.name, icon: Store })),
                  ]}
                  placeholder={`Tất cả shop (${shops.length})`}
                  icon={Store}
                  size="sm"
                  className="w-full"
                  searchable={shops.length > 6}
                />
              </div>
            )}

            {/* Shopee Status Multi-Select Dropdown */}
            <div ref={statusDropdownRef} className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-white dark:bg-[#181b22] border rounded px-2.5 h-8 text-xs font-medium transition-colors cursor-pointer ${
                selectedStatuses.length > 0
                  ? 'border-[#5865f2] text-[#5865f2] dark:text-indigo-400 bg-indigo-50/20'
                  : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <Filter
                  size={13}
                  className={selectedStatuses.length > 0 ? 'text-[#5865f2]' : 'text-gray-400 shrink-0'}
                />
                <span className="truncate">
                  {selectedStatuses.length === 0
                    ? 'Trạng thái Shopee: Tất cả'
                    : selectedStatuses.length === 1
                    ? SHOPEE_STATUS_OPTIONS.find((s) => s.id === selectedStatuses[0])?.label
                    : `${selectedStatuses.length} trạng thái Shopee`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedStatuses.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#5865f2] text-white text-[10px] font-bold rounded-full">
                    {selectedStatuses.length}
                  </span>
                )}
                <ChevronDown
                  size={13}
                  className={`text-gray-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {isStatusDropdownOpen &&
              (isMobile
                ? createPortal(
                    <div className="fixed inset-0 z-[100] flex flex-col justify-end select-none pointer-events-auto">
                      {/* Dark Backdrop */}
                      <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer animate-in fade-in"
                        onClick={() => setIsStatusDropdownOpen(false)}
                      />

                      {/* Bottom Sheet Drawer */}
                      <div
                        ref={statusDrawerRef}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-[#161b26] border-t border-gray-200 dark:border-gray-800 rounded-t shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
                        style={{
                          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
                        }}
                      >
                        {/* Drag Handle & Header */}
                        <div className="w-full pt-3 pb-2.5 px-4 flex flex-col border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#121620]">
                          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-2.5" />
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center shrink-0">
                                <ListFilter size={15} className="text-[#5865f2]" />
                              </div>
                              <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                Lọc theo trạng thái Shopee
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsStatusDropdownOpen(false)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer -mr-1"
                              aria-label="Đóng"
                            >
                              <X size={17} />
                            </button>
                          </div>
                        </div>

                        {/* Quick Presets & Shortcuts */}
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#161b26] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Chọn nhanh
                            </span>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedStatuses(SHOPEE_STATUS_OPTIONS.map((s) => s.id))
                                }
                                className="text-xs text-[#5865f2] hover:underline cursor-pointer font-medium whitespace-nowrap active:opacity-75"
                              >
                                Chọn tất cả
                              </button>
                              <span className="text-gray-300 dark:text-gray-700">|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedStatuses([])}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-medium whitespace-nowrap active:opacity-75"
                              >
                                Bỏ chọn
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStatuses(['COMPLETED', 'TO_CONFIRM_RECEIVE'])
                              }
                              className={`py-1.5 px-2 rounded text-xs font-medium transition-all cursor-pointer border text-center flex items-center justify-center gap-1 active:scale-95 truncate ${
                                selectedStatuses.length === 2 &&
                                selectedStatuses.includes('COMPLETED') &&
                                selectedStatuses.includes('TO_CONFIRM_RECEIVE')
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-100'
                              }`}
                            >
                              <span>✓</span>
                              <span className="truncate">Thành công</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStatuses(['READY_TO_SHIP', 'SHIPPED', 'RETRY_SHIP'])
                              }
                              className={`py-1.5 px-2 rounded text-xs font-medium transition-all cursor-pointer border text-center flex items-center justify-center gap-1 active:scale-95 truncate ${
                                selectedStatuses.length === 3 &&
                                selectedStatuses.includes('READY_TO_SHIP') &&
                                selectedStatuses.includes('SHIPPED') &&
                                selectedStatuses.includes('RETRY_SHIP')
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40 hover:bg-indigo-100'
                              }`}
                            >
                              <span>⏱</span>
                              <span className="truncate">Đang giao</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedStatuses([
                                  'CANCELLED',
                                  'TO_RETURN',
                                  'RETURN_REFUND',
                                  'IN_CANCEL',
                                ])
                              }
                              className={`py-1.5 px-2 rounded text-xs font-medium transition-all cursor-pointer border text-center flex items-center justify-center gap-1 active:scale-95 truncate ${
                                selectedStatuses.length === 4 &&
                                selectedStatuses.includes('CANCELLED') &&
                                selectedStatuses.includes('TO_RETURN') &&
                                selectedStatuses.includes('RETURN_REFUND') &&
                                selectedStatuses.includes('IN_CANCEL')
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40 hover:bg-rose-100'
                              }`}
                            >
                              <span>✕</span>
                              <span className="truncate">Hủy & Hoàn</span>
                            </button>
                          </div>
                        </div>

                        {/* Status Options with Checkbox */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar min-h-0">
                          {SHOPEE_STATUS_OPTIONS.map((st) => {
                            const isSelected = selectedStatuses.includes(st.id);
                            return (
                              <div
                                key={st.id}
                                onClick={() => toggleStatus(st.id)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded transition-all cursor-pointer select-none active:scale-[0.99] ${
                                  isSelected
                                    ? 'bg-indigo-50/80 dark:bg-[#5865f2]/15 border border-[#5865f2]/40 text-gray-900 dark:text-white shadow-2xs'
                                    : 'bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100/70 dark:hover:bg-white/[0.05] border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => toggleStatus(st.id)}
                                    size="sm"
                                  />
                                  <span
                                    className={`w-2 h-2 rounded-full ${st.dotColor} shrink-0`}
                                  />
                                  <span className="font-medium text-gray-800 dark:text-gray-200 text-xs truncate">
                                    {st.label}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0 select-none">
                                  {st.id}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div className="p-3.5 sm:px-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 bg-gray-50/90 dark:bg-[#121620]">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {selectedStatuses.length === 0
                                ? 'Tất cả trạng thái'
                                : `Đã chọn ${selectedStatuses.length} / ${SHOPEE_STATUS_OPTIONS.length}`}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {selectedStatuses.length === 0
                                ? 'Đang tính cho tất cả đơn hàng'
                                : 'Lọc dữ liệu theo trạng thái đã chọn'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {selectedStatuses.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedStatuses([])}
                                className="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                              >
                                Đặt lại
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsStatusDropdownOpen(false)}
                              className="px-5 py-2 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold cursor-pointer shadow-md shadow-[#5865f2]/25 active:scale-95 transition-all whitespace-nowrap"
                            >
                              Áp dụng
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )
                : (
                    /* Desktop Dropdown Popover */
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 z-50 w-[350px] rounded bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 shadow-xl p-3 text-xs animate-in fade-in zoom-in-95 duration-150"
                    >
                      {/* Header */}
                      <div className="pb-2.5 mb-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 truncate min-w-0">
                          <ListFilter size={14} className="text-[#5865f2] shrink-0" />
                          <span className="truncate">Lọc theo trạng thái Shopee</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStatuses(SHOPEE_STATUS_OPTIONS.map((s) => s.id))
                            }
                            className="text-[11px] text-[#5865f2] hover:underline cursor-pointer font-medium whitespace-nowrap"
                          >
                            Chọn tất cả
                          </button>
                          <span className="text-gray-300 dark:text-gray-700">|</span>
                          <button
                            type="button"
                            onClick={() => setSelectedStatuses([])}
                            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-medium whitespace-nowrap"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="grid grid-cols-3 gap-1.5 mb-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStatuses(['COMPLETED', 'TO_CONFIRM_RECEIVE'])
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border text-center truncate ${
                            selectedStatuses.length === 2 &&
                            selectedStatuses.includes('COMPLETED') &&
                            selectedStatuses.includes('TO_CONFIRM_RECEIVE')
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200/60 dark:border-emerald-800/40'
                          }`}
                        >
                          ✓ Thành công
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStatuses(['READY_TO_SHIP', 'SHIPPED', 'RETRY_SHIP'])
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border text-center truncate ${
                            selectedStatuses.length === 3 &&
                            selectedStatuses.includes('READY_TO_SHIP') &&
                            selectedStatuses.includes('SHIPPED') &&
                            selectedStatuses.includes('RETRY_SHIP')
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100 border-indigo-200/60 dark:border-indigo-800/40'
                          }`}
                        >
                          ⏱ Đang giao
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStatuses([
                              'CANCELLED',
                              'TO_RETURN',
                              'RETURN_REFUND',
                              'IN_CANCEL',
                            ])
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border text-center truncate ${
                            selectedStatuses.length === 4 &&
                            selectedStatuses.includes('CANCELLED') &&
                            selectedStatuses.includes('TO_RETURN') &&
                            selectedStatuses.includes('RETURN_REFUND') &&
                            selectedStatuses.includes('IN_CANCEL')
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100 border-rose-200/60 dark:border-rose-800/40'
                          }`}
                        >
                          ✕ Hủy & Hoàn
                        </button>
                      </div>

                      {/* Status Options with Checkbox */}
                      <div className="max-h-[260px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                        {SHOPEE_STATUS_OPTIONS.map((st) => {
                          const isSelected = selectedStatuses.includes(st.id);
                          return (
                            <div
                              key={st.id}
                              onClick={() => toggleStatus(st.id)}
                              className={`flex items-center justify-between p-2 rounded transition-colors cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-indigo-50/70 dark:bg-[#5865f2]/10 border border-[#5865f2]/30'
                                  : 'hover:bg-gray-50 dark:hover:bg-white/[0.02] border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => toggleStatus(st.id)}
                                  size="sm"
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${st.dotColor} shrink-0`}
                                />
                                <span className="font-medium text-gray-800 dark:text-gray-200 text-xs truncate">
                                  {st.label}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-gray-400 shrink-0">
                                {st.id}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-400 truncate min-w-0">
                          {selectedStatuses.length === 0
                            ? 'Đang tính cho tất cả đơn hàng'
                            : `Đang chọn ${selectedStatuses.length} trạng thái`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsStatusDropdownOpen(false)}
                          className="px-3.5 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold cursor-pointer shrink-0 shadow-xs active:scale-95 transition-all whitespace-nowrap"
                        >
                          Áp dụng
                        </button>
                      </div>
                    </div>
                  ))}
          </div>

          {/* Row 2 on mobile: Date Range + Refresh Button inline */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Date Range */}
            <div className="flex-1 sm:flex-initial w-full sm:w-[230px]">
              <SystemDatePicker
                startDate={fromDate}
                endDate={toDate}
                onChange={(start, end) => {
                  setFromDate(start || '');
                  setToDate(end || '');
                }}
                size="sm"
                className="w-full"
                placeholder="Chọn khoảng ngày..."
              />
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboard}
              disabled={isLoading}
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
              title="Làm mới"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filter Tags Bar (if statuses selected) */}
      {selectedStatuses.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-2.5 rounded bg-gray-50 dark:bg-[#161920] border border-gray-200 dark:border-gray-800 text-xs">
          <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5 shrink-0">
            <Filter size={12} className="text-[#5865f2]" />
            Đang lọc {selectedStatuses.length} trạng thái Shopee:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedStatuses.map((stId) => {
              const opt = SHOPEE_STATUS_OPTIONS.find((s) => s.id === stId);
              return (
                <span
                  key={stId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-[#1f232b] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 shadow-2xs"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt?.dotColor || 'bg-gray-400'}`} />
                  <span>{opt?.label || stId}</span>
                  <button
                    type="button"
                    onClick={() => toggleStatus(stId)}
                    className="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                    title="Bỏ lọc trạng thái này"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSelectedStatuses([])}
            className="ml-auto text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer font-medium"
          >
            Đặt lại mặc định
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadDashboard}
            className="font-medium underline cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 1. Operational Fulfillment & Order Status KPIs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Trạng thái Đơn hàng & Vận hành
          </h2>
          <span className="text-xs text-gray-400">
            Tỷ lệ xuất kho:{' '}
            <strong className="text-[#5865f2] dark:text-[#7b85f5]">
              {data?.fulfillmentStats?.verificationRatePercent || 0}%
            </strong>
          </span>
        </div>

        {/* 6 Core Order Lifecycle Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Tổng đơn */}
          <div
            onClick={() => navigate('/orders')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-[#5865f2] transition-colors group"
          >
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Tổng đơn</span>
              <ShoppingCart size={14} className="group-hover:text-[#5865f2] transition-colors" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '...' : data?.orderStats?.totalOrders || 0}
            </div>
          </div>

          {/* Chờ lấy hàng */}
          <div
            onClick={() => navigate('/orders?platformStatus=READY_TO_SHIP')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-amber-400 transition-colors group"
          >
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-[11px] font-medium">Chờ lấy hàng</span>
              <Package size={14} />
            </div>
            <div className="text-xl font-bold text-amber-500">
              {isLoading ? '...' : data?.orderStats?.readyToShip || 0}
            </div>
          </div>

          {/* Đang giao hàng */}
          <div
            onClick={() => navigate('/orders?platformStatus=SHIPPED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-center justify-between text-indigo-500 dark:text-indigo-400 mb-1">
              <span className="text-[11px] font-medium">Đang giao hàng</span>
              <Truck size={14} />
            </div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {isLoading ? '...' : data?.orderStats?.shipped || 0}
            </div>
          </div>

          {/* Giao thành công */}
          <div
            onClick={() => navigate('/orders?platformStatus=COMPLETED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors group"
          >
            <div className="flex items-center justify-between text-emerald-500 mb-1">
              <span className="text-[11px] font-medium">Giao thành công</span>
              <CheckCircle2 size={14} />
            </div>
            <div className="text-xl font-bold text-emerald-500">
              {isLoading ? '...' : data?.orderStats?.completed || 0}
            </div>
          </div>

          {/* Đã xuất kho */}
          <div
            onClick={() => navigate('/orders?verificationStatus=VERIFIED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-blue-400 transition-colors group"
          >
            <div className="flex items-center justify-between text-blue-500 mb-1">
              <span className="text-[11px] font-medium">Đã xuất kho</span>
              <ShieldCheck size={14} />
            </div>
            <div className="text-xl font-bold text-blue-500">
              {isLoading ? '...' : data?.fulfillmentStats?.verifiedOrders || 0}
            </div>
          </div>

          {/* Hủy & Hoàn */}
          <div
            onClick={() => navigate('/orders?platformStatus=CANCELLED_AND_RETURNED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-rose-400 transition-colors group"
          >
            <div className="flex items-center justify-between text-rose-500 mb-1">
              <span className="text-[11px] font-medium">Hủy & Hoàn</span>
              <RotateCcw size={14} />
            </div>
            <div className="text-xl font-bold text-rose-500">
              {isLoading
                ? '...'
                : (data?.orderStats?.cancelled || 0) + (data?.orderStats?.returned || 0)}
            </div>
          </div>
        </div>

        {/* Secondary Warehouse Scanning & Stock Alert Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
          {/* Chưa quét xuất kho */}
          <div
            onClick={() => navigate('/orders?verificationStatus=NOT_VERIFIED')}
            className="px-3 py-2 rounded bg-white dark:bg-[#181b22] border border-rose-200/80 dark:border-rose-900/40 shadow-xs cursor-pointer hover:border-rose-400 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Chưa quét xuất kho
              </span>
            </div>
            <div className="text-base font-bold text-rose-500">
              {isLoading ? '...' : data?.fulfillmentStats?.notVerifiedOrders || 0}
            </div>
          </div>

          {/* Quét xuất một phần */}
          <div
            onClick={() =>
              navigate('/orders?verificationStatus=PARTIALLY_VERIFIED')
            }
            className="px-3 py-2 rounded bg-white dark:bg-[#181b22] border border-blue-200/80 dark:border-blue-900/40 shadow-xs cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2 text-blue-500">
              <ShieldCheck size={15} className="shrink-0" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Quét xuất một phần
              </span>
            </div>
            <div className="text-base font-bold text-blue-500">
              {isLoading ? '...' : data?.fulfillmentStats?.partiallyVerifiedOrders || 0}
            </div>
          </div>

          {/* Cảnh báo tồn thấp */}
          <div
            onClick={() => navigate('/inventory')}
            className="px-3 py-2 rounded bg-white dark:bg-[#181b22] border border-amber-200/80 dark:border-amber-900/40 shadow-xs cursor-pointer hover:border-amber-400 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2 text-amber-500">
              <Boxes size={15} className="shrink-0" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Tồn kho dưới định mức
              </span>
            </div>
            <div className="text-base font-bold text-amber-500">
              {isLoading
                ? '...'
                : data?.inventoryAlerts?.lowStockVariantsCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Dòng tiền & Xuất nhập hàng Overview */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="sm:hidden">Tiền nong & Xuất nhập</span>
              <span className="hidden sm:inline">Tổng quan Tiền nong & Xuất nhập hàng</span>
            </h2>
            <p className="text-[11px] text-gray-400">
              <span className="sm:hidden">Tiền nhập, tiền xuất, công nợ NCC và đối soát sàn</span>
              <span className="hidden sm:inline">Tổng hợp số tiền nhập hàng, tiền đi hàng, công nợ NCC và đối soát sàn</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 sm:mt-0">
            <button
              onClick={() => navigate('/purchase-reports')}
              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Receipt size={13} />
              <span className="sm:hidden">Báo cáo nhập</span>
              <span className="hidden sm:inline">Báo cáo nhập hàng</span>
            </button>
            <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">•</span>
            <button
              onClick={() => navigate('/suppliers')}
              className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Building2 size={13} />
              <span>Công nợ NCC</span>
            </button>
            <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">•</span>
            <button
              onClick={() => navigate('/order-reports')}
              className="text-[11px] font-medium text-[#5865f2] dark:text-[#7b85f5] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <FileText size={13} />
              <span>Đối soát đơn</span>
            </button>
          </div>
        </div>

        {/* 4 Cards: Tiền đi hàng, Tiền nhập hàng, Công nợ NCC, Tiền thực nhận */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Số tiền đi hàng (Tổng giá trị đơn xuất) */}
          <Card
            onClick={() => navigate('/order-reports')}
            className="p-3.5 hover:border-indigo-400/80 transition-all cursor-pointer relative overflow-hidden group shadow-xs"
          >
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Số tiền đi hàng
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                  Xuất bán
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Truck size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '...' : `${formatCurrency(data?.outbound?.totalExportedAmount ?? data?.financials?.gmv ?? 0)} đ`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
              <span>
                {isLoading ? '...' : `${data?.outbound?.totalOrders ?? data?.orderStats?.total ?? 0} đơn xuất`}
              </span>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">
                {isLoading ? '...' : `${data?.outbound?.totalExportedQuantity ?? 0} sp đã đi`}
              </span>
            </div>
          </Card>

          {/* Card 2: Số tiền nhập hàng (Thực nhận NCC) */}
          <Card
            onClick={() => navigate('/purchase-reports')}
            className="p-3.5 hover:border-emerald-400/80 transition-all cursor-pointer relative overflow-hidden group shadow-xs"
          >
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Số tiền nhập hàng
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  Thực nhận
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Receipt size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoading ? '...' : `${formatCurrency(data?.purchases?.netPurchaseAmount ?? data?.purchases?.totalPurchaseAmount ?? 0)} đ`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
              <span>
                {isLoading ? '...' : `${data?.purchases?.totalReceipts ?? 0} phiếu nhập`}
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {isLoading ? '...' : `${data?.purchases?.totalImportedQuantity ?? 0} sp nhập kho`}
              </span>
            </div>
          </Card>

          {/* Card 3: Công nợ Nhà Cung Cấp (NCC) */}
          <Card
            onClick={() => navigate('/suppliers')}
            className="p-3.5 hover:border-amber-400/80 transition-all cursor-pointer relative overflow-hidden group shadow-xs"
          >
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Công nợ NCC
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                  Còn phải trả
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Building2 size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {isLoading ? '...' : `${formatCurrency(data?.supplierDebt?.totalRemainingDebt ?? 0)} đ`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
              <span>
                Đã trả: {isLoading ? '...' : `${formatCurrency(data?.supplierDebt?.totalPaidDebt ?? 0)} đ`}
              </span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {isLoading ? '...' : `${data?.supplierDebt?.unpaidReceiptsCount ?? 0} phiếu (${data?.supplierDebt?.suppliersWithDebtCount ?? 0} NCC)`}
              </span>
            </div>
          </Card>

          {/* Card 4: Tiền thực nhận đối soát */}
          <Card
            onClick={() => navigate('/order-reports')}
            className="p-3.5 hover:border-cyan-400/80 transition-all cursor-pointer relative overflow-hidden group shadow-xs"
          >
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Thực nhận đối soát
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/40">
                  Ví Shopee
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
              {isLoading ? '...' : `${formatCurrency(data?.financials?.actualSettled ?? 0)} đ`}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
              <span>
                LN gộp: {isLoading ? '...' : `${formatCurrency(data?.financials?.estimatedGrossProfit ?? 0)} đ`}
              </span>
              <span className="text-gray-400">
                Phí: {isLoading ? '...' : `-${formatCurrency(data?.financials?.totalPlatformFees ?? 0)} đ`}
              </span>
            </div>
          </Card>
        </div>

        {/* Dải tổng quan Xuất - Nhập - Tồn kho hệ thống */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
          {/* SL Xuất bán */}
          <div
            onClick={() => navigate('/order-reports')}
            className="p-2 sm:p-2.5 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800/80 shadow-xs cursor-pointer hover:border-indigo-400 transition-colors flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-indigo-500 min-w-0">
              <PackageCheck size={16} className="shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 block leading-tight truncate">
                  <span className="sm:hidden">Xuất bán</span>
                  <span className="hidden sm:inline">Xuất bán trong kỳ</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate block">
                  {isLoading ? '...' : `${data?.outbound?.totalExportedQuantity ?? 0} cái`}
                </span>
              </div>
            </div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 shrink-0 text-right">{data?.outbound?.totalOrders ?? 0} đơn</span>
          </div>

          {/* SL Thực nhập */}
          <div
            onClick={() => navigate('/purchase-reports')}
            className="p-2 sm:p-2.5 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800/80 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-500 min-w-0">
              <Package size={16} className="shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 block leading-tight truncate">
                  <span className="sm:hidden">Nhập kho</span>
                  <span className="hidden sm:inline">Nhập kho thực tế</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate block">
                  {isLoading ? '...' : `${data?.purchases?.totalImportedQuantity ?? 0} cái`}
                </span>
              </div>
            </div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 shrink-0 text-right">{data?.purchases?.totalReceipts ?? 0} phiếu</span>
          </div>

          {/* Tồn kho thực tế On-hand */}
          <div
            onClick={() => navigate('/inventory')}
            className="p-2 sm:p-2.5 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800/80 shadow-xs cursor-pointer hover:border-sky-400 transition-colors flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-sky-500 min-w-0">
              <Boxes size={16} className="shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 block leading-tight truncate">
                  <span className="sm:hidden">Tồn thực tế</span>
                  <span className="hidden sm:inline">Tồn thực tế (On-hand)</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate block">
                  {isLoading ? '...' : `${data?.inventoryAlerts?.totalOnHand ?? 0} cái`}
                </span>
              </div>
            </div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 shrink-0 text-right">
              <span className="sm:hidden">{data?.inventoryAlerts?.totalAvailable ?? 0}</span>
              <span className="hidden sm:inline">Khả dụng: {data?.inventoryAlerts?.totalAvailable ?? 0}</span>
            </span>
          </div>

          {/* Tồn dưới định mức */}
          <div
            onClick={() => navigate('/inventory')}
            className="p-2 sm:p-2.5 rounded bg-white dark:bg-[#181b22] border border-amber-200/80 dark:border-amber-900/40 shadow-xs cursor-pointer hover:border-amber-400 transition-colors flex items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-amber-500 min-w-0">
              <AlertTriangle size={16} className="shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 block leading-tight truncate">
                  <span className="sm:hidden">Tồn thấp</span>
                  <span className="hidden sm:inline">Tồn kho dưới định mức</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 truncate block">
                  {isLoading ? '...' : `${data?.inventoryAlerts?.lowStockVariantsCount ?? 0} SKU`}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-amber-500 font-medium shrink-0 text-right">Cảnh báo</span>
          </div>
        </div>
      </div>

      {/* 3. Analytics Charts: Line Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Line Chart: Xu hướng Doanh thu & Nhập hàng (col-span-12 lg:col-span-8) */}
        <div className="lg:col-span-8">
          <RevenueChart data={data?.timeline || []} isLoading={isLoading} />
        </div>

        {/* Pie Chart: Tỷ lệ Trạng thái Đơn hàng (col-span-12 lg:col-span-4) */}
        <div className="lg:col-span-4">
          <StatusChart
            metrics={{
              completedCount: data?.orderStats?.completed || 0,
              deliveringCount: data?.orderStats?.shipped || data?.orderStats?.delivering || 0,
              readyToShipCount: data?.orderStats?.readyToShip || 0,
              cancelledCount: data?.orderStats?.cancelled || 0,
              returnedCount: data?.orderStats?.returned || 0,
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 4. Danh mục Sản phẩm Hệ thống & Hiệu suất Xuất - Nhập */}
      {(() => {
        const rawProducts: any[] = data?.systemProducts || [];
        const hasSystemProducts = rawProducts.length > 0;

        // Filter by keyword
        const filtered = rawProducts.filter((p: any) => {
          if (!productSearch.trim()) return true;
          const q = productSearch.toLowerCase().trim();
          return (
            (p.productName && p.productName.toLowerCase().includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.variantName && p.variantName.toLowerCase().includes(q))
          );
        });

        // Sort
        const sorted = [...filtered].sort((a: any, b: any) => {
          if (productSortBy === 'imported') {
            return (b.importedQuantity || 0) - (a.importedQuantity || 0);
          }
          if (productSortBy === 'onHand') {
            return (b.onHand || 0) - (a.onHand || 0);
          }
          if (productSortBy === 'lowStock') {
            return (a.onHand || 0) - (b.onHand || 0);
          }
          // Default: sold
          return (b.soldQuantity || 0) - (a.soldQuantity || 0);
        });

        return (
          <Card>
            <CardHeader className="py-3 px-3 sm:px-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Package className="text-[#5865f2] shrink-0" size={16} />
                    <span className="sm:hidden truncate">Sản phẩm & Hiệu suất</span>
                    <span className="hidden sm:inline truncate">Danh mục Sản phẩm Hệ thống & Hiệu suất Xuất - Nhập</span>
                  </CardTitle>
                  <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-indigo-50 text-[#5865f2] dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 shrink-0 whitespace-nowrap">
                    {hasSystemProducts ? (
                      <>
                        <span className="sm:hidden">{sorted.length} SKU hệ thống</span>
                        <span className="hidden sm:inline">{sorted.length} sản phẩm hệ thống</span>
                      </>
                    ) : (
                      <>
                        <span className="sm:hidden">{data?.topSellingItems?.length || 0} SKU sàn</span>
                        <span className="hidden sm:inline">{data?.topSellingItems?.length || 0} sản phẩm sàn</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Theo dõi số lượng xuất bán, tiền đi hàng, số lượng nhập kho, tiền nhập và tồn kho thực tế theo từng SKU sản phẩm của hệ thống
                </p>
              </div>

              {/* Controls: Search, Sort & Action links */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative w-full sm:w-[200px] md:w-[220px] flex-1 min-w-0">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Tìm tên sp, SKU, phân loại..."
                    className="w-full pl-8 pr-7 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1a1b23] p-0.5 rounded border border-gray-200 dark:border-gray-700 text-[11px] overflow-x-auto scrollbar-none max-w-full">
                  <button
                    onClick={() => setProductSortBy('sold')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors shrink-0 whitespace-nowrap ${
                      productSortBy === 'sold'
                        ? 'bg-white dark:bg-[#202533] text-[#5865f2] dark:text-indigo-300 shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Bán chạy
                  </button>
                  <button
                    onClick={() => setProductSortBy('imported')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors shrink-0 whitespace-nowrap ${
                      productSortBy === 'imported'
                        ? 'bg-white dark:bg-[#202533] text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Nhập nhiều
                  </button>
                  <button
                    onClick={() => setProductSortBy('onHand')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors shrink-0 whitespace-nowrap ${
                      productSortBy === 'onHand'
                        ? 'bg-white dark:bg-[#202533] text-sky-600 dark:text-sky-400 shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Tồn nhiều
                  </button>
                  <button
                    onClick={() => setProductSortBy('lowStock')}
                    className={`px-2 py-0.5 rounded font-medium transition-colors shrink-0 whitespace-nowrap ${
                      productSortBy === 'lowStock'
                        ? 'bg-white dark:bg-[#202533] text-amber-600 dark:text-amber-400 shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    Tồn thấp
                  </button>
                </div>

                {/* Link to full Order Reports */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/order-reports')}
                  className="h-7 text-xs px-2 gap-1 shrink-0 whitespace-nowrap hidden sm:flex"
                >
                  <span>Báo cáo đối soát</span>
                  <ExternalLink size={12} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-[#5865f2]" size={18} />
                  <span>Đang tải dữ liệu sản phẩm hệ thống...</span>
                </div>
              ) : !hasSystemProducts && (!data?.topSellingItems || data.topSellingItems.length === 0) ? (
                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
                  <Package className="text-gray-300 dark:text-gray-600" size={28} />
                  <span>Chưa có dữ liệu sản phẩm hoặc đơn hàng trong kỳ này</span>
                </div>
              ) : hasSystemProducts ? (
                <>
                  {/* Mobile Card List View (sm:hidden) */}
                  <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800/60 max-h-[600px] overflow-y-auto">
                    {sorted.map((item: any, idx: number) => {
                      const isOutOfStock = (item.onHand || 0) <= 0;
                      const isLowStock = !isOutOfStock && (item.onHand || 0) <= 10;

                      return (
                        <div
                          key={item.variantId || idx}
                          className="p-3.5 space-y-2 hover:bg-gray-50/60 dark:hover:bg-[#1c212d] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                  idx === 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                    : idx === 1
                                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : idx === 2
                                    ? 'bg-amber-800/15 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                                  {item.productName}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {item.variantName && (
                                    <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                                      {item.variantName}
                                    </span>
                                  )}
                                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                    {item.sku || 'N/A'}
                                  </Badge>
                                  {item.unit && (
                                    <span className="text-[10px] text-gray-400">
                                      ĐVT: {item.unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Stock Badge */}
                            <div>
                              {isOutOfStock ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5">
                                  Hết hàng
                                </Badge>
                              ) : isLowStock ? (
                                <Badge variant="warning" className="text-[10px] px-1.5">
                                  Tồn thấp ({item.onHand})
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px] px-1.5">
                                  Còn hàng ({item.onHand})
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* 3 Metric Pills: Xuất bán, Nhập kho, Tồn kho */}
                          <div className="grid grid-cols-3 gap-1.5 bg-gray-50/80 dark:bg-[#15171e] p-2 rounded border border-gray-100 dark:border-gray-800/60 text-center">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Xuất bán</span>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {item.soldQuantity} {item.unit || 'cái'}
                              </span>
                              {item.returnedQuantity > 0 && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-medium">
                                  Hoàn -{item.returnedQuantity}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                                {formatCurrency(item.exportedAmount)} đ
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block">Nhập kho</span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {item.importedQuantity} {item.unit || 'cái'}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                                {formatCurrency(item.importedAmount)} đ
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block">Tồn thực tế</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {item.onHand} {item.unit || 'cái'}
                              </span>
                              <span className="text-[10px] text-sky-500 block leading-tight">
                                Khả dụng: {item.available}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tablet & Desktop Table (hidden sm:block) */}
                  <div className="hidden sm:block overflow-x-auto max-h-[650px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50/90 dark:bg-[#1a1b23] sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 select-none">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10 font-medium">#</th>
                          <th className="py-2.5 px-4 font-medium">Sản phẩm & Biến thể hệ thống</th>
                          <th className="py-2.5 px-4 text-right font-medium border-l border-gray-200 dark:border-gray-800">
                            Xuất đi (Bán hàng)
                          </th>
                          <th className="py-2.5 px-4 text-right font-medium border-l border-gray-200 dark:border-gray-800">
                            Nhập kho
                          </th>
                          <th className="py-2.5 px-4 text-right font-medium border-l border-gray-200 dark:border-gray-800">
                            Tồn kho thực tế (On-hand)
                          </th>
                          <th className="py-2.5 px-3 text-center font-medium border-l border-gray-200 dark:border-gray-800">
                            Trạng thái
                          </th>
                          <th className="py-2.5 px-3 text-center font-medium border-l border-gray-200 dark:border-gray-800">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                        {sorted.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-gray-400">
                              Không tìm thấy sản phẩm phù hợp với từ khóa "{productSearch}"
                            </td>
                          </tr>
                        ) : (
                          sorted.map((item: any, idx: number) => {
                            const isOutOfStock = (item.onHand || 0) <= 0;
                            const isLowStock = !isOutOfStock && (item.onHand || 0) <= 10;

                            return (
                              <tr
                                key={item.variantId || idx}
                                className="hover:bg-gray-50/60 dark:hover:bg-[#1c212d] transition-colors"
                              >
                                {/* STT */}
                                <td className="py-3 px-3 text-center font-medium text-gray-400">
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                      idx === 0
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                        : idx === 1
                                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        : idx === 2
                                        ? 'bg-amber-800/15 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>

                                {/* Tên sản phẩm & SKU nội bộ */}
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {item.productName}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {item.variantName && (
                                      <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                                        Phân loại: {item.variantName}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-gray-50 dark:bg-gray-800/80">
                                      SKU: {item.sku || 'N/A'}
                                    </Badge>
                                    {item.unit && (
                                      <span className="text-[10px] text-gray-400">
                                        ĐVT: {item.unit}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Xuất đi (Bán hàng) */}
                                <td className="py-3 px-4 text-right border-l border-gray-200 dark:border-gray-800">
                                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {item.soldQuantity} {item.unit || 'cái'}
                                  </div>
                                  {item.returnedQuantity > 0 && (
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                                      (Đơn {item.soldQuantity} • Hoàn -{item.returnedQuantity})
                                    </div>
                                  )}
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {formatCurrency(item.exportedAmount)} đ
                                  </div>
                                </td>

                                {/* Nhập kho */}
                                <td className="py-3 px-4 text-right border-l border-gray-200 dark:border-gray-800">
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {item.importedQuantity} {item.unit || 'cái'}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {formatCurrency(item.importedAmount)} đ
                                  </div>
                                </td>

                                {/* Tồn kho thực tế (On-hand) */}
                                <td className="py-3 px-4 text-right border-l border-gray-200 dark:border-gray-800">
                                  <div className="font-bold text-gray-900 dark:text-white">
                                    {item.onHand} {item.unit || 'cái'}
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-end gap-1.5">
                                    <span className="text-sky-500 font-medium">
                                      Khả dụng: {item.available}
                                    </span>
                                    {item.reserved > 0 && (
                                      <span className="text-gray-400">
                                        (Tạm giữ: {item.reserved})
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Trạng thái tồn kho */}
                                <td className="py-3 px-3 text-center border-l border-gray-200 dark:border-gray-800">
                                  {isOutOfStock ? (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Hết hàng
                                    </Badge>
                                  ) : isLowStock ? (
                                    <Badge variant="warning" className="text-[10px]">
                                      Tồn thấp
                                    </Badge>
                                  ) : (
                                    <Badge variant="success" className="text-[10px]">
                                      Còn hàng
                                    </Badge>
                                  )}
                                </td>

                                {/* Thao tác */}
                                <td className="py-3 px-3 text-center border-l border-gray-200 dark:border-gray-800">
                                  <button
                                    onClick={() => navigate('/inventory')}
                                    className="p-1 rounded text-gray-400 hover:text-[#5865f2] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                    title="Xem chi tiết kho"
                                  >
                                    <Boxes size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* Fallback for old topSellingItems if systemProducts not populated */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Tên sản phẩm</th>
                        <th className="py-2.5 px-4 font-medium border-l border-gray-200 dark:border-gray-800">
                          SKU sàn
                        </th>
                        <th className="py-2.5 px-4 text-right font-medium border-l border-gray-200 dark:border-gray-800">
                          Số lượng đã bán
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                      {data.topSellingItems.map((item: any, idx: number) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50/60 dark:hover:bg-[#1c212d] transition-colors"
                        >
                          <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 font-mono text-[11px] border-l border-gray-200 dark:border-gray-800">
                            {item.sku || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#5865f2] border-l border-gray-200 dark:border-gray-800">
                            {item.totalQuantitySold}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
      </div>
    </div>
  );
};
