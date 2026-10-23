import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PackagePlus,
  RefreshCw,
  Building2,
  Store,
  DollarSign,
  CreditCard,
  Boxes,
  TrendingUp,
  Download,
  AlertCircle,
  Clock,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Package,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import * as XLSX from 'xlsx';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { reportsApi, PurchaseReportData } from '../../services/reportsApi';
import { shopsApi } from '../../services/shopsApi';
import { suppliersApi } from '../../services/suppliersApi';
import { SystemDatePicker } from '../../components/ui/SystemDatePicker';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemFilter,
  SystemFilterSearch,
  SystemFilterReset,
} from '../../components/ui/SystemFilter';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemMobileEmpty,
  SystemTableSkeleton,
  SystemPagination,
} from '../../components/ui/SystemTable';
import { toast } from '../../components/ui/Toast';

export const PurchaseReportsPage: React.FC = () => {
  const [data, setData] = useState<PurchaseReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'DATES' | 'SUPPLIERS' | 'PRODUCTS' | 'SHOPS' | 'RECEIPTS'>('DATES');
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Record<string, boolean>>({});
  const [expandedProductSkus, setExpandedProductSkus] = useState<Record<string, boolean>>({});
  const [showChart, setShowChart] = useState<boolean>(true);

  // Receipt items modal
  const [selectedReceiptForItems, setSelectedReceiptForItems] = useState<any | null>(null);
  const [isReceiptItemsModalOpen, setIsReceiptItemsModalOpen] = useState<boolean>(false);

  const [expandedSupplierSkuKeys, setExpandedSupplierSkuKeys] = useState<Record<string, boolean>>({});

  const toggleExpandProduct = (sku: string) => {
    setExpandedProductSkus((prev) => ({
      ...prev,
      [sku]: !prev[sku],
    }));
  };

  const toggleExpandSupplierSku = (key: string) => {
    setExpandedSupplierSkuKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Filters & Workspace Header Sync
  const { selectedShopId: headerSelectedShopId, shops: workspaceShops } = useWorkspaceStore();
  const [selectedShopId, setSelectedShopId] = useState<string>(headerSelectedShopId || 'ALL');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Dropdown options
  const [shops, setShops] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  // Auto-sync shop selection when user switches shop in AppHeader
  useEffect(() => {
    if (headerSelectedShopId !== undefined) {
      setSelectedShopId(headerSelectedShopId);
    }
  }, [headerSelectedShopId]);

  useEffect(() => {
    if (workspaceShops && workspaceShops.length > 0 && shops.length === 0) {
      setShops(workspaceShops);
    }
  }, [workspaceShops, shops.length]);

  const toggleExpandSupplier = (supId: string) => {
    setExpandedSupplierIds((prev) => ({
      ...prev,
      [supId]: !prev[supId],
    }));
  };

  const formatVietnameseDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        const dayName = days[d.getDay()] || '';
        return `${parts[2]}/${parts[1]}/${parts[0]} (${dayName})`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Safe load Shop & Supplier metadata with Promise.allSettled
  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        const [shopsResult, supsResult] = await Promise.allSettled([
          shopsApi.findAll(),
          suppliersApi.findAll({ status: 'ACTIVE' }),
        ]);

        if (!isMounted) return;

        if (shopsResult.status === 'fulfilled') {
          const res: any = shopsResult.value;
          const data = res?.data || (Array.isArray(res) ? res : res?.items || []);
          if (Array.isArray(data)) setShops(data);
        }

        if (supsResult.status === 'fulfilled') {
          const res: any = supsResult.value;
          const data = res?.data || (Array.isArray(res) ? res : res?.items || []);
          if (Array.isArray(data)) setSuppliers(data);
        }
      } catch (err) {
        console.warn('Lỗi nạp danh sách cửa hàng/NCC (suppressed):', err);
      }
    };
    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Quick Date Presets Handler
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatYMD(yesterday);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    }
  };

  // Load report data
  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getPurchaseReport({
        shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
        supplierId: selectedSupplierId === 'ALL' ? undefined : selectedSupplierId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Lỗi tải báo cáo nhập hàng:', err);
      toast.error('Không thể tải dữ liệu báo cáo nhập hàng');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedShopId, selectedSupplierId, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReport();
  };

  const handleResetFilters = () => {
    setSelectedShopId('ALL');
    setSelectedSupplierId('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!data) return;

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp
      const summarySheetData = [
        ['CHỈ SỐ BÁO CÁO NHẬP HÀNG', 'GIÁ TRỊ'],
        ['Tổng số phiếu nhập', data.summary.totalReceipts],
        ['Tổng số lượng nhập kho', data.summary.totalReceivedQuantity],
        ['Tổng số mã SKU nhập', data.summary.uniqueSkusCount],
        ['Tổng giá trị hàng nhập (Gốc)', data.summary.totalItemsAmount],
        ['Tổng giảm trừ do trả hàng', data.summary.totalReturnDeductionAmount],
        ['Tổng tiền hàng nhập thực tế (Net)', data.summary.netItemsAmount],
        ['Tổng tiền phải trả NCC', data.summary.totalPayableAmount],
        ['Đã thanh toán cho NCC', data.summary.totalPaidAmount],
        ['Còn nợ nhà cung cấp', data.summary.totalRemainingAmount],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan');

      // Sheet 2: Theo Ngày Nhập
      const dateList = data.byDate || data.dailyTrend || [];
      if (dateList.length > 0) {
        const dateSheetData = [
          ['Ngày Nhập', 'Số Phiếu', 'Số Lượng', 'Tổng Tiền Gốc', 'Đã Trừ Trả', 'Tiền Net', 'Đã Trả', 'Còn Nợ'],
          ...dateList.map((d) => [
            d.date,
            d.count,
            d.quantity,
            d.totalAmount,
            d.returnDeduction,
            d.netAmount,
            d.paidAmount || 0,
            d.remainingAmount || 0,
          ]),
        ];
        const wsDate = XLSX.utils.aoa_to_sheet(dateSheetData);
        XLSX.utils.book_append_sheet(wb, wsDate, 'Theo Ngày Nhập');
      }

      // Sheet 3: Theo Nhà cung cấp
      if (data.bySupplier && data.bySupplier.length > 0) {
        const supSheetData = [
          ['Mã NCC', 'Tên Nhà Cung Cấp', 'Số Phiếu', 'Số SKU', 'Số Lượng', 'Tổng Tiền Gốc', 'Đã Trừ Trả', 'Tiền Net', 'Đã Trả', 'Còn Nợ'],
          ...data.bySupplier.map((s) => [
            s.supplierCode,
            s.supplierName,
            s.count,
            s.skusCount || s.skus?.length || 0,
            s.quantity,
            s.totalAmount,
            s.returnDeduction,
            s.netAmount,
            s.paidAmount,
            s.remainingAmount,
          ]),
        ];
        const wsSup = XLSX.utils.aoa_to_sheet(supSheetData);
        XLSX.utils.book_append_sheet(wb, wsSup, 'Theo Nhà Cung Cấp');

        // Sheet 4: Chi tiết từng SKU nhập theo từng Nhà cung cấp
        const supSkusData: any[] = [
          ['Mã NCC', 'Tên Nhà Cung Cấp', 'Mã SKU', 'Tên Sản Phẩm', 'Phân Loại', 'Số Lần Nhập', 'Số Lượng Nhập', 'Đơn Giá BQ', 'Thành Tiền'],
        ];
        for (const s of data.bySupplier) {
          if (s.skus && s.skus.length > 0) {
            for (const it of s.skus) {
              supSkusData.push([
                s.supplierCode,
                s.supplierName,
                it.sku,
                it.productName,
                it.variationName || '',
                it.receiptsCount,
                it.quantity,
                it.avgPrice,
                it.totalAmount,
              ]);
            }
          }
        }
        if (supSkusData.length > 1) {
          const wsSupSkus = XLSX.utils.aoa_to_sheet(supSkusData);
          XLSX.utils.book_append_sheet(wb, wsSupSkus, 'SKU Chi Tiết Theo NCC');
        }
      }

      // Sheet 5: Theo Cửa hàng
      if (data.byShop && data.byShop.length > 0) {
        const shopSheetData = [
          ['Mã Shop', 'Tên Cửa Hàng', 'Số Phiếu', 'Số Lượng', 'Tổng Tiền Gốc', 'Đã Trừ Trả', 'Tiền Net', 'Đã Trả', 'Còn Nợ'],
          ...data.byShop.map((s) => [
            s.shopCode,
            s.shopName,
            s.count,
            s.quantity,
            s.totalAmount,
            s.returnDeduction,
            s.netAmount,
            s.paidAmount,
            s.remainingAmount,
          ]),
        ];
        const wsShop = XLSX.utils.aoa_to_sheet(shopSheetData);
        XLSX.utils.book_append_sheet(wb, wsShop, 'Theo Cửa Hàng');
      }

      // Sheet 6: Top sản phẩm SKU
      if (data.topProducts && data.topProducts.length > 0) {
        const prodSheetData = [
          ['Mã SKU', 'Tên Sản Phẩm', 'Phân Loại', 'Nhà Cung Cấp', 'Số Lượng Nhập', 'Đơn Giá BQ', 'Tổng Tiền'],
          ...data.topProducts.map((p) => [
            p.sku,
            p.productName,
            p.variationName || '',
            p.suppliers ? p.suppliers.join(', ') : '',
            p.quantity,
            p.avgPrice,
            p.totalAmount,
          ]),
        ];
        const wsProd = XLSX.utils.aoa_to_sheet(prodSheetData);
        XLSX.utils.book_append_sheet(wb, wsProd, 'Sản Phẩm Nhập Kho');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Bao_Cao_Nhap_Hang_${dateStr}.xlsx`);
      toast.success('Đã xuất file báo cáo Excel thành công');
    } catch (err) {
      console.error('Lỗi xuất file Excel:', err);
      toast.error('Có lỗi xảy ra khi tạo file Excel');
    }
  };

  const chartData = useMemo(() => {
    if (!data?.dailyTrend) return [];
    return data.dailyTrend.map((d) => ({
      date: d.date.slice(5), // MM-DD
      fullDate: d.date,
      netAmount: d.netAmount,
      quantity: d.quantity,
      count: d.count,
    }));
  }, [data?.dailyTrend]);

  const summary = data?.summary || {
    totalReceipts: 0,
    totalItemsAmount: 0,
    totalReturnDeductionAmount: 0,
    netItemsAmount: 0,
    totalPayableAmount: 0,
    totalPaidAmount: 0,
    totalRemainingAmount: 0,
    totalReceivedQuantity: 0,
    totalDisputedQuantity: 0,
    uniqueSkusCount: 0,
  };

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedShopId, selectedSupplierId, startDate, endDate, searchTerm]);

  const paginatedDates = useMemo(() => {
    const list = data?.byDate || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [data?.byDate, page, pageSize]);

  const paginatedSuppliers = useMemo(() => {
    const list = data?.bySupplier || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [data?.bySupplier, page, pageSize]);

  const paginatedProducts = useMemo(() => {
    const list = data?.topProducts || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [data?.topProducts, page, pageSize]);

  const paginatedShops = useMemo(() => {
    const list = data?.byShop || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [data?.byShop, page, pageSize]);

  const paginatedReceipts = useMemo(() => {
    const list = data?.receipts || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [data?.receipts, page, pageSize]);

  const hasFilterActive = Boolean(
    selectedShopId !== 'ALL' ||
    selectedSupplierId !== 'ALL' ||
    datePreset !== 'ALL' ||
    startDate ||
    endDate ||
    searchTerm.trim()
  );

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:h-full md:overflow-hidden space-y-2.5 sm:space-y-3 animate-in fade-in duration-300 max-w-full min-w-0">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
              <PackagePlus size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
              <span className="sm:hidden truncate">Báo cáo nhập</span>
              <span className="hidden sm:inline truncate">Báo Cáo Nhập Hàng</span>
            </h1>
            {selectedShopId && selectedShopId !== 'ALL' && selectedShopId !== 'CENTRAL' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0 whitespace-nowrap">
                <Store size={12} />
                <span>Shop: {shops.find((s) => s.id === selectedShopId)?.name || selectedShopId}</span>
              </span>
            ) : selectedShopId === 'CENTRAL' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shrink-0 whitespace-nowrap">
                <Building2 size={12} />
                <span>Kho chung</span>
              </span>
            ) : null}
          </div>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Tổng hợp dữ liệu nhập kho theo từng cửa hàng từ Header, nhà cung cấp, phân bổ chi phí & xu hướng nhập hàng
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link to="/purchase-receipts">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2.5 sm:px-3 text-[#5865f2] border-[#5865f2]/30 hover:bg-[#5865f2]/10"
              title="Xem danh sách quản lý phiếu nhập kho"
            >
              <Receipt size={14} />
              <span className="hidden sm:inline">Quản lý phiếu nhập</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!data || data.summary.totalReceipts === 0}
            className="gap-1.5 px-2.5 sm:px-3 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            title="Xuất file Excel"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">Xuất Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={isLoading}
            className="gap-1.5 p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Hàng thực nhận (Net)',
            value: `${summary.netItemsAmount.toLocaleString('vi-VN')}đ`,
            subtitle:
              summary.totalReturnDeductionAmount > 0
                ? `Đã trừ hàng trả: -${summary.totalReturnDeductionAmount.toLocaleString('vi-VN')}đ (Gốc: ${summary.totalItemsAmount.toLocaleString('vi-VN')}đ)`
                : `Từ ${summary.totalReceipts} phiếu nhập`,
            icon: PackagePlus,
            colorScheme: 'blue',
          }}
          rightItem={{
            title: 'Tổng số lượng nhập kho',
            value: `${summary.totalReceivedQuantity.toLocaleString('vi-VN')} cái`,
            subtitle: `${summary.uniqueSkusCount} SKU độc lập đã nhập`,
            icon: Boxes,
            colorScheme: 'indigo',
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Đã thanh toán cho NCC',
            value: `${summary.totalPaidAmount.toLocaleString('vi-VN')}đ`,
            subtitle:
              summary.totalReturnDeductionAmount > 0
                ? `Thực chi quỹ/ngân hàng • Trả hàng: ${summary.totalReturnDeductionAmount.toLocaleString('vi-VN')}đ`
                : 'Thực tế đã chi trả cho nhà cung cấp',
            icon: CreditCard,
            colorScheme: 'green',
          }}
          rightItem={{
            title: 'Còn nợ nhà cung cấp',
            value: `${summary.totalRemainingAmount.toLocaleString('vi-VN')}đ`,
            subtitle:
              summary.totalRemainingAmount > 0
                ? 'Công nợ nhập hàng cần thanh toán'
                : 'Đã hoàn tất thanh toán đủ',
            icon: Receipt,
            colorScheme: summary.totalRemainingAmount > 0 ? 'orange' : 'green',
          }}
        />
      </div>

      {/* Unified Filters Bar */}
      <SystemFilter className="p-2.5 sm:p-3 flex-col sm:flex-row items-stretch sm:items-center">
        {/* Quick Date Presets Chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'TODAY', label: 'Hôm nay' },
            { id: 'YESTERDAY', label: 'Hôm qua' },
            { id: 'LAST_7_DAYS', label: '7 ngày' },
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

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {/* Custom Date Range Picker */}
          <div className="w-full sm:w-[220px]">
            <SystemDatePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start || '');
                setEndDate(end || '');
                setDatePreset(start || end ? 'CUSTOM' : 'ALL');
              }}
              size="sm"
              className="w-full"
              placeholder="Khoảng ngày nhập..."
            />
          </div>

          {/* Shop Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedShopId}
              onChange={(val) => setSelectedShopId(String(val))}
              options={[
                { value: 'ALL', label: 'Tất cả cửa hàng (Shop)', icon: Store },
                { value: 'CENTRAL', label: 'Kho chung / Chưa gán shop', icon: Building2 },
                ...shops.map((s) => ({
                  value: s.id,
                  label: s.code ? `[${s.code}] ${s.name}` : s.name,
                  icon: Store,
                })),
              ]}
              icon={Store}
              size="sm"
            />
          </div>

          {/* Supplier Filter */}
          <div className="w-full sm:w-52">
            <Select
              value={selectedSupplierId}
              onChange={(val) => setSelectedSupplierId(String(val))}
              options={[
                { value: 'ALL', label: 'Tất cả Nhà Cung Cấp', icon: Building2 },
                ...suppliers.map((s) => ({
                  value: s.id,
                  label: s.code ? `${s.code} - ${s.name}` : s.name,
                  icon: Building2,
                })),
              ]}
              icon={Building2}
              size="sm"
            />
          </div>

          {/* Search & Reset */}
          <div className="w-full sm:w-60 flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <SystemFilterSearch
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã phiếu, SKU, NCC..."
                className="w-full"
              />
            </form>
            {hasFilterActive && (
              <SystemFilterReset onClick={handleResetFilters} className="shrink-0" />
            )}
          </div>
        </div>
      </SystemFilter>

      {/* Chart Section */}
      <div className="bg-white dark:bg-[#14151a] p-3 sm:p-4 rounded border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <TrendingUp size={16} className="text-[#5865f2] shrink-0" />
              <span>Biểu Đồ Xu Hướng Nhập Hàng Theo Ngày</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 hidden sm:block">
              Đường biến thiên giá trị nhập thực nhận (VND) và số lượng sản phẩm nhập kho
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChart(!showChart)}
            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white gap-1 h-7 px-2"
          >
            {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="hidden sm:inline">{showChart ? 'Thu gọn biểu đồ' : 'Mở biểu đồ'}</span>
          </Button>
        </div>

        {showChart && (
          <>
            {chartData.length === 0 ? (
              <div className="h-[160px] sm:h-[200px] flex flex-col items-center justify-center text-gray-400 text-xs">
                <AlertCircle size={22} className="mb-2 opacity-50" />
                Không có dữ liệu nhập hàng trong khoảng thời gian đã chọn
              </div>
            ) : (
              <div className="h-[180px] sm:h-[220px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5865f2" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#5865f2" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#888' }}
                      tickFormatter={(val) => (val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${val.toLocaleString('vi-VN')}`)}
                    />
                    <Tooltip
                      formatter={(val: any, name: string) => {
                        if (name === 'netAmount') return [`${Number(val).toLocaleString('vi-VN')}đ`, 'Tiền nhập Net'];
                        if (name === 'quantity') return [`${Number(val).toLocaleString('vi-VN')} cái`, 'Số lượng'];
                        return [val, name];
                      }}
                      labelFormatter={(lbl) => `Ngày ${lbl}`}
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderColor: '#374151',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="netAmount"
                      name="netAmount"
                      stroke="#5865f2"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAmount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-full sm:w-fit shrink-0 max-w-full overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('DATES')}
          className={`px-2.5 sm:px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'DATES'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Calendar size={14} className="shrink-0" />
          <span className="sm:hidden">Theo Ngày ({data?.byDate?.length || data?.dailyTrend?.length || 0})</span>
          <span className="hidden sm:inline">Theo Ngày Nhập ({data?.byDate?.length || data?.dailyTrend?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`px-2.5 sm:px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'SUPPLIERS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Building2 size={14} className="shrink-0" />
          <span className="sm:hidden">Theo NCC ({data?.bySupplier?.length || 0})</span>
          <span className="hidden sm:inline">Theo Nhà Cung Cấp ({data?.bySupplier?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-2.5 sm:px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'PRODUCTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Boxes size={14} className="shrink-0" />
          <span className="sm:hidden">Sản Phẩm ({data?.topProducts?.length || 0})</span>
          <span className="hidden sm:inline">Sản Phẩm & SKU Nhập ({data?.topProducts?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('SHOPS')}
          className={`px-2.5 sm:px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'SHOPS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Store size={14} className="shrink-0" />
          <span className="sm:hidden">Theo Shop ({data?.byShop?.length || 0})</span>
          <span className="hidden sm:inline">Theo Cửa Hàng (Shop) ({data?.byShop?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('RECEIPTS')}
          className={`px-2.5 sm:px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'RECEIPTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Receipt size={14} className="shrink-0" />
          <span className="sm:hidden">Phiếu Nhập ({data?.receipts?.length || 0})</span>
          <span className="hidden sm:inline">Phiếu Nhập Gần Đây ({data?.receipts?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: THEO NGÀY NHẬP */}
      {activeTab === 'DATES' && (
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:overflow-hidden bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
          {/* Desktop Table */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-[180px]">Ngày nhập hàng</SystemTh>
                  <SystemTh className="w-[100px] text-center">Số phiếu</SystemTh>
                  <SystemTh className="w-[120px] text-center">Số lượng nhập</SystemTh>
                  <SystemTh className="w-[150px] text-right">Tổng tiền hàng gốc</SystemTh>
                  <SystemTh className="w-[130px] text-right">Đã trừ trả hàng</SystemTh>
                  <SystemTh className="w-[170px] text-right">Tiền nhập thực nhận (Net)</SystemTh>
                  <SystemTh className="w-[140px] text-right">Đã thanh toán</SystemTh>
                  <SystemTh className="w-[140px] text-right">Còn nợ NCC</SystemTh>
                  <SystemTh className="w-[100px] text-right">Tỷ trọng</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton rows={5} columns={9} />
                ) : !data?.byDate || data.byDate.length === 0 ? (
                  <SystemTableEmpty colSpan={9} message="Không có số liệu nhập hàng theo ngày trong khoảng thời gian đã chọn" />
                ) : (
                  paginatedDates.map((d) => {
                    const percent =
                      summary.netItemsAmount > 0
                        ? ((d.netAmount / summary.netItemsAmount) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <SystemTr key={d.date}>
                        <SystemTd>
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Calendar size={14} className="text-[#5865f2]" />
                            <span>{formatVietnameseDate(d.date)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            ISO: {d.date}
                          </div>
                        </SystemTd>
                        <SystemTd className="text-center font-semibold text-gray-800 dark:text-gray-200">
                          {d.count}
                        </SystemTd>
                        <SystemTd className="text-center font-mono font-medium text-gray-800 dark:text-gray-200">
                          {d.quantity.toLocaleString('vi-VN')}
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-gray-600 dark:text-gray-300">
                          {d.totalAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-orange-500">
                          {d.returnDeduction > 0 ? `-${d.returnDeduction.toLocaleString('vi-VN')}đ` : '0đ'}
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                          {d.netAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {(d.paidAmount || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-semibold text-orange-600 dark:text-orange-400">
                          {(d.remainingAmount || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-medium text-xs text-gray-500 dark:text-gray-400">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {percent}%
                          </span>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Desktop Pagination */}
            {data?.byDate && data.byDate.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.byDate.length / pageSize))}
                  totalItems={data.byDate.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-3 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : !data?.byDate || data.byDate.length === 0 ? (
              <SystemMobileEmpty message="Không có số liệu nhập hàng theo ngày trong khoảng thời gian đã chọn" />
            ) : (
              paginatedDates.map((d) => {
                const percent =
                  summary.netItemsAmount > 0
                    ? ((d.netAmount / summary.netItemsAmount) * 100).toFixed(1)
                    : '0.0';
                return (
                  <div
                    key={d.date}
                    className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2 shadow-none"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-2">
                      <div>
                        <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#5865f2] shrink-0" />
                          <span>{formatVietnameseDate(d.date)}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{d.date}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2]">
                          {d.count} phiếu
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {percent}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-gray-400 block">Số lượng nhập:</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                          {d.quantity.toLocaleString('vi-VN')} cái
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Tiền hàng gốc:</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">
                          {d.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {d.returnDeduction > 0 && (
                        <div className="col-span-2 text-[11px] text-orange-500 font-mono">
                          Trừ trả hàng: -{d.returnDeduction.toLocaleString('vi-VN')}đ
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] text-gray-400 block">Thực nhận (Net):</span>
                        <span className="font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                          {d.netAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Đã thanh toán:</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {(d.paidAmount || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {(d.remainingAmount || 0) > 0 && (
                        <div className="col-span-2 pt-1 border-t border-dashed border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                          <span className="text-gray-400">Còn nợ NCC:</span>
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {(d.remainingAmount || 0).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {data?.byDate && data.byDate.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.byDate.length / pageSize))}
                  totalItems={data.byDate.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: THEO NHÀ CUNG CẤP & CHI TIẾT TỪNG MÃ SKU */}
      {activeTab === 'SUPPLIERS' && (
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:overflow-hidden bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-9 text-center"></SystemTh>
                  <SystemTh className="w-[220px]">Nhà cung cấp</SystemTh>
                  <SystemTh className="w-[90px] text-center">Số phiếu</SystemTh>
                  <SystemTh className="w-[110px] text-center">Số SKU nhập</SystemTh>
                  <SystemTh className="w-[120px] text-center">Số lượng nhập</SystemTh>
                  <SystemTh className="w-[150px] text-right">Tổng tiền hàng gốc</SystemTh>
                  <SystemTh className="w-[130px] text-right">Đã trừ trả hàng</SystemTh>
                  <SystemTh className="w-[170px] text-right">Tiền nhập thực nhận (Net)</SystemTh>
                  <SystemTh className="w-[140px] text-right">Đã thanh toán</SystemTh>
                  <SystemTh className="w-[140px] text-right">Còn nợ NCC</SystemTh>
                  <SystemTh className="w-[120px] text-right">Tỷ lệ thanh toán</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton rows={4} columns={11} />
                ) : !data?.bySupplier || data.bySupplier.length === 0 ? (
                  <SystemTableEmpty colSpan={11} message="Không có số liệu nhập hàng cho nhà cung cấp đã chọn" />
                ) : (
                  paginatedSuppliers.map((s) => {
                    const payRate =
                      s.netAmount > 0
                        ? Math.min(100, Math.round((s.paidAmount / s.netAmount) * 100))
                        : 100;
                    const isExpanded = Boolean(expandedSupplierIds[s.supplierId]);
                    const skuList = s.skus || [];

                    return (
                      <React.Fragment key={s.supplierId}>
                        <SystemTr
                          onClick={() => toggleExpandSupplier(s.supplierId)}
                          className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <SystemTd className="text-center p-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandSupplier(s.supplierId);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                              title={isExpanded ? 'Thu gọn SKU' : 'Xem chi tiết các mã SKU'}
                            >
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                          </SystemTd>
                          <SystemTd>
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <Building2 size={14} className="text-orange-500" />
                              <span>{s.supplierName}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              Mã NCC: {s.supplierCode}
                            </div>
                          </SystemTd>
                          <SystemTd className="text-center font-semibold text-gray-800 dark:text-gray-200">
                            {s.count}
                          </SystemTd>
                          <SystemTd className="text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                              {s.skusCount || skuList.length} SKU
                            </span>
                          </SystemTd>
                          <SystemTd className="text-center font-mono font-medium text-gray-800 dark:text-gray-200">
                            {s.quantity.toLocaleString('vi-VN')}
                          </SystemTd>
                          <SystemTd className="text-right font-mono text-gray-600 dark:text-gray-300">
                            {s.totalAmount.toLocaleString('vi-VN')}đ
                          </SystemTd>
                          <SystemTd className="text-right font-mono text-orange-500">
                            {s.returnDeduction > 0 ? `-${s.returnDeduction.toLocaleString('vi-VN')}đ` : '0đ'}
                          </SystemTd>
                          <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                            {s.netAmount.toLocaleString('vi-VN')}đ
                          </SystemTd>
                          <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {s.paidAmount.toLocaleString('vi-VN')}đ
                          </SystemTd>
                          <SystemTd className="text-right font-mono font-semibold text-orange-600 dark:text-orange-400">
                            {s.remainingAmount.toLocaleString('vi-VN')}đ
                          </SystemTd>
                          <SystemTd className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                payRate >= 100
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : payRate > 0
                                    ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                    : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                              }`}
                            >
                              {payRate}%
                            </span>
                          </SystemTd>
                        </SystemTr>

                        {/* Nested SKU Breakdown Row */}
                        {isExpanded && (
                          <SystemTr className="bg-gray-50/70 dark:bg-[#101115]">
                            <SystemTd colSpan={11} className="p-3 sm:p-4">
                              <div className="bg-white dark:bg-[#161820] rounded border border-indigo-200/60 dark:border-indigo-900/40 p-3 shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Boxes size={15} className="text-[#5865f2]" />
                                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                                      Chi tiết từng mã SKU nhập từ NCC: {s.supplierName} ({skuList.length} SKU)
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-gray-500 font-mono">
                                    Tổng số lượng: {s.quantity.toLocaleString('vi-VN')} cái
                                  </span>
                                </div>

                                {skuList.length === 0 ? (
                                  <div className="text-center py-3 text-xs text-gray-400">
                                    Không có chi tiết mã SKU phát sinh cho nhà cung cấp này
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 text-[11px] uppercase tracking-wider bg-gray-50/50 dark:bg-gray-800/30">
                                          <th className="py-2 px-2.5">Mã SKU</th>
                                          <th className="py-2 px-2.5">Tên sản phẩm</th>
                                          <th className="py-2 px-2.5">Phân loại hàng</th>
                                          <th className="py-2 px-2.5 text-center">Số lần nhập</th>
                                          <th className="py-2 px-2.5 text-center font-bold">Số lượng nhập</th>
                                          <th className="py-2 px-2.5 text-right">Đơn giá BQ</th>
                                          <th className="py-2 px-2.5 text-right font-bold">Tổng tiền</th>
                                          <th className="py-2 px-2.5 text-right">Tỷ trọng NCC</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {skuList.map((skuItem, sIdx) => {
                                          const skuRatio = s.totalAmount > 0
                                            ? ((skuItem.totalAmount / s.totalAmount) * 100).toFixed(1)
                                            : '0.0';
                                          const skuKey = `${s.supplierId}-${skuItem.sku}-${sIdx}`;
                                          const isSkuExpanded = Boolean(expandedSupplierSkuKeys[skuKey]);
                                          const skuTxList = skuItem.transactions || [];

                                          return (
                                            <React.Fragment key={skuKey}>
                                              <tr
                                                className="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                                                onClick={() => toggleExpandSupplierSku(skuKey)}
                                              >
                                                <td className="py-2 px-2.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-gray-400">
                                                      {isSkuExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                    </span>
                                                    <span>{skuItem.sku}</span>
                                                  </div>
                                                </td>
                                                <td className="py-2 px-2.5 font-medium text-gray-900 dark:text-white max-w-[260px] truncate">
                                                  {skuItem.productName}
                                                </td>
                                                <td className="py-2 px-2.5 text-gray-500">
                                                  {skuItem.variationName || 'Mặc định'}
                                                </td>
                                                <td className="py-2 px-2.5 text-center text-gray-700 dark:text-gray-300">
                                                  <div className="inline-flex flex-col items-center gap-0.5">
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px]">
                                                      {skuItem.receiptsCount} lần
                                                    </span>
                                                    {skuItem.returnsCount && skuItem.returnsCount > 0 ? (
                                                      <span className="inline-flex items-center px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9px] border border-amber-200/60">
                                                        {skuItem.returnsCount} trả
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-2.5 text-center font-mono font-bold text-gray-900 dark:text-white">
                                                  <div>{skuItem.quantity.toLocaleString('vi-VN')}</div>
                                                  {skuItem.returnedQuantity && skuItem.returnedQuantity > 0 ? (
                                                    <div className="text-[9px] text-gray-400 font-normal">
                                                      Gốc {skuItem.grossQuantity?.toLocaleString('vi-VN')} • Trả -{skuItem.returnedQuantity.toLocaleString('vi-VN')}
                                                    </div>
                                                  ) : null}
                                                </td>
                                                <td className="py-2 px-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                                                  {skuItem.avgPrice.toLocaleString('vi-VN')}đ
                                                </td>
                                                <td className="py-2 px-2.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                                                  <div>{skuItem.totalAmount.toLocaleString('vi-VN')}đ</div>
                                                  {skuItem.returnedAmount && skuItem.returnedAmount > 0 ? (
                                                    <div className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                                                      Đã trừ trả -{skuItem.returnedAmount.toLocaleString('vi-VN')}đ
                                                    </div>
                                                  ) : null}
                                                </td>
                                                <td className="py-2 px-2.5 text-right text-gray-500 font-mono text-[11px]">
                                                  {skuRatio}%
                                                </td>
                                              </tr>

                                              {/* Nested transactions for this SKU under this supplier */}
                                              {isSkuExpanded && (
                                                <tr className="bg-gray-50/50 dark:bg-[#121318]">
                                                  <td colSpan={8} className="p-2.5">
                                                    <div className="rounded border border-indigo-200/50 dark:border-indigo-900/30 bg-white dark:bg-[#15171e] p-2.5 space-y-2">
                                                      <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between">
                                                        <span>
                                                          Lịch sử giao dịch SKU {skuItem.sku} từ NCC {s.supplierName} ({skuTxList.length} giao dịch):
                                                        </span>
                                                        <span className="text-gray-400 font-normal">Tồn trước & biến động nhập/trả</span>
                                                      </div>
                                                      {skuTxList.length === 0 ? (
                                                        <div className="text-center py-2 text-xs text-gray-400">
                                                          Không có chi tiết lịch sử nhập/trả hàng cho mã SKU này
                                                        </div>
                                                      ) : (
                                                        <div className="overflow-x-auto">
                                                          <table className="w-full text-left text-[11px]">
                                                            <thead>
                                                              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 bg-gray-50/60 dark:bg-gray-800/20">
                                                                <th className="py-1 px-2">Mã phiếu</th>
                                                                <th className="py-1 px-2">Ngày GD</th>
                                                                <th className="py-1 px-2">Kho hàng</th>
                                                                <th className="py-1 px-2 text-center font-bold text-gray-700 dark:text-gray-300">Số hàng trước GD</th>
                                                                <th className="py-1 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">SL biến động (+/-)</th>
                                                                <th className="py-1 px-2 text-center font-bold text-indigo-600 dark:text-indigo-400">Tồn sau GD (=)</th>
                                                                <th className="py-1 px-2 text-right">Đơn giá</th>
                                                                <th className="py-1 px-2 text-right font-bold">Thành tiền</th>
                                                                <th className="py-1 px-2 text-center">Trạng thái nợ</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                                              {skuTxList.map((tx, tIdx) => {
                                                                const isReturn = tx.transactionType === 'RETURN' || tx.receivedQuantity < 0;

                                                                return (
                                                                  <tr key={`${tx.receiptId}-${tIdx}`} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${isReturn ? 'bg-amber-50/10 dark:bg-amber-950/5' : ''}`}>
                                                                    <td className="py-1.5 px-2 font-mono font-semibold">
                                                                      {isReturn ? (
                                                                        <Link to={`/suppliers?tab=RETURNS&search=${tx.receiptCode}`} className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold">
                                                                          <RotateCcw size={11} className="shrink-0" />
                                                                          <span>{tx.receiptCode}</span>
                                                                          <span className="px-1 py-0.1 rounded text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">Trả</span>
                                                                        </Link>
                                                                      ) : (
                                                                        <Link to={`/suppliers?tab=RECEIPTS&search=${tx.receiptCode}`} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                                                                          <Receipt size={11} />
                                                                          <span>{tx.receiptCode}</span>
                                                                        </Link>
                                                                      )}
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">{tx.receiptDate ? tx.receiptDate.slice(0, 10) : ''}</td>
                                                                    <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">{tx.warehouseName}</td>
                                                                    <td className="py-1.5 px-2 text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                                                                      <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                                                        {tx.stockBefore.toLocaleString('vi-VN')}
                                                                      </span>
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-center font-mono font-bold">
                                                                      {isReturn ? (
                                                                        <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60">
                                                                          {tx.receivedQuantity.toLocaleString('vi-VN')}
                                                                        </span>
                                                                      ) : (
                                                                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400">
                                                                          +{tx.receivedQuantity.toLocaleString('vi-VN')}
                                                                        </span>
                                                                      )}
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                      <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
                                                                        ={tx.stockAfter.toLocaleString('vi-VN')}
                                                                      </span>
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-right font-mono">{tx.unitPrice.toLocaleString('vi-VN')}đ</td>
                                                                    <td className={`py-1.5 px-2 text-right font-mono font-bold ${isReturn ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                                                      {tx.subtotal.toLocaleString('vi-VN')}đ
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-center">
                                                                      {isReturn ? (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                                                          {tx.paymentStatus === 'DEBT_OFFSET' || (tx.debtOffsetAmount && tx.debtOffsetAmount > 0) ? 'Đã trừ nợ' : 'Đã trả hàng'}
                                                                        </span>
                                                                      ) : (
                                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                                          tx.paymentStatus === 'PAID'
                                                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                                                            : tx.paymentStatus === 'PARTIALLY_PAID'
                                                                              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                                                              : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                                        }`}>
                                                                          {tx.paymentStatus === 'PAID' ? 'Đã trả' : tx.paymentStatus === 'PARTIALLY_PAID' ? 'Trả 1 phần' : 'Chưa trả'}
                                                                        </span>
                                                                      )}
                                                                    </td>
                                                                  </tr>
                                                                );
                                                              })}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      )}                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </React.Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </SystemTd>
                          </SystemTr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Desktop Pagination */}
            {data?.bySupplier && data.bySupplier.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.bySupplier.length / pageSize))}
                  totalItems={data.bySupplier.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-3 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : !data?.bySupplier || data.bySupplier.length === 0 ? (
              <SystemMobileEmpty message="Không có số liệu nhập hàng cho nhà cung cấp đã chọn" />
            ) : (
              paginatedSuppliers.map((s) => {
                const payRate =
                  s.netAmount > 0
                    ? Math.min(100, Math.round((s.paidAmount / s.netAmount) * 100))
                    : 100;
                const isExpanded = Boolean(expandedSupplierIds[s.supplierId]);
                const skuList = s.skus || [];

                return (
                  <div
                    key={s.supplierId}
                    className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2.5 shadow-none"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2">
                      <div>
                        <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Building2 size={14} className="text-orange-500 shrink-0" />
                          <span className="line-clamp-1">{s.supplierName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Mã NCC: {s.supplierCode}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          payRate >= 100
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : payRate > 0
                              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                        }`}
                      >
                        Đã trả {payRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-gray-400 block">Số phiếu / SKU:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {s.count} phiếu • {s.skusCount || skuList.length} SKU
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Số lượng nhập:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {s.quantity.toLocaleString('vi-VN')} cái
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Tiền Net thực nhận:</span>
                        <span className="font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                          {s.netAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Đã thanh toán:</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {s.paidAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {s.remainingAmount > 0 && (
                        <div className="col-span-2 pt-1 border-t border-dashed border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                          <span className="text-gray-400">Còn nợ NCC:</span>
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {s.remainingAmount.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Toggle button for SKU list */}
                    <button
                      type="button"
                      onClick={() => toggleExpandSupplier(s.supplierId)}
                      className="w-full mt-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 text-[11px] font-semibold text-[#5865f2] dark:text-indigo-400 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Boxes size={13} />
                      <span>{isExpanded ? 'Thu gọn danh sách SKU' : `Xem chi tiết ${skuList.length} mã SKU nhập`}</span>
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {/* Expanded SKU list on mobile (flat divider items matching orders list) */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 divide-y divide-dashed divide-gray-100 dark:divide-gray-800">
                        {skuList.length === 0 ? (
                          <div className="text-center py-2 text-[11px] text-gray-400">
                            Không có chi tiết mã SKU phát sinh cho nhà cung cấp này
                          </div>
                        ) : (
                          skuList.map((skuItem, sIdx) => {
                            const skuRatio = s.totalAmount > 0
                              ? ((skuItem.totalAmount / s.totalAmount) * 100).toFixed(1)
                              : '0.0';
                            const skuKey = `${s.supplierId}-${skuItem.sku}-${sIdx}`;
                            const isSkuExpanded = Boolean(expandedSupplierSkuKeys[skuKey]);
                            const skuTxList = skuItem.transactions || [];

                            return (
                              <div
                                key={skuKey}
                                className="py-2.5 first:pt-1 last:pb-0 text-xs space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Boxes size={12} className="text-[#5865f2] shrink-0" />
                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs truncate">
                                      {skuItem.sku}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-400 shrink-0">
                                    {skuRatio}% NCC
                                  </span>
                                </div>
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-xs line-clamp-2">
                                  {skuItem.productName}
                                </div>
                                {skuItem.variationName && (
                                  <div className="text-[10px] text-gray-400">Phân loại: {skuItem.variationName}</div>
                                )}
                                <div className="flex items-center justify-between text-xs pt-0.5 text-gray-600 dark:text-gray-400">
                                  <span>{skuItem.quantity.toLocaleString('vi-VN')} cái × {skuItem.avgPrice.toLocaleString('vi-VN')}đ</span>
                                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {skuItem.totalAmount.toLocaleString('vi-VN')}đ
                                  </span>
                                </div>

                                {skuTxList.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandSupplierSku(skuKey)}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold pt-0.5 cursor-pointer"
                                  >
                                    <Receipt size={11} />
                                    <span>{isSkuExpanded ? 'Thu gọn biến động' : `Xem biến động tồn ${skuTxList.length} giao dịch`}</span>
                                    {isSkuExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                  </button>
                                )}

                                {isSkuExpanded && skuTxList.length > 0 && (
                                  <div className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                                    {skuTxList.map((tx, tIdx) => (
                                      <div key={tIdx} className="p-2 rounded bg-gray-50/80 dark:bg-gray-800/40 text-[10px] space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{tx.receiptCode}</span>
                                          <span className="text-gray-400">{tx.receiptDate ? tx.receiptDate.slice(0, 10) : ''}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 bg-white dark:bg-[#14151a] p-1.5 rounded border border-gray-100 dark:border-gray-800 text-[10px] text-center font-mono">
                                          <div>
                                            <span className="text-[9px] text-gray-400 block font-sans">Tồn trước</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{tx.stockBefore}</span>
                                          </div>
                                          <div className="border-x border-gray-200 dark:border-gray-700/60">
                                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-sans">Nhập (+)</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">+{tx.receivedQuantity}</span>
                                          </div>
                                          <div>
                                            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 block font-sans">Tồn sau (=)</span>
                                            <span className="font-bold text-[#5865f2] dark:text-indigo-400">{tx.stockAfter}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {data?.bySupplier && data.bySupplier.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.bySupplier.length / pageSize))}
                  totalItems={data.bySupplier.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: TOP SẢN PHẨM & SKU */}
      {activeTab === 'PRODUCTS' && (
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:overflow-hidden bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-[40px] text-center"></SystemTh>
                  <SystemTh className="w-[130px]">Mã SKU</SystemTh>
                  <SystemTh className="w-[260px]">Tên sản phẩm</SystemTh>
                  <SystemTh className="w-[140px]">Phân loại hàng</SystemTh>
                  <SystemTh className="w-[180px]">Nhà cung cấp</SystemTh>
                  <SystemTh className="w-[100px] text-center">Số lần nhập</SystemTh>
                  <SystemTh className="w-[120px] text-center">Số lượng nhập</SystemTh>
                  <SystemTh className="w-[140px] text-right">Đơn giá bình quân</SystemTh>
                  <SystemTh className="w-[150px] text-right">Tổng thành tiền</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton rows={5} columns={9} />
                ) : !data?.topProducts || data.topProducts.length === 0 ? (
                  <SystemTableEmpty colSpan={9} message="Không có sản phẩm nào được nhập trong khoảng thời gian này" />
                ) : (
                  paginatedProducts.map((p, idx) => {
                    const isExpanded = Boolean(expandedProductSkus[p.sku]);
                    const txList = p.transactions || [];

                    return (
                      <React.Fragment key={`${p.sku}-${idx}`}>
                        <SystemTr
                          className="cursor-pointer hover:bg-gray-50/80 dark:hover:bg-[#1a1d26] transition-colors"
                          onClick={() => toggleExpandProduct(p.sku)}
                        >
                          <SystemTd className="text-center">
                            <button
                              type="button"
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandProduct(p.sku);
                              }}
                              title={isExpanded ? 'Thu gọn lịch sử nhập' : 'Xem chi tiết các lần giao dịch nhập'}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </SystemTd>
                          <SystemTd className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {p.sku}
                          </SystemTd>
                          <SystemTd className="font-medium text-gray-900 dark:text-white max-w-[260px] truncate">
                            {p.productName}
                          </SystemTd>
                          <SystemTd className="text-xs text-gray-500 dark:text-gray-400">
                            {p.variationName || 'Mặc định'}
                          </SystemTd>
                          <SystemTd className="text-xs text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                            {p.suppliers && p.suppliers.length > 0 ? (
                              p.suppliers.join(', ')
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </SystemTd>
                          <SystemTd className="text-center font-semibold text-gray-700 dark:text-gray-300">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">
                                {p.receiptsCount} lần
                              </span>
                              {p.returnsCount && p.returnsCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-medium border border-amber-200/60 dark:border-amber-800/40">
                                  {p.returnsCount} lần trả
                                </span>
                              ) : null}
                            </div>
                          </SystemTd>
                          <SystemTd className="text-center font-mono font-bold text-gray-900 dark:text-white">
                            <div>{p.quantity.toLocaleString('vi-VN')}</div>
                            {p.returnedQuantity && p.returnedQuantity > 0 ? (
                              <div className="text-[10px] text-gray-400 font-normal">
                                Gốc {p.grossQuantity?.toLocaleString('vi-VN')} • Trả -{p.returnedQuantity.toLocaleString('vi-VN')}
                              </div>
                            ) : null}
                          </SystemTd>
                          <SystemTd className="text-right font-mono text-gray-700 dark:text-gray-300">
                            {p.avgPrice.toLocaleString('vi-VN')}đ
                          </SystemTd>
                          <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                            <div>{p.totalAmount.toLocaleString('vi-VN')}đ</div>
                            {p.returnedAmount && p.returnedAmount > 0 ? (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                                Đã trừ trả -{p.returnedAmount.toLocaleString('vi-VN')}đ
                              </div>
                            ) : null}
                          </SystemTd>
                        </SystemTr>

                        {/* Nested Import & Return Transactions Breakdown Row */}
                        {isExpanded && (
                          <SystemTr className="bg-gray-50/70 dark:bg-[#101115]">
                            <SystemTd colSpan={9} className="p-3 sm:p-4">
                              <div className="bg-white dark:bg-[#161820] rounded border border-indigo-200/60 dark:border-indigo-900/40 p-3.5 shadow-xs space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Boxes size={16} className="text-[#5865f2]" />
                                    <div>
                                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                                        Chi tiết từng lần nhập hàng & trả hàng: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{p.sku}</span> - {p.productName}
                                      </span>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        Xem số hàng trước khi giao dịch, số lượng nhập/xuất trả và tồn sau giao dịch
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                    <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                      Số lần nhập: <b>{p.receiptsCount}</b> lần
                                    </span>
                                    {p.returnsCount && p.returnsCount > 0 ? (
                                      <span className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                        Số lần trả: <b>{p.returnsCount}</b> lần
                                      </span>
                                    ) : null}
                                    <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50">
                                      Tổng nhập: <b>{(p.grossQuantity ?? p.quantity).toLocaleString('vi-VN')}</b> cái
                                    </span>
                                    {p.returnedQuantity && p.returnedQuantity > 0 ? (
                                      <span className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 font-bold">
                                        Đã trả NCC: <b>-{p.returnedQuantity.toLocaleString('vi-VN')}</b> cái
                                      </span>
                                    ) : null}
                                    <span className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/50">
                                      Thực nhận ròng: <b>{p.quantity.toLocaleString('vi-VN')}</b> cái
                                    </span>
                                    <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2] dark:text-indigo-300 font-bold border border-indigo-200/50">
                                      Tổng tiền ròng: {p.totalAmount.toLocaleString('vi-VN')}đ
                                    </span>
                                  </div>
                                </div>

                                {txList.length === 0 ? (
                                  <div className="text-center py-4 text-xs text-gray-400">
                                    Không có chi tiết lịch sử nhập/trả hàng cho sản phẩm này
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-gray-200/60 dark:border-gray-800">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider bg-gray-50/80 dark:bg-gray-800/40">
                                          <th className="py-2.5 px-3">Mã phiếu</th>
                                          <th className="py-2.5 px-3">Ngày GD</th>
                                          <th className="py-2.5 px-3">Nhà cung cấp</th>
                                          <th className="py-2.5 px-3">Kho hàng</th>
                                          <th className="py-2.5 px-3 text-center bg-gray-100/60 dark:bg-gray-800/60 font-bold text-gray-700 dark:text-gray-300">
                                            Số hàng trước GD
                                          </th>
                                          <th className="py-2.5 px-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20 font-bold text-emerald-700 dark:text-emerald-300">
                                            SL biến động (+/-)
                                          </th>
                                          <th className="py-2.5 px-3 text-center bg-indigo-50/50 dark:bg-indigo-950/20 font-bold text-[#5865f2] dark:text-indigo-300">
                                            Tồn sau GD (=)
                                          </th>
                                          <th className="py-2.5 px-3 text-right">Đơn giá</th>
                                          <th className="py-2.5 px-3 text-right font-bold">Thành tiền</th>
                                          <th className="py-2.5 px-3 text-center">Trạng thái nợ</th>
                                          <th className="py-2.5 px-3">Ghi chú</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                                        {txList.map((tx, tIdx) => {
                                          const isReturn = tx.transactionType === 'RETURN' || tx.receivedQuantity < 0;

                                          return (
                                            <tr
                                              key={`${tx.receiptId}-${tIdx}`}
                                              className={
                                                isReturn
                                                  ? 'hover:bg-amber-50/20 dark:hover:bg-amber-950/20 bg-amber-50/10 dark:bg-amber-950/5 transition-colors'
                                                  : 'hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-colors'
                                              }
                                            >
                                              <td className="py-2.5 px-3 font-mono font-semibold">
                                                {isReturn ? (
                                                  <Link
                                                    to={`/suppliers?tab=RETURNS&search=${tx.receiptCode}`}
                                                    className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5"
                                                    title="Mở chi tiết phiếu xuất trả hàng NCC"
                                                  >
                                                    <RotateCcw size={13} className="shrink-0" />
                                                    <span>{tx.receiptCode}</span>
                                                    <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-sans">
                                                      Trả hàng
                                                    </span>
                                                  </Link>
                                                ) : (
                                                  <Link
                                                    to={`/suppliers?tab=RECEIPTS&search=${tx.receiptCode}`}
                                                    className="text-[#5865f2] hover:underline flex items-center gap-1.5"
                                                    title="Mở chi tiết phiếu nhập kho"
                                                  >
                                                    <Receipt size={13} className="shrink-0" />
                                                    <span>{tx.receiptCode}</span>
                                                  </Link>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {tx.receiptDate ? tx.receiptDate.slice(0, 10) : 'N/A'}
                                              </td>
                                              <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 max-w-[150px] truncate">
                                                {tx.supplierName}
                                              </td>
                                              <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 max-w-[130px] truncate">
                                                {tx.warehouseName}
                                              </td>
                                              <td className="py-2.5 px-3 text-center bg-gray-100/30 dark:bg-gray-800/30 font-mono">
                                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                                  {tx.stockBefore.toLocaleString('vi-VN')}
                                                </span>
                                              </td>
                                              <td className={`py-2.5 px-3 text-center font-mono font-bold ${
                                                isReturn
                                                  ? 'bg-amber-50/20 dark:bg-amber-950/10'
                                                  : 'bg-emerald-50/20 dark:bg-emerald-950/10'
                                              }`}>
                                                {isReturn ? (
                                                  <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                                                    {tx.receivedQuantity.toLocaleString('vi-VN')}
                                                  </span>
                                                ) : (
                                                  <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                    +{tx.receivedQuantity.toLocaleString('vi-VN')}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-center bg-indigo-50/20 dark:bg-indigo-950/10 font-mono font-bold">
                                                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                                                  ={tx.stockAfter.toLocaleString('vi-VN')}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                                {tx.unitPrice.toLocaleString('vi-VN')}đ
                                              </td>
                                              <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                                                isReturn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
                                              }`}>
                                                {tx.subtotal.toLocaleString('vi-VN')}đ
                                              </td>
                                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                {isReturn ? (
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                                    {tx.paymentStatus === 'DEBT_OFFSET' || (tx.debtOffsetAmount && tx.debtOffsetAmount > 0)
                                                      ? 'Đã trừ nợ'
                                                      : 'Đã trả hàng'}
                                                  </span>
                                                ) : (
                                                  <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                      tx.paymentStatus === 'PAID'
                                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                                        : tx.paymentStatus === 'PARTIALLY_PAID'
                                                          ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                                          : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                                    }`}
                                                  >
                                                    {tx.paymentStatus === 'PAID'
                                                      ? 'Đã trả'
                                                      : tx.paymentStatus === 'PARTIALLY_PAID'
                                                        ? 'Trả một phần'
                                                        : 'Chưa trả'}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-gray-500 text-[11px] max-w-[140px] truncate">
                                                {tx.note || tx.reason || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </SystemTd>
                          </SystemTr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Desktop Pagination */}
            {data?.topProducts && data.topProducts.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.topProducts.length / pageSize))}
                  totalItems={data.topProducts.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-3 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : !data?.topProducts || data.topProducts.length === 0 ? (
              <SystemMobileEmpty message="Không có sản phẩm nào được nhập trong khoảng thời gian này" />
            ) : (
              paginatedProducts.map((p, idx) => {
                const isExpanded = Boolean(expandedProductSkus[p.sku]);
                const txList = p.transactions || [];

                return (
                  <div
                    key={`${p.sku}-${idx}`}
                    className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2.5 text-xs shadow-none"
                  >
                    <div
                      className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2 cursor-pointer"
                      onClick={() => toggleExpandProduct(p.sku)}
                    >
                      <div>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {p.sku}
                        </span>
                        <div className="font-medium text-gray-900 dark:text-white text-xs line-clamp-2 mt-0.5">
                          {p.productName}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                        {p.receiptsCount} lần nhập{p.returnsCount && p.returnsCount > 0 ? ` • ${p.returnsCount} lần trả` : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>Phân loại: <b className="text-gray-700 dark:text-gray-300">{p.variationName || 'Mặc định'}</b></span>
                      {p.suppliers && p.suppliers.length > 0 && (
                        <span>NCC: <b className="text-gray-700 dark:text-gray-300">{p.suppliers.join(', ')}</b></span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800/80">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Số lượng:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {p.quantity.toLocaleString('vi-VN')}
                        </span>
                        {p.returnedQuantity && p.returnedQuantity > 0 ? (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 block font-normal">
                            Trả: -{p.returnedQuantity.toLocaleString('vi-VN')}
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Đơn giá BQ:</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300">
                          {p.avgPrice.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">Tổng tiền:</span>
                        <span className="font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                          {p.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Toggle button for transaction history */}
                    <button
                      type="button"
                      onClick={() => toggleExpandProduct(p.sku)}
                      className="w-full mt-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800 text-[11px] font-semibold text-[#5865f2] dark:text-indigo-400 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Receipt size={13} />
                      <span>{isExpanded ? 'Thu gọn lịch sử giao dịch' : `Xem chi tiết ${txList.length || p.receiptsCount} lần giao dịch (nhập/trả)`}</span>
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    {/* Expanded Transactions List on Mobile (flat divider layout, no nested card) */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 divide-y divide-dashed divide-gray-100 dark:divide-gray-800">
                        {txList.length === 0 ? (
                          <div className="text-center py-2 text-[11px] text-gray-400">
                            Không có chi tiết lịch sử nhập cho sản phẩm này
                          </div>
                        ) : (
                          txList.map((tx, tIdx) => (
                            <div
                              key={`${p.sku}-${tx.receiptId}-${tIdx}`}
                              className="py-2.5 first:pt-1 last:pb-0 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                {(() => {
                                  const isReturn = tx.transactionType === 'RETURN' || tx.receivedQuantity < 0;
                                  return isReturn ? (
                                    <Link
                                      to={`/suppliers?tab=RETURNS&search=${tx.receiptCode}`}
                                      className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1 hover:underline"
                                    >
                                      <RotateCcw size={12} className="shrink-0" />
                                      <span>{tx.receiptCode}</span>
                                      <span className="px-1 py-0.2 rounded text-[8px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-sans">Trả hàng</span>
                                    </Link>
                                  ) : (
                                    <Link
                                      to={`/suppliers?tab=RECEIPTS&search=${tx.receiptCode}`}
                                      className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1 hover:underline"
                                    >
                                      <Receipt size={12} className="shrink-0" />
                                      <span>{tx.receiptCode}</span>
                                    </Link>
                                  );
                                })()}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-400">
                                    {tx.receiptDate ? tx.receiptDate.slice(0, 10) : ''}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      tx.paymentStatus === 'PAID'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                        : tx.paymentStatus === 'PARTIALLY_PAID'
                                          ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                          : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300'
                                    }`}
                                  >
                                    {tx.paymentStatus === 'PAID' ? 'Đã trả' : tx.paymentStatus === 'PARTIALLY_PAID' ? 'Trả 1 phần' : 'Chưa trả'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500 dark:text-gray-400">
                                <span>NCC: <b className="text-gray-700 dark:text-gray-300">{tx.supplierName}</b></span>
                                <span>•</span>
                                <span>Kho: <b className="text-gray-700 dark:text-gray-300">{tx.warehouseName}</b></span>
                              </div>

                              {/* Stock progression: Tồn trước -> Nhập -> Tồn sau */}
                              <div className="grid grid-cols-3 gap-1 p-2 rounded bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-[11px]">
                                <div className="text-center">
                                  <span className="text-[10px] text-gray-400 block">Tồn trước nhập</span>
                                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                                    {tx.stockBefore.toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <div className="text-center border-x border-gray-200 dark:border-gray-700/60">
                                  {tx.transactionType === 'RETURN' || tx.receivedQuantity < 0 ? (
                                    <>
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-medium">SL trả (-)</span>
                                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                        {tx.receivedQuantity.toLocaleString('vi-VN')}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">SL nhập (+)</span>
                                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        +{tx.receivedQuantity.toLocaleString('vi-VN')}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="text-center">
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-medium">Tồn sau nhập (=)</span>
                                  <span className="font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                                    {tx.stockAfter.toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-0.5 text-gray-600 dark:text-gray-400">
                                <span>Đơn giá: <b className="font-mono text-gray-800 dark:text-gray-200">{tx.unitPrice.toLocaleString('vi-VN')}đ</b></span>
                                <span>Thành tiền: <b className="font-mono font-bold text-gray-900 dark:text-white">{tx.subtotal.toLocaleString('vi-VN')}đ</b></span>
                              </div>
                              {tx.note && (
                                <div className="text-[10px] text-gray-400 italic">Ghi chú: {tx.note}</div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {data?.topProducts && data.topProducts.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.topProducts.length / pageSize))}
                  totalItems={data.topProducts.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: THEO CỬA HÀNG */}
      {activeTab === 'SHOPS' && (
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:overflow-hidden bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-[200px]">Cửa hàng / Gian hàng</SystemTh>
                  <SystemTh className="w-[100px] text-center">Số phiếu</SystemTh>
                  <SystemTh className="w-[120px] text-center">Số lượng nhập</SystemTh>
                  <SystemTh className="w-[150px] text-right">Tổng tiền hàng gốc</SystemTh>
                  <SystemTh className="w-[130px] text-right">Đã trừ trả hàng</SystemTh>
                  <SystemTh className="w-[170px] text-right">Tiền nhập thực nhận (Net)</SystemTh>
                  <SystemTh className="w-[140px] text-right">Đã thanh toán</SystemTh>
                  <SystemTh className="w-[140px] text-right">Còn nợ NCC</SystemTh>
                  <SystemTh className="w-[100px] text-right">Tỷ trọng</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton rows={4} columns={9} />
                ) : !data?.byShop || data.byShop.length === 0 ? (
                  <SystemTableEmpty colSpan={9} message="Không có số liệu nhập hàng cho cửa hàng đã chọn" />
                ) : (
                  paginatedShops.map((s) => {
                    const percent =
                      summary.netItemsAmount > 0
                        ? ((s.netAmount / summary.netItemsAmount) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <SystemTr key={s.shopId}>
                        <SystemTd>
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Store size={14} className="text-[#5865f2]" />
                            <span>{s.shopName}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            Mã: {s.shopCode}
                          </div>
                        </SystemTd>
                        <SystemTd className="text-center font-semibold text-gray-800 dark:text-gray-200">
                          {s.count}
                        </SystemTd>
                        <SystemTd className="text-center font-mono font-medium text-gray-800 dark:text-gray-200">
                          {s.quantity.toLocaleString('vi-VN')}
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-gray-600 dark:text-gray-300">
                          {s.totalAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-orange-500">
                          {s.returnDeduction > 0 ? `-${s.returnDeduction.toLocaleString('vi-VN')}đ` : '0đ'}
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                          {s.netAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {s.paidAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-semibold text-orange-600 dark:text-orange-400">
                          {s.remainingAmount.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-medium text-xs text-gray-500 dark:text-gray-400">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {percent}%
                          </span>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Desktop Pagination */}
            {data?.byShop && data.byShop.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.byShop.length / pageSize))}
                  totalItems={data.byShop.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-3 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : !data?.byShop || data.byShop.length === 0 ? (
              <SystemMobileEmpty message="Không có số liệu nhập hàng cho cửa hàng đã chọn" />
            ) : (
              paginatedShops.map((s) => {
                const percent =
                  summary.netItemsAmount > 0
                    ? ((s.netAmount / summary.netItemsAmount) * 100).toFixed(1)
                    : '0.0';
                return (
                  <div
                    key={s.shopId}
                    className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2.5 text-xs shadow-none"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-2">
                      <div>
                        <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Store size={14} className="text-[#5865f2] shrink-0" />
                          <span>{s.shopName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">Mã: {s.shopCode}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-[#5865f2]">
                          {s.count} phiếu
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {percent}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-gray-400 block">Số lượng nhập:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {s.quantity.toLocaleString('vi-VN')} cái
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Tiền hàng gốc:</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">
                          {s.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {s.returnDeduction > 0 && (
                        <div className="col-span-2 text-[11px] text-orange-500 font-mono">
                          Trừ trả hàng: -{s.returnDeduction.toLocaleString('vi-VN')}đ
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] text-gray-400 block">Thực nhận (Net):</span>
                        <span className="font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                          {s.netAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Đã thanh toán:</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {s.paidAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {s.remainingAmount > 0 && (
                        <div className="col-span-2 pt-1 border-t border-dashed border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-gray-400">Còn nợ NCC:</span>
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {s.remainingAmount.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {data?.byShop && data.byShop.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.byShop.length / pageSize))}
                  totalItems={data.byShop.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: DANH SÁCH PHIẾU NHẬP GẦN ĐÂY */}
      {activeTab === 'RECEIPTS' && (
        <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:overflow-hidden bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-[130px]">
                    <div className="inline-flex items-center gap-1.5 leading-none">
                      <FileText size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Mã phiếu</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[110px]">
                    <div className="inline-flex items-center gap-1.5 leading-none">
                      <Calendar size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Ngày nhập</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[140px]">
                    <div className="inline-flex items-center gap-1.5 leading-none">
                      <Store size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Cửa hàng</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[170px]">
                    <div className="inline-flex items-center gap-1.5 leading-none">
                      <Building2 size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Nhà cung cấp</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[85px] text-center" align="center">
                    <div className="inline-flex items-center justify-center gap-1.5 leading-none">
                      <Package size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Số SKU</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[230px]">
                    <div className="inline-flex items-center gap-1.5 leading-none">
                      <Boxes size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Hàng thực nhận</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[160px] text-right" align="right">
                    <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                      <Receipt size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Tổng tiền hàng (Net)</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[130px] text-right" align="right">
                    <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Đã thanh toán</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[130px] text-right" align="right">
                    <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                      <AlertCircle size={13} className="text-rose-500 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Còn nợ NCC</span>
                    </div>
                  </SystemTh>
                  <SystemTh className="w-[130px] text-center" align="center">
                    <div className="inline-flex items-center justify-center gap-1.5 leading-none">
                      <Clock size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                      <span className="leading-none">Trạng thái nợ</span>
                    </div>
                  </SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton rows={5} columns={10} />
                ) : !data?.receipts || data.receipts.length === 0 ? (
                  <SystemTableEmpty colSpan={10} message="Không tìm thấy phiếu nhập nào phù hợp bộ lọc" />
                ) : (
                  paginatedReceipts.map((r: any) => {
                    const returnDed = Number(r.returnDeductionAmount || 0);
                    const netPayable = Math.max(0, Number(r.payableAmount || 0) - returnDed);
                    const netItems = Math.max(0, Number(r.totalItemsAmount || 0) - returnDed);
                    return (
                      <SystemTr key={r.id}>
                        <SystemTd className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {r.receiptCode}
                        </SystemTd>
                        <SystemTd className="text-xs text-gray-600 dark:text-gray-300">
                          {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
                        </SystemTd>
                        <SystemTd className="text-xs text-gray-700 dark:text-gray-300">
                          {r.shop?.name || <span className="text-gray-400">Kho chung</span>}
                        </SystemTd>
                        <SystemTd className="text-xs font-medium text-gray-900 dark:text-white">
                          {r.supplier?.name}
                        </SystemTd>
                        <SystemTd className="text-center font-semibold text-gray-700 dark:text-gray-300">
                          {r.items?.length || 0}
                        </SystemTd>
                        {/* Hàng thực nhận: Hiển thị 1 sản phẩm + +n badge, click xem chi tiết */}
                        <SystemTd
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReceiptForItems(r);
                            setIsReceiptItemsModalOpen(true);
                          }}
                          className="cursor-pointer group hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors"
                          title={
                            r.items && r.items.length > 0
                              ? `Bấm để xem danh sách ${r.items.length} sản phẩm nhập`
                              : 'Bấm để xem danh sách hàng nhập'
                          }
                        >
                          {r.items && r.items.length > 0 ? (
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-xs text-gray-900 dark:text-white truncate max-w-[155px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {r.items[0].productName}
                                  {r.items[0].variationName ? ` (${r.items[0].variationName})` : ''}
                                </span>
                                {r.items.length > 1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-colors">
                                    +{r.items.length - 1}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
                                <span className="font-mono text-gray-600 dark:text-gray-300 truncate max-w-[90px]">
                                  {r.items[0].sku || 'SKU'}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                  SL: {Number(r.items[0].receivedQuantity || 0).toLocaleString('vi-VN')}
                                </span>
                                {r.items.length > 1 && (
                                  <span className="text-[10px] text-gray-400">
                                    (Tổng {r.items.reduce((s: number, it: any) => s + Number(it.receivedQuantity || 0), 0).toLocaleString('vi-VN')})
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-right font-mono text-gray-800 dark:text-gray-200">
                              {netItems.toLocaleString('vi-VN')}đ
                              {returnDed > 0 && (
                                <div className="text-[10px] text-orange-500 font-normal">
                                  - Trả: {returnDed.toLocaleString('vi-VN')}đ
                                </div>
                              )}
                            </div>
                          )}
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                          {netPayable.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {Number(r.paidAmount || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-right font-mono font-semibold text-orange-600 dark:text-orange-400">
                          {Number(r.remainingAmount || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.paymentStatus === 'PAID'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : r.paymentStatus === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                  : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {r.paymentStatus === 'PAID'
                              ? 'Đã trả đủ'
                              : r.paymentStatus === 'PARTIALLY_PAID'
                                ? 'Trả 1 phần'
                                : 'Chưa thanh toán'}
                          </span>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Desktop Pagination */}
            {data?.receipts && data.receipts.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-800">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.receipts.length / pageSize))}
                  totalItems={data.receipts.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-3 space-y-2.5">
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : !data?.receipts || data.receipts.length === 0 ? (
              <SystemMobileEmpty message="Không tìm thấy phiếu nhập nào phù hợp bộ lọc" />
            ) : (
              paginatedReceipts.map((r: any) => {
                const returnDed = Number(r.returnDeductionAmount || 0);
                const netPayable = Math.max(0, Number(r.payableAmount || 0) - returnDed);
                return (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2 text-xs shadow-none"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800/80 pb-1.5">
                      <div>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {r.receiptCode}
                        </span>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : r.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {r.paymentStatus === 'PAID'
                          ? 'Đã trả đủ'
                          : r.paymentStatus === 'PARTIALLY_PAID'
                            ? 'Trả 1 phần'
                            : 'Chưa thanh toán'}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-between">
                      <span>NCC: <b>{r.supplier?.name}</b></span>
                      <span>{r.shop?.name || 'Kho chung'}</span>
                    </div>

                    {/* Product preview line with +n (Clickable to open receipt items modal) */}
                    {r.items && r.items.length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReceiptForItems(r);
                          setIsReceiptItemsModalOpen(true);
                        }}
                        className="p-2 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Boxes size={13} className="text-indigo-500 shrink-0" />
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                            {r.items[0].productName}
                            {r.items[0].variationName ? ` (${r.items[0].variationName})` : ''}
                          </span>
                          {r.items.length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                              +{r.items.length - 1}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-gray-500 shrink-0">
                          SL: {r.items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800/80">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Tiền Net:</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {netPayable.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Đã trả:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          {Number(r.paidAmount || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">Còn nợ:</span>
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                          {Number(r.remainingAmount || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {data?.receipts && data.receipts.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                <SystemPagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(data.receipts.length / pageSize))}
                  totalItems={data.receipts.length}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setPageSize(l);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal xem danh sách hàng thực nhận của phiếu nhập */}
      <Modal
        isOpen={isReceiptItemsModalOpen}
        onClose={() => {
          setIsReceiptItemsModalOpen(false);
          setSelectedReceiptForItems(null);
        }}
        title={`Danh sách hàng thực nhận: ${selectedReceiptForItems?.receiptCode || ''}`}
        icon={Boxes}
        size="2xl"
      >
        {selectedReceiptForItems && (() => {
          const items = selectedReceiptForItems.items || [];
          const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0);
          const totalDisputed = items.reduce((sum: number, it: any) => sum + Number(it.disputedQuantity || 0), 0);
          const totalAmount = Number(selectedReceiptForItems.totalItemsAmount || 0);
          const returnDed = Number(selectedReceiptForItems.returnDeductionAmount || 0);

          return (
            <>
              <ModalBody className="space-y-3.5 p-3 sm:p-5">
                {/* Header Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Nhà cung cấp:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate block mt-0.5" title={selectedReceiptForItems.supplier?.name}>
                      {selectedReceiptForItems.supplier?.name || 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {selectedReceiptForItems.supplier?.code}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Kho nhận & Ngày:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate block mt-0.5">
                      {selectedReceiptForItems.warehouse?.name || selectedReceiptForItems.shop?.name || 'Kho chính'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(selectedReceiptForItems.receiptDate).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-medium">Tổng thực nhận:</span>
                    <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300 font-mono block mt-0.5">
                      {totalQty.toLocaleString('vi-VN')} <span className="text-[11px] font-normal">sản phẩm</span>
                    </span>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
                      {items.length} mã SKU
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Tổng tiền hàng:</span>
                    <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 font-mono block mt-0.5">
                      {totalAmount.toLocaleString('vi-VN')}đ
                    </span>
                    {returnDed > 0 ? (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400">
                        Đã trừ trả: -{returnDed.toLocaleString('vi-VN')}đ
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {selectedReceiptForItems.paymentStatus === 'PAID' ? 'Đã thanh toán đủ' : 'Chưa trả hết'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Products Table */}
                <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-800/80 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Package size={13} className="text-[#5865f2] shrink-0" />
                      <span>Chi tiết các mặt hàng ({items.length})</span>
                    </div>
                    {totalDisputed > 0 && (
                      <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
                        Có {totalDisputed} hàng lỗi/thiếu
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50/80 dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                        <tr>
                          <th className="py-2 px-3 text-center w-10 text-gray-500 font-medium">#</th>
                          <th className="py-2 px-3 w-32 text-gray-500 font-medium">Mã SKU</th>
                          <th className="py-2 px-3 text-gray-500 font-medium">Sản phẩm & Phân loại</th>
                          <th className="py-2 px-3 text-center w-24 text-gray-500 font-medium">SL Nhận</th>
                          <th className="py-2 px-3 text-right w-28 text-gray-500 font-medium">Đơn giá</th>
                          <th className="py-2 px-3 text-right w-32 text-gray-500 font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                              Phiếu này không có dữ liệu sản phẩm chi tiết.
                            </td>
                          </tr>
                        ) : (
                          items.map((it: any, idx: number) => (
                            <tr key={it.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-gray-400 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-medium text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50 select-all">
                                  {it.sku || 'N/A'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {it.productName}
                                </div>
                                {it.variationName && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    Phân loại: <span className="text-gray-700 dark:text-gray-300 font-medium">{it.variationName}</span>
                                  </div>
                                )}
                                {it.note && (
                                  <div className="text-[10px] text-gray-400 italic mt-0.5">
                                    Ghi chú: {it.note}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono">
                                  {Number(it.receivedQuantity || 0).toLocaleString('vi-VN')}
                                </span>
                                {Number(it.disputedQuantity || 0) > 0 && (
                                  <div className="text-[10px] text-rose-500 mt-0.5">
                                    Lỗi: {it.disputedQuantity}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                {Number(it.unitPrice || 0).toLocaleString('vi-VN')}đ
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-900 dark:text-white">
                                {Number(it.subtotal || 0).toLocaleString('vi-VN')}đ
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot className="bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 font-semibold text-xs">
                          <tr>
                            <td colSpan={3} className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                              Tổng cộng:
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              {totalQty.toLocaleString('vi-VN')}
                            </td>
                            <td></td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              {totalAmount.toLocaleString('vi-VN')}đ
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex items-center justify-end gap-2 w-full">
                <ModalButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsReceiptItemsModalOpen(false);
                    setSelectedReceiptForItems(null);
                  }}
                  className="text-xs px-4"
                >
                  Đóng
                </ModalButton>
              </ModalFooter>
            </>
          );
        })()}
      </Modal>
    </div>
  );
};
