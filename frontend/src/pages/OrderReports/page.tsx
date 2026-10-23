import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Boxes,
  Store,
  Warehouse,
  Search,
  RotateCcw,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Package,
  Layers,
  ShoppingBag,
  PackageCheck,
  ChevronRight,
  ExternalLink,
  Receipt,
  X,
  FileText,
  Building2,
  Calendar,
  AlertCircle,
  Truck,
  ArrowRight,
  BarChart3,
  Percent,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
  reportsApi,
  OrderReconciliationItem,
  OrderReconciliationSummary,
  OrderReconciliationTransactionsData,
} from '../../services/reportsApi';
import { SystemDatePicker } from '../../components/ui/SystemDatePicker';
import { Select } from '../../components/ui/Select';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
  SystemPagination,
} from '../../components/ui/SystemTable';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import {
  SystemFilter,
  SystemFilterSearch,
  SystemFilterReset,
} from '../../components/ui/SystemFilter';
import { Modal, ModalBody } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';

export const OrderReportsPage: React.FC = () => {
  const { shops, warehouses } = useWorkspaceStore();

  // Filters state
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  // Data & loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<OrderReconciliationSummary>({
    totalVariants: 0,
    totalImportedQuantity: 0,
    totalExportedQuantity: 0,
    totalOnHand: 0,
    totalReserved: 0,
    totalAvailable: 0,
    balancedCount: 0,
    discrepancyCount: 0,
    surplusCount: 0,
    deficitCount: 0,
    outOfStockCount: 0,
  });
  const [items, setItems] = useState<OrderReconciliationItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Detail Modal state
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<OrderReconciliationTransactionsData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailActiveTab, setDetailActiveTab] = useState<
    'ORDERS' | 'RECEIPTS' | 'PURCHASE_RETURNS' | 'ORDER_RETURNS' | 'WAREHOUSES'
  >('ORDERS');

  // Load report data
  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getOrderReconciliationReport({
        shopId: selectedShopId !== 'ALL' ? selectedShopId : undefined,
        warehouseId: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined,
        reconciliationStatus: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
        page: currentPage,
        limit,
      });

      if (res) {
        setSummary(res.summary);
        setItems(res.items || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.totalItems || 0);
      }
    } catch (err: any) {
      console.error('Error loading order reconciliation report:', err);
      toast.error('Lỗi tải báo cáo đối soát', err?.message || 'Không thể kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [selectedShopId, selectedWarehouseId, selectedStatus, startDate, endDate, searchTerm, currentPage, limit]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Handle Quick Date Presets
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === 'TODAY') {
      start = formatDate(now);
      end = formatDate(now);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = formatDate(y);
      end = formatDate(y);
    } else if (preset === 'LAST_7_DAYS') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      start = formatDate(s);
      end = formatDate(now);
    } else if (preset === 'THIS_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = formatDate(first);
      end = formatDate(now);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatDate(first);
      end = formatDate(last);
    } else {
      // ALL
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
    setCurrentPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedShopId('ALL');
    setSelectedWarehouseId('ALL');
    setSelectedStatus('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Open transaction detail modal
  const handleOpenDetail = async (variantId: string) => {
    setSelectedVariantId(variantId);
    setDetailActiveTab('ORDERS');
    setIsLoadingDetail(true);
    try {
      const data = await reportsApi.getOrderReconciliationTransactions(variantId, {
        shopId: selectedShopId !== 'ALL' ? selectedShopId : undefined,
        warehouseId: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setDetailData(data);
    } catch (err: any) {
      console.error('Error loading variant transactions:', err);
      toast.error('Lỗi tải chi tiết giao dịch', err?.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      toast.info('Đang chuẩn bị file Excel...');
      // Load all items without pagination
      const fullRes = await reportsApi.getOrderReconciliationReport({
        shopId: selectedShopId !== 'ALL' ? selectedShopId : undefined,
        warehouseId: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined,
        reconciliationStatus: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
        page: 1,
        limit: 1000,
      });

      const exportList = fullRes?.items || items;
      if (!exportList.length) {
        toast.warning('Không có dữ liệu để xuất Excel');
        return;
      }

      const rows = exportList.map((item, index) => ({
        'STT': index + 1,
        'Mã SKU hệ thống': item.sku,
        'Tên sản phẩm hệ thống': item.productName,
        'Phân loại / Biến thể': item.variantName,
        'Mã vạch (Barcode)': item.barcode || '',
        'Đơn vị tính': item.unit,
        'Giá vốn (VNĐ)': item.costPrice,
        'Giá bán (VNĐ)': item.sellingPrice,
        'Tổng nhập gốc': item.grossImportedQuantity || item.importedQuantity,
        'Đã trả hàng NCC': item.supplierReturnedQuantity || 0,
        'Thực nhập kho (Net)': item.importedQuantity,
        'Tổng tiền nhập (VNĐ)': item.importedAmount,
        'Số phiếu nhập': item.receiptsCount,
        'Số phiếu trả NCC': item.purchaseReturnsCount || 0,
        'Tổng xuất đơn hàng gốc': item.grossExportedQuantity || item.exportedQuantity,
        'Khách hoàn về kho': item.customerReturnedQuantity || 0,
        'Thực xuất bán (Net)': item.exportedQuantity,
        'Số đơn hàng': item.ordersCount,
        'Tồn kho thực tế (On-hand)': item.onHand,
        'Đang giữ cho đơn (Reserved)': item.reserved,
        'Tồn khả dụng (Available)': item.available,
        'Tồn lý thuyết (Nhập - Bán)': item.calculatedStock,
        'Độ lệch đối soát': item.discrepancy,
        'Trạng thái đối soát':
          item.reconciliationStatus === 'BALANCED'
            ? 'Khớp hoàn toàn'
            : item.reconciliationStatus === 'SURPLUS'
            ? 'Thừa tồn kho'
            : 'Thiếu tồn kho',
        'Tỷ lệ bán / nhập (%)': `${item.fulfillmentRatePercent}%`,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DoiSoatDonHang');

      const fileName = `Bao_Cao_Doi_Soat_Don_Hang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Xuất file Excel thành công!');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      toast.error('Lỗi xuất file Excel', err?.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <TrendingUp size={20} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">Báo cáo đơn hàng & Đối soát Nhập - Xuất - Tồn</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            So khớp số lượng đơn hàng đi so với số lượng sản phẩm nhập kho, kiểm tra dư tồn theo sản phẩm hệ thống nội bộ
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 h-8 text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReportData}
            disabled={isLoading}
            className="flex items-center gap-1.5 h-8 text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Sản phẩm thực nhập kho',
            value: `${summary.totalImportedQuantity.toLocaleString('vi-VN')}`,
            subtitle:
              summary.totalSupplierReturned && summary.totalSupplierReturned > 0
                ? `Đã trừ ${summary.totalSupplierReturned.toLocaleString('vi-VN')} hàng trả NCC`
                : `Từ các phiếu nhập kho NCC`,
            icon: PackageCheck,
            colorScheme: 'green',
          }}
          rightItem={{
            title: 'Sản phẩm xuất bán',
            value: `${summary.totalExportedQuantity.toLocaleString('vi-VN')}`,
            subtitle:
              summary.totalCustomerReturned && summary.totalCustomerReturned > 0
                ? `Đã trừ ${summary.totalCustomerReturned.toLocaleString('vi-VN')} khách hoàn`
                : `Xuất qua các đơn hàng`,
            icon: ShoppingBag,
            colorScheme: 'indigo',
          }}
        />

        <SystemMetricPairCard
          leftItem={{
            title: 'Tồn kho thực tế (On-hand)',
            value: `${summary.totalOnHand.toLocaleString('vi-VN')}`,
            subtitle: `Đang có trong các kho hàng`,
            icon: Warehouse,
            colorScheme: 'cyan',
          }}
          rightItem={{
            title: 'Tồn khả dụng (Available)',
            value: `${summary.totalAvailable.toLocaleString('vi-VN')}`,
            subtitle: `Giữ đơn: ${summary.totalReserved.toLocaleString('vi-VN')}`,
            icon: Boxes,
            colorScheme: 'blue',
          }}
        />

        <SystemMetricPairCard
          leftItem={{
            title: 'SKU khớp đối soát',
            value: `${summary.balancedCount.toLocaleString('vi-VN')}`,
            subtitle: `Tồn thực tế = Tồn tính toán`,
            icon: CheckCircle2,
            colorScheme: 'green',
          }}
          rightItem={{
            title: 'SKU lệch tồn kho',
            value: `${summary.discrepancyCount.toLocaleString('vi-VN')}`,
            subtitle: `Thừa: ${summary.surplusCount} • Thiếu: ${summary.deficitCount}`,
            icon: AlertTriangle,
            colorScheme: summary.discrepancyCount > 0 ? 'orange' : 'green',
          }}
        />

        <SystemMetricPairCard
          leftItem={{
            title: 'Tổng biến thể SKU',
            value: `${summary.totalVariants.toLocaleString('vi-VN')}`,
            subtitle: `Danh mục sản phẩm nội bộ`,
            icon: Layers,
            colorScheme: 'purple',
          }}
          rightItem={{
            title: 'SKU hết hàng',
            value: `${summary.outOfStockCount.toLocaleString('vi-VN')}`,
            subtitle: summary.outOfStockCount > 0 ? 'Cần bổ sung nhập kho' : 'Đảm bảo tồn bán',
            icon: AlertCircle,
            colorScheme: summary.outOfStockCount > 0 ? 'rose' : 'green',
          }}
        />
      </div>

      {/* Unified Filters Toolbar */}
      <SystemFilter className="p-2 sm:p-2.5 flex-col gap-2 shrink-0">
        {/* Top row: Date preset chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 w-full">
          {[
            { id: 'ALL', label: 'Tất cả thời gian' },
            { id: 'TODAY', label: 'Hôm nay' },
            { id: 'YESTERDAY', label: 'Hôm qua' },
            { id: 'LAST_7_DAYS', label: '7 ngày qua' },
            { id: 'THIS_MONTH', label: 'Tháng này' },
            { id: 'LAST_MONTH', label: 'Tháng trước' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleDatePresetChange(tab.id)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer border-0 shrink-0 ${
                datePreset === tab.id
                  ? 'bg-[#5865f2] text-white font-medium shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1b23] font-normal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bottom row: Dropdowns & search inputs */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
          {/* Custom Date Range Picker */}
          <div className="col-span-2 sm:w-[220px]">
            <SystemDatePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start || '');
                setEndDate(end || '');
                setDatePreset(start || end ? 'CUSTOM' : 'ALL');
                setCurrentPage(1);
              }}
              size="sm"
              className="w-full"
              placeholder="Khoảng ngày đối soát..."
            />
          </div>

          {/* Shop Filter */}
          <div className="col-span-1 sm:w-48">
            <Select
              value={selectedShopId}
              onChange={(val) => {
                setSelectedShopId(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả cửa hàng (Shop)', icon: Store },
                ...shops.map((s) => ({
                  value: s.id,
                  label: s.name,
                  icon: Store,
                })),
              ]}
              size="sm"
              className="w-full"
              menuWidth="w-56"
            />
          </div>

          {/* Warehouse Filter */}
          <div className="col-span-1 sm:w-48">
            <Select
              value={selectedWarehouseId}
              onChange={(val) => {
                setSelectedWarehouseId(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả kho hàng', icon: Warehouse },
                ...warehouses.map((wh) => ({
                  value: wh.id,
                  label: `${wh.name} (${wh.code})`,
                  icon: Warehouse,
                })),
              ]}
              size="sm"
              className="w-full"
              menuWidth="w-56"
            />
          </div>

          {/* Status Filter */}
          <div className="col-span-1 sm:w-44">
            <Select
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'BALANCED', label: 'Khớp hoàn toàn (0)' },
                { value: 'DEFICIT', label: 'Thiếu tồn (-)' },
                { value: 'SURPLUS', label: 'Thừa tồn (+)' },
                { value: 'OUT_OF_STOCK', label: 'Hết hàng (Tồn = 0)' },
              ]}
              size="sm"
              className="w-full"
              menuWidth="w-52"
            />
          </div>

          {/* Search SKU or Product Name */}
          <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
            <SystemFilterSearch
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo SKU nội bộ, tên sản phẩm hệ thống..."
              className="w-full"
            />
          </div>

          {/* Reset Filters */}
          {(selectedShopId !== 'ALL' ||
            selectedWarehouseId !== 'ALL' ||
            selectedStatus !== 'ALL' ||
            datePreset !== 'ALL' ||
            startDate ||
            endDate ||
            searchTerm) && (
            <div className="col-span-2 sm:col-span-1 sm:ml-auto">
              <SystemFilterReset onClick={handleResetFilters} label="Xóa lọc" />
            </div>
          )}
        </div>
      </SystemFilter>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded">
        {/* Desktop Table View (Hidden on mobile) */}
        <div className="hidden sm:block flex-1 min-h-0 overflow-auto custom-scrollbar">
          <SystemTableWrapper>
            <SystemThead>
              <SystemTr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-[#1a1b23]/50">
                <SystemTh className="w-12 text-center">STT</SystemTh>
                <SystemTh className="min-w-[240px]">Sản phẩm & SKU hệ thống</SystemTh>
                <SystemTh className="w-28 text-right">Đã nhập kho</SystemTh>
                <SystemTh className="w-28 text-right">Đơn hàng đi</SystemTh>
                <SystemTh className="w-32 text-right">Tồn thực tế</SystemTh>
                <SystemTh className="w-28 text-right">Tồn khả dụng</SystemTh>
                <SystemTh className="w-36 text-center">Đối soát chênh lệch</SystemTh>
                <SystemTh className="w-32 text-center">Tỷ lệ xuất / nhập</SystemTh>
                <SystemTh className="w-24 text-center">Chi tiết</SystemTh>
              </SystemTr>
            </SystemThead>

            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton rows={8} cols={9} />
              ) : items.length === 0 ? (
                <SystemTableEmpty
                  colSpan={9}
                  title="Không tìm thấy sản phẩm đối soát"
                  description="Hãy thử thay đổi bộ lọc ngày, cửa hàng hoặc từ khóa tìm kiếm SKU."
                />
              ) : (
                items.map((item, index) => {
                  const isBalanced = item.reconciliationStatus === 'BALANCED';
                  const isSurplus = item.reconciliationStatus === 'SURPLUS';
                  const isDeficit = item.reconciliationStatus === 'DEFICIT';

                  return (
                    <SystemTr
                      key={item.variantId}
                      className="hover:bg-gray-50/70 dark:hover:bg-[#1a1b23]/60 transition-colors"
                    >
                      {/* STT */}
                      <SystemTd className="text-center text-xs text-gray-500 font-mono">
                        {(currentPage - 1) * limit + index + 1}
                      </SystemTd>

                      {/* Product Name & Master Variant SKU */}
                      <SystemTd>
                        <div className="flex flex-col min-w-0 py-1">
                          <span
                            className="text-xs font-semibold text-gray-900 dark:text-white truncate"
                            title={item.productName}
                          >
                            {item.productName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                              {item.sku}
                            </span>
                            {item.variantName && item.variantName !== item.productName && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                • {item.variantName}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      </SystemTd>

                      {/* Nhập kho */}
                      <SystemTd className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-xs font-bold ${
                              item.importedQuantity > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {item.importedQuantity > 0
                              ? `+${item.importedQuantity.toLocaleString('vi-VN')}`
                              : item.importedQuantity.toLocaleString('vi-VN')}
                          </span>
                          {item.supplierReturnedQuantity && item.supplierReturnedQuantity > 0 ? (
                            <span
                              className="text-[10px] text-amber-600 dark:text-amber-400 font-medium"
                              title={`Gốc: ${item.grossImportedQuantity} • Đã trả NCC: ${item.supplierReturnedQuantity}`}
                            >
                              Gốc +{item.grossImportedQuantity} • Trả -{item.supplierReturnedQuantity}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {item.receiptsCount} phiếu nhập
                            </span>
                          )}
                        </div>
                      </SystemTd>

                      {/* Đơn hàng đi (Xuất bán) */}
                      <SystemTd className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-xs font-bold ${
                              item.exportedQuantity > 0
                                ? 'text-[#5865f2] dark:text-indigo-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {item.exportedQuantity > 0
                              ? `-${item.exportedQuantity.toLocaleString('vi-VN')}`
                              : item.exportedQuantity.toLocaleString('vi-VN')}
                          </span>
                          {item.customerReturnedQuantity && item.customerReturnedQuantity > 0 ? (
                            <span
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"
                              title={`Đơn: ${item.grossExportedQuantity} • Khách hoàn: ${item.customerReturnedQuantity}`}
                            >
                              Đơn {item.grossExportedQuantity} • Hoàn -{item.customerReturnedQuantity}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {item.ordersCount} đơn hàng
                            </span>
                          )}
                        </div>
                      </SystemTd>

                      {/* Tồn thực tế */}
                      <SystemTd className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-xs font-bold ${
                              item.onHand > 0
                                ? 'text-gray-900 dark:text-white'
                                : 'text-red-500 font-semibold'
                            }`}
                          >
                            {item.onHand.toLocaleString('vi-VN')}
                          </span>
                          {item.reserved > 0 && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                              (giữ {item.reserved})
                            </span>
                          )}
                        </div>
                      </SystemTd>

                      {/* Tồn khả dụng */}
                      <SystemTd className="text-right font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {item.available.toLocaleString('vi-VN')}
                      </SystemTd>

                      {/* Đối soát chênh lệch */}
                      <SystemTd className="text-center">
                        <div className="inline-flex flex-col items-center">
                          {isBalanced && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 size={11} /> Khớp (0)
                            </span>
                          )}
                          {isSurplus && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <AlertTriangle size={11} /> Thừa (+{item.discrepancy})
                            </span>
                          )}
                          {isDeficit && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              <AlertCircle size={11} /> Thiếu ({item.discrepancy})
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 mt-0.5 font-mono">
                            Lý thuyết: {item.calculatedStock}
                          </span>
                        </div>
                      </SystemTd>

                      {/* Tỷ lệ xuất / nhập */}
                      <SystemTd className="text-center">
                        <div className="flex flex-col items-center w-24 mx-auto">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 font-mono">
                            {item.fulfillmentRatePercent}%
                          </span>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.fulfillmentRatePercent >= 100
                                  ? 'bg-rose-500'
                                  : item.fulfillmentRatePercent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-[#5865f2]'
                              }`}
                              style={{ width: `${Math.min(100, item.fulfillmentRatePercent)}%` }}
                            />
                          </div>
                        </div>
                      </SystemTd>

                      {/* Nút Xem chi tiết */}
                      <SystemTd className="text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item.variantId)}
                          className="px-2.5 py-1 text-xs font-medium text-[#5865f2] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                        >
                          Chi tiết
                        </button>
                      </SystemTd>
                    </SystemTr>
                  );
                })
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>

        {/* Mobile List View (Cards view on small screens) */}
        <div className="sm:hidden flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5 custom-scrollbar">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-gray-500 animate-pulse">
              Đang tải danh sách đối soát...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">
              Không có dữ liệu đối soát phù hợp.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.variantId}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2 shadow-xs"
              >
                {/* Header: Name, SKU, Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2">
                      {item.productName}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                        {item.sku}
                      </span>
                      {item.variantName && item.variantName !== item.productName && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {item.variantName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {item.reconciliationStatus === 'BALANCED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 size={10} /> Khớp
                      </span>
                    )}
                    {item.reconciliationStatus === 'SURPLUS' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={10} /> Thừa (+{item.discrepancy})
                      </span>
                    )}
                    {item.reconciliationStatus === 'DEFICIT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                        <AlertCircle size={10} /> Thiếu ({item.discrepancy})
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Metrics: Nhập - Bán - Tồn */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-100 dark:border-gray-800 text-center">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Thực nhập</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        item.importedQuantity > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {item.importedQuantity > 0 ? `+${item.importedQuantity}` : item.importedQuantity}
                    </span>
                    {item.supplierReturnedQuantity && item.supplierReturnedQuantity > 0 ? (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 block font-medium truncate">
                        Trả NCC -{item.supplierReturnedQuantity}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-400 block">{item.receiptsCount} phiếu</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Thực bán</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        item.exportedQuantity > 0
                          ? 'text-[#5865f2] dark:text-indigo-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {item.exportedQuantity > 0 ? `-${item.exportedQuantity}` : item.exportedQuantity}
                    </span>
                    {item.customerReturnedQuantity && item.customerReturnedQuantity > 0 ? (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-medium truncate">
                        Hoàn -{item.customerReturnedQuantity}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-400 block">{item.ordersCount} đơn</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Tồn kho</span>
                    <span className="text-xs font-bold font-mono text-gray-900 dark:text-white">
                      {item.onHand}
                    </span>
                    {item.reserved > 0 && (
                      <span className="text-[9px] text-amber-500 block font-mono">
                        (giữ {item.reserved})
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer action */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[11px] text-gray-500">
                    Tỷ lệ xuất: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.fulfillmentRatePercent}%</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(item.variantId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#5865f2] dark:text-indigo-400"
                  >
                    Xem chi tiết <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom-pinned Pagination Bar */}
        <div className="p-2.5 sm:p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1b23]/30 shrink-0">
          <SystemPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={limit}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      </div>

      {/* Drilldown Modal: Product Reconciliation Detail */}
      {selectedVariantId && (
        <Modal
          isOpen={Boolean(selectedVariantId)}
          onClose={() => setSelectedVariantId(null)}
          title="Chi tiết đối soát đơn hàng & nhập kho"
          subtitle="Đối chiếu các đơn hàng đã xuất bán và các lần nhập hàng của SKU hệ thống"
          icon={Layers}
          maxWidth="max-w-4xl"
        >
          <ModalBody className="p-3 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {isLoadingDetail ? (
              <div className="py-12 text-center text-xs text-gray-500 animate-pulse">
                Đang tải dữ liệu chi tiết đơn hàng và phiếu nhập...
              </div>
            ) : !detailData ? (
              <div className="py-12 text-center text-xs text-gray-500">
                Không tìm thấy dữ liệu giao dịch cho sản phẩm này.
              </div>
            ) : (
              <>
                {/* Variant Header Info Card */}
                <div className="p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                        {detailData.variant.product?.name || detailData.variant.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                          SKU: {detailData.variant.sku}
                        </span>
                        {detailData.variant.barcode && (
                          <span className="font-mono text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            Barcode: {detailData.variant.barcode}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Đơn vị: {detailData.variant.unit}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-gray-400 block">Giá vốn niêm yết</span>
                      <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                        {detailData.variant.costPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-center">
                    <div className="p-2 rounded bg-white dark:bg-[#131720]">
                      <span className="text-[10px] text-gray-400 block">Thực nhập kho</span>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.max(
                          0,
                          detailData.receipts.reduce((s, r) => s + r.receivedQuantity, 0) -
                            (detailData.purchaseReturns?.reduce((s, pr) => s + pr.quantity, 0) || 0)
                        )}{' '}
                        {detailData.variant.unit}
                      </span>
                      {detailData.purchaseReturns && detailData.purchaseReturns.length > 0 ? (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 block font-medium">
                          (Nhập: {detailData.receipts.reduce((s, r) => s + r.receivedQuantity, 0)} • Trả NCC:{' '}
                          {detailData.purchaseReturns.reduce((s, pr) => s + pr.quantity, 0)})
                        </span>
                      ) : null}
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720]">
                      <span className="text-[10px] text-gray-400 block">Thực xuất bán (Đơn)</span>
                      <span className="font-mono text-xs font-bold text-[#5865f2] dark:text-indigo-400">
                        {Math.max(
                          0,
                          detailData.orders.reduce((s, o) => s + o.quantity, 0) -
                            (detailData.orderReturns?.reduce((s, or) => s + or.sellableQuantity, 0) || 0)
                        )}{' '}
                        {detailData.variant.unit}
                      </span>
                      {detailData.orderReturns && detailData.orderReturns.length > 0 ? (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-medium">
                          (Đơn: {detailData.orders.reduce((s, o) => s + o.quantity, 0)} • Hoàn:{' '}
                          {detailData.orderReturns.reduce((s, or) => s + or.sellableQuantity, 0)})
                        </span>
                      ) : null}
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720]">
                      <span className="text-[10px] text-gray-400 block">Tồn kho thực tế</span>
                      <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                        {detailData.inventoryBalances.reduce((s, b) => s + b.onHand, 0)} {detailData.variant.unit}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720]">
                      <span className="text-[10px] text-gray-400 block">Tồn khả dụng</span>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {detailData.inventoryBalances.reduce((s, b) => s + b.available, 0)} {detailData.variant.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabs selection */}
                <div className="flex items-center gap-1.5 sm:gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none pb-0.5">
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('ORDERS')}
                    className={`pb-2 px-2.5 sm:px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      detailActiveTab === 'ORDERS'
                        ? 'border-[#5865f2] text-[#5865f2] dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Đơn hàng xuất đi ({detailData.orders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('RECEIPTS')}
                    className={`pb-2 px-2.5 sm:px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      detailActiveTab === 'RECEIPTS'
                        ? 'border-[#5865f2] text-[#5865f2] dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Lịch sử nhập kho ({detailData.receipts.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('PURCHASE_RETURNS')}
                    className={`pb-2 px-2.5 sm:px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      detailActiveTab === 'PURCHASE_RETURNS'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Trả hàng NCC</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        (detailData.purchaseReturns?.length || 0) > 0
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {detailData.purchaseReturns?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('ORDER_RETURNS')}
                    className={`pb-2 px-2.5 sm:px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      detailActiveTab === 'ORDER_RETURNS'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Khách hoàn</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        (detailData.orderReturns?.length || 0) > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {detailData.orderReturns?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab('WAREHOUSES')}
                    className={`pb-2 px-2.5 sm:px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      detailActiveTab === 'WAREHOUSES'
                        ? 'border-[#5865f2] text-[#5865f2] dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Tồn theo kho ({detailData.inventoryBalances.length})
                  </button>
                </div>

                {/* Tab 1: Orders breakdown */}
                {detailActiveTab === 'ORDERS' && (
                  <div className="space-y-2">
                    {detailData.orders.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-500">
                        Chưa có đơn hàng nào xuất bán biến thể này trong kỳ đối soát.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                            <tr>
                              <th className="p-2.5">Mã đơn hàng</th>
                              <th className="p-2.5">Mã vận đơn</th>
                              <th className="p-2.5">Shop bán</th>
                              <th className="p-2.5">Ngày đặt</th>
                              <th className="p-2.5 text-center">Số lượng</th>
                              <th className="p-2.5 text-right">Đơn giá</th>
                              <th className="p-2.5 text-center">Trạng thái sàn</th>
                              <th className="p-2.5 text-center">Xuất kho</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {detailData.orders.map((o) => (
                              <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-gray-900 dark:text-white">
                                  {o.internalOrderCode || o.externalOrderId}
                                </td>
                                <td className="p-2.5 font-mono text-gray-600 dark:text-gray-400">
                                  {o.trackingCode || '—'}
                                </td>
                                <td className="p-2.5 text-gray-800 dark:text-gray-200">
                                  {o.shopName}
                                </td>
                                <td className="p-2.5 text-gray-500">
                                  {o.orderDate ? new Date(o.orderDate).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                                  {o.quantity}
                                </td>
                                <td className="p-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {o.discountedPrice.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                    {o.platformStatus}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      o.fulfillmentStatus === 'DISPATCHED'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {o.fulfillmentStatus === 'DISPATCHED' ? 'Đã quét xuất' : 'Chờ xuất'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Purchase receipts breakdown */}
                {detailActiveTab === 'RECEIPTS' && (
                  <div className="space-y-2">
                    {detailData.receipts.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-500">
                        Chưa có phiếu nhập kho nào cho sản phẩm này trong kỳ đối soát.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                            <tr>
                              <th className="p-2.5">Mã phiếu nhập</th>
                              <th className="p-2.5">Nhà cung cấp</th>
                              <th className="p-2.5">Kho nhận</th>
                              <th className="p-2.5">Ngày nhập</th>
                              <th className="p-2.5 text-center">Thực nhận</th>
                              <th className="p-2.5 text-right">Đơn giá nhập</th>
                              <th className="p-2.5 text-right">Thành tiền</th>
                              <th className="p-2.5 text-center">Thanh toán</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {detailData.receipts.map((r) => (
                              <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                                  {r.receiptCode}
                                </td>
                                <td className="p-2.5 text-gray-800 dark:text-gray-200">
                                  {r.supplierName}
                                </td>
                                <td className="p-2.5 text-gray-600 dark:text-gray-400">
                                  {r.warehouseName}
                                </td>
                                <td className="p-2.5 text-gray-500">
                                  {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  +{r.receivedQuantity}
                                </td>
                                <td className="p-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {r.unitPrice.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="p-2.5 text-right font-mono font-semibold text-gray-900 dark:text-white">
                                  {r.subtotal.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                    {r.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Purchase Returns to Supplier */}
                {detailActiveTab === 'PURCHASE_RETURNS' && (
                  <div className="space-y-2">
                    {(!detailData.purchaseReturns || detailData.purchaseReturns.length === 0) ? (
                      <div className="py-8 text-center text-xs text-gray-500">
                        Chưa có phiếu xuất trả hàng nhà cung cấp nào cho sản phẩm này trong kỳ đối soát.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                            <tr>
                              <th className="p-2.5">Mã phiếu trả</th>
                              <th className="p-2.5">Nhà cung cấp</th>
                              <th className="p-2.5">Phiếu nhập gốc</th>
                              <th className="p-2.5">Ngày xuất trả</th>
                              <th className="p-2.5 text-center">SL xuất trả</th>
                              <th className="p-2.5 text-right">Đơn giá hoàn</th>
                              <th className="p-2.5 text-right">Giảm trừ nợ</th>
                              <th className="p-2.5">Lý do / Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {detailData.purchaseReturns.map((pr) => (
                              <tr key={pr.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {pr.returnCode}
                                </td>
                                <td className="p-2.5 text-gray-800 dark:text-gray-200">
                                  {pr.supplierName}
                                </td>
                                <td className="p-2.5 font-mono text-gray-500">
                                  {pr.receiptCode || '—'}
                                </td>
                                <td className="p-2.5 text-gray-500">
                                  {pr.returnDate ? new Date(pr.returnDate).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                                  -{pr.quantity}
                                </td>
                                <td className="p-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {pr.unitPrice.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="p-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {pr.debtOffsetAmount.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="p-2.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                  {pr.reason || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Customer Order Returns */}
                {detailActiveTab === 'ORDER_RETURNS' && (
                  <div className="space-y-2">
                    {(!detailData.orderReturns || detailData.orderReturns.length === 0) ? (
                      <div className="py-8 text-center text-xs text-gray-500">
                        Chưa có đơn hàng khách hoàn nào được kiểm tra nhập kho cho sản phẩm này.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                            <tr>
                              <th className="p-2.5">Mã phiếu hoàn</th>
                              <th className="p-2.5">Mã đơn hàng</th>
                              <th className="p-2.5">Mã vận đơn</th>
                              <th className="p-2.5">Gian hàng</th>
                              <th className="p-2.5">Ngày nhận</th>
                              <th className="p-2.5 text-center">Bán lại được</th>
                              <th className="p-2.5 text-center">Hàng lỗi/hỏng</th>
                              <th className="p-2.5">Lý do hoàn</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {detailData.orderReturns.map((or) => (
                              <tr key={or.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {or.returnCode}
                                </td>
                                <td className="p-2.5 font-mono text-gray-900 dark:text-white">
                                  {or.orderCode || '—'}
                                </td>
                                <td className="p-2.5 font-mono text-gray-500">
                                  {or.trackingCode || '—'}
                                </td>
                                <td className="p-2.5 text-gray-800 dark:text-gray-200">
                                  {or.shopName}
                                </td>
                                <td className="p-2.5 text-gray-500">
                                  {or.receivedDate ? new Date(or.receivedDate).toLocaleDateString('vi-VN') : '—'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  +{or.sellableQuantity}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-rose-500">
                                  {or.damagedQuantity > 0 ? `+${or.damagedQuantity}` : '0'}
                                </td>
                                <td className="p-2.5 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                  {or.reason || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Warehouse balances */}
                {detailActiveTab === 'WAREHOUSES' && (
                  <div className="space-y-2">
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                          <tr>
                            <th className="p-2.5">Kho hàng</th>
                            <th className="p-2.5">Mã kho</th>
                            <th className="p-2.5 text-right">Tồn thực tế (On-hand)</th>
                            <th className="p-2.5 text-right">Đang giữ cho đơn</th>
                            <th className="p-2.5 text-right">Tồn khả dụng</th>
                            <th className="p-2.5 text-right">Hàng lỗi / hỏng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {detailData.inventoryBalances.map((b) => (
                            <tr key={b.warehouseId} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                              <td className="p-2.5 font-medium text-gray-900 dark:text-white">
                                {b.warehouseName}
                              </td>
                              <td className="p-2.5 font-mono text-gray-500">
                                {b.warehouseCode}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {b.onHand.toLocaleString('vi-VN')}
                              </td>
                              <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                                {b.reserved.toLocaleString('vi-VN')}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {b.available.toLocaleString('vi-VN')}
                              </td>
                              <td className="p-2.5 text-right font-mono text-rose-500">
                                {b.damaged.toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>
        </Modal>
      )}
    </div>
  );
};

export default OrderReportsPage;
