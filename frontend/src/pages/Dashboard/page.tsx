import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { reportsApi } from '../../services/reportsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { formatCurrency } from '../../utils';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../../components/ui/Card';

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
  const selectedShopId = useWorkspaceStore((s) => s.selectedShopId);

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Multi-select Shopee Order Statuses
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState<boolean>(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(() => setIsStatusDropdownOpen(false), isStatusDropdownOpen, statusDropdownRef);

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-base font-medium text-gray-900 dark:text-white leading-tight">
            Tổng quan Vận hành & Doanh thu
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Dữ liệu tổng hợp từ hệ thống theo thời gian thực
          </p>
        </div>

        {/* Filter Controls: Shopee Status Multi-select, Date Filter & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shopee Status Multi-Select Dropdown */}
          <div ref={statusDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className={`flex items-center gap-2 bg-white dark:bg-[#181b22] border rounded px-2.5 h-8 text-xs font-medium transition-colors cursor-pointer ${
                selectedStatuses.length > 0
                  ? 'border-[#5865f2] text-[#5865f2] dark:text-indigo-400 bg-indigo-50/20'
                  : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <Filter
                size={13}
                className={selectedStatuses.length > 0 ? 'text-[#5865f2]' : 'text-gray-400'}
              />
              <span className="truncate max-w-[190px]">
                {selectedStatuses.length === 0
                  ? 'Trạng thái Shopee: Tất cả'
                  : selectedStatuses.length === 1
                  ? SHOPEE_STATUS_OPTIONS.find((s) => s.id === selectedStatuses[0])?.label
                  : `${selectedStatuses.length} trạng thái Shopee`}
              </span>
              {selectedStatuses.length > 0 && (
                <span className="px-1.5 py-0.2 bg-[#5865f2] text-white text-[10px] font-bold rounded-full">
                  {selectedStatuses.length}
                </span>
              )}
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isStatusDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-[calc(100vw-32px)] sm:w-auto min-w-[280px] sm:min-w-[320px] max-w-[360px] rounded-lg bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 shadow-xl p-2.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="pb-2 mb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ListFilter size={14} className="text-[#5865f2]" />
                    Lọc theo trạng thái Shopee
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses(SHOPEE_STATUS_OPTIONS.map((s) => s.id))}
                      className="text-[11px] text-[#5865f2] hover:underline cursor-pointer font-medium"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses([])}
                      className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-medium"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setSelectedStatuses(['COMPLETED', 'TO_CONFIRM_RECEIVE'])}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200/60 dark:border-emerald-800/40"
                  >
                    ✓ Thành công
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatuses(['READY_TO_SHIP', 'SHIPPED', 'RETRY_SHIP'])}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-200/60 dark:border-indigo-800/40"
                  >
                    ⏱ Đang giao
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatuses(['CANCELLED', 'TO_RETURN', 'RETURN_REFUND', 'IN_CANCEL'])}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200/60 dark:border-rose-800/40"
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
                            ? 'bg-gray-100/80 dark:bg-white/5'
                            : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleStatus(st.id)}
                            size="sm"
                          />
                          <span className={`w-2 h-2 rounded-full ${st.dotColor} shrink-0`} />
                          <span className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                            {st.label}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400">
                          {st.id}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {selectedStatuses.length === 0
                      ? 'Đang tính cho tất cả đơn hàng'
                      : `Đang chọn ${selectedStatuses.length} trạng thái`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStatusDropdownOpen(false)}
                    className="px-3 py-1 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded px-2.5 h-8 text-xs">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-gray-800 dark:text-gray-200 text-xs focus:outline-none"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-gray-800 dark:text-gray-200 text-xs focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={isLoading}
            className="px-2.5"
            title="Làm mới"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
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

      {/* 1. Operational Fulfillment KPIs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Vận hành xuất kho hôm nay
          </h2>
          <span className="text-xs text-gray-400">
            Tỷ lệ xuất kho:{' '}
            <strong className="text-[#5865f2]">
              {data?.fulfillmentStats?.verificationRatePercent || 0}%
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Tổng đơn */}
          <div
            onClick={() => navigate('/orders')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-[#5865f2] transition-colors"
          >
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">Tổng đơn</span>
              <ShoppingCart size={14} />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '...' : data?.orderStats?.totalOrders || 0}
            </div>
          </div>

          {/* Đang chuẩn bị */}
          <div
            onClick={() => navigate('/orders?platformStatus=READY_TO_SHIP')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
          >
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-[11px] font-medium">Chờ lấy hàng</span>
              <Truck size={14} />
            </div>
            <div className="text-xl font-bold text-amber-500">
              {isLoading ? '...' : data?.orderStats?.readyToShip || 0}
            </div>
          </div>

          {/* Chưa quét xuất */}
          <div
            onClick={() => navigate('/orders?verificationStatus=NOT_VERIFIED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-rose-200 dark:border-rose-900/40 shadow-xs cursor-pointer hover:border-rose-400 transition-colors"
          >
            <div className="flex items-center justify-between text-rose-500 mb-1">
              <span className="text-[11px] font-medium">Chưa quét kho</span>
              <AlertTriangle size={14} />
            </div>
            <div className="text-xl font-bold text-rose-500">
              {isLoading
                ? '...'
                : data?.fulfillmentStats?.notVerifiedOrders || 0}
            </div>
          </div>

          {/* Đã quét một phần */}
          <div
            onClick={() =>
              navigate('/orders?verificationStatus=PARTIALLY_VERIFIED')
            }
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center justify-between text-blue-500 mb-1">
              <span className="text-[11px] font-medium">Quét 1 phần</span>
              <ShieldCheck size={14} />
            </div>
            <div className="text-xl font-bold text-blue-500">
              {isLoading
                ? '...'
                : data?.fulfillmentStats?.partiallyVerifiedOrders || 0}
            </div>
          </div>

          {/* Đã quét xuất đủ */}
          <div
            onClick={() => navigate('/orders?verificationStatus=VERIFIED')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-emerald-200 dark:border-emerald-900/40 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between text-emerald-500 mb-1">
              <span className="text-[11px] font-medium">Đã xuất kho</span>
              <CheckCircle size={14} />
            </div>
            <div className="text-xl font-bold text-emerald-500">
              {isLoading ? '...' : data?.fulfillmentStats?.verifiedOrders || 0}
            </div>
          </div>

          {/* Cảnh báo tồn thấp */}
          <div
            onClick={() => navigate('/inventory')}
            className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
          >
            <div className="flex items-center justify-between text-amber-500 mb-1">
              <span className="text-[11px] font-medium">Tồn kho thấp</span>
              <Boxes size={14} />
            </div>
            <div className="text-xl font-bold text-amber-500">
              {isLoading
                ? '...'
                : data?.inventoryAlerts?.lowStockVariantsCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Financial Metrics */}
      <div>
        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Tài chính & Doanh thu
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* GMV */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <span className="text-xs font-medium">Tổng giá trị đơn (GMV)</span>
              <div className="w-8 h-8 rounded-full bg-[#5865f2]/10 flex items-center justify-center text-[#5865f2]">
                <Wallet size={15} />
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '...' : `${formatCurrency(data?.financials?.gmv)} đ`}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {selectedStatuses.length > 0
                ? `Lọc theo: ${selectedStatuses.map((s) => SHOPEE_STATUS_OPTIONS.find((x) => x.id === s)?.label).filter(Boolean).join(', ')}`
                : 'Bao gồm toàn bộ đơn phát sinh trong kỳ'}
            </p>
          </Card>

          {/* Doanh thu hoàn thành */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <span className="text-xs font-medium">Doanh thu hoàn thành</span>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {isLoading
                ? '...'
                : `${formatCurrency(data?.financials?.completedRevenue)} đ`}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Đơn trạng thái COMPLETED trên sàn
            </p>
          </Card>

          {/* Lợi nhuận gộp ước tính */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <span className="text-xs font-medium">
                Lợi nhuận gộp ước tính
              </span>
              <div className="w-8 h-8 rounded-full bg-[#5865f2]/10 flex items-center justify-center text-[#5865f2]">
                <DollarSign size={15} />
              </div>
            </div>
            <div className="text-xl font-bold text-[#5865f2]">
              {isLoading
                ? '...'
                : `${formatCurrency(data?.financials?.estimatedGrossProfit)} đ`}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Giá bán - Giá vốn COGS snapshot (
              {formatCurrency(data?.financials?.completedCogs)} đ)
            </p>
          </Card>

          {/* Tiền thực nhận đã đối soát */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between text-gray-500 mb-1.5">
              <span className="text-xs font-medium">Tiền thực nhận đối soát</span>
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                <CheckCircle size={15} />
              </div>
            </div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
              {isLoading
                ? '...'
                : `${formatCurrency(data?.financials?.actualSettled)} đ`}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Phí sàn đã khấu trừ:{' '}
              {formatCurrency(data?.financials?.totalPlatformFees)} đ
            </p>
          </Card>
        </div>
      </div>

      {/* 3. Top Products Table */}
      <Card>
        <CardHeader className="py-2.5 px-4 border-b border-gray-200 dark:border-gray-800 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-medium text-gray-900 dark:text-white">
              Sản phẩm bán chạy trong kỳ
            </CardTitle>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Số lượng đã bán được tổng hợp theo các trạng thái Shopee đang chọn
            </p>
          </div>
          {selectedStatuses.length > 0 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#5865f2]/10 text-[#5865f2] border border-[#5865f2]/30">
              Lọc theo: {selectedStatuses.length} trạng thái
            </span>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-gray-400">
              Đang tải dữ liệu...
            </div>
          ) : !data?.topSellingItems || data.topSellingItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              Chưa có dữ liệu bán hàng trong kỳ này
            </div>
          ) : (
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
    </div>
  );
};
