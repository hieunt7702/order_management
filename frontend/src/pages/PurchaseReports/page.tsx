import React, { useState, useEffect, useMemo } from 'react';
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
import { reportsApi, PurchaseReportData } from '../../services/reportsApi';
import { shopsApi } from '../../services/shopsApi';
import { suppliersApi } from '../../services/suppliersApi';
import { SystemDatePicker } from '../../components/ui/SystemDatePicker';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
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
  SystemTableSkeleton,
} from '../../components/ui/SystemTable';
import { toast } from '../../components/ui/Toast';

export const PurchaseReportsPage: React.FC = () => {
  const [data, setData] = useState<PurchaseReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'SHOPS' | 'SUPPLIERS' | 'PRODUCTS' | 'RECEIPTS'>('SHOPS');

  // Filters
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Dropdown options
  const [shops, setShops] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  // Load Shop & Supplier metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [shopsRes, supsRes]: [any, any] = await Promise.all([
          shopsApi.findAll(),
          suppliersApi.findAll({ status: 'ACTIVE' }),
        ]);

        const shopsData = shopsRes?.data || (Array.isArray(shopsRes) ? shopsRes : shopsRes?.items || []);
        const supsData = supsRes?.data || (Array.isArray(supsRes) ? supsRes : supsRes?.items || []);

        setShops(Array.isArray(shopsData) ? shopsData : []);
        setSuppliers(Array.isArray(supsData) ? supsData : []);
      } catch (err) {
        console.error('Lỗi nạp danh sách cửa hàng/NCC:', err);
      }
    };
    loadMetadata();
  }, []);

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

      // Sheet 2: Theo Cửa hàng
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

      // Sheet 3: Theo Nhà cung cấp
      if (data.bySupplier && data.bySupplier.length > 0) {
        const supSheetData = [
          ['Mã NCC', 'Tên Nhà Cung Cấp', 'Số Phiếu', 'Số Lượng', 'Tổng Tiền Gốc', 'Đã Trừ Trả', 'Tiền Net', 'Đã Trả', 'Còn Nợ'],
          ...data.bySupplier.map((s) => [
            s.supplierCode,
            s.supplierName,
            s.count,
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
      }

      // Sheet 4: Top sản phẩm
      if (data.topProducts && data.topProducts.length > 0) {
        const prodSheetData = [
          ['Mã SKU', 'Tên Sản Phẩm', 'Phân Loại', 'Số Lượng Nhập', 'Đơn Giá BQ', 'Tổng Tiền'],
          ...data.topProducts.map((p) => [
            p.sku,
            p.productName,
            p.variationName || '',
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

  const hasFilterActive = Boolean(
    selectedShopId !== 'ALL' ||
    selectedSupplierId !== 'ALL' ||
    startDate ||
    endDate ||
    searchTerm.trim()
  );

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#14151a] p-4 rounded border border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-[#5865f2]" />
              Báo Cáo Nhập Hàng
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#5865f2]/10 text-[#5865f2] rounded">
              Báo cáo & Phân tích
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tổng hợp dữ liệu nhập kho theo từng cửa hàng, nhà cung cấp, phân bổ chi phí & xu hướng nhập hàng
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportExcel}
            disabled={!data || data.summary.totalReceipts === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileSpreadsheet size={14} />
            <span>Xuất Excel</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      <SystemFilter className="flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* 1. Date Range Picker (Unified SystemDatePicker Component) */}
          <div className="w-full sm:w-[240px]">
            <SystemDatePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start || '');
                setEndDate(end || '');
              }}
              size="sm"
              className="w-full"
              placeholder="Chọn khoảng ngày nhập..."
            />
          </div>

          {/* 2. Shop Filter */}
          <div className="w-full sm:w-52">
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

          {/* 3. Supplier Filter */}
          <div className="w-full sm:w-56">
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

          {/* 4. Search Filter */}
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-64">
            <SystemFilterSearch
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã phiếu, SKU, NCC..."
              className="w-full"
            />
          </form>

          {/* Reset Filters Button */}
          {hasFilterActive && (
            <SystemFilterReset onClick={handleResetFilters} className="shrink-0" />
          )}
        </div>
      </SystemFilter>

      {/* Chart Section */}
      <div className="bg-white dark:bg-[#14151a] p-4 rounded border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <TrendingUp size={16} className="text-[#5865f2]" />
              Xu Hướng Giá Trị & Số Lượng Nhập Hàng Theo Ngày
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Đường biến thiên giá trị nhập thực nhận (VND) và số lượng sản phẩm nhập kho
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-gray-400 text-xs">
            <AlertCircle size={24} className="mb-2 opacity-50" />
            Không có dữ liệu nhập hàng trong khoảng thời gian đã chọn
          </div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865f2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5865f2" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#888' }}
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
                    fontSize: '12px',
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
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-full sm:w-fit shrink-0 max-w-full overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('SHOPS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'SHOPS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Store size={14} />
          <span>Theo Cửa Hàng (Shop) ({data?.byShop?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'SUPPLIERS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Building2 size={14} />
          <span>Theo Nhà Cung Cấp ({data?.bySupplier?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'PRODUCTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Boxes size={14} />
          <span>Sản Phẩm & SKU Nhập ({data?.topProducts?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('RECEIPTS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'RECEIPTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Receipt size={14} />
          <span>Phiếu Nhập Gần Đây ({data?.receipts?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: THEO CỬA HÀNG */}
      {activeTab === 'SHOPS' && (
        <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
          <SystemTableWrapper>
            <SystemThead>
              <SystemTr>
                <SystemTh>Cửa hàng / Gian hàng</SystemTh>
                <SystemTh className="text-center">Số phiếu</SystemTh>
                <SystemTh className="text-center">Số lượng nhập</SystemTh>
                <SystemTh className="text-right">Tổng tiền hàng gốc</SystemTh>
                <SystemTh className="text-right">Đã trừ trả hàng</SystemTh>
                <SystemTh className="text-right">Tiền nhập thực nhận (Net)</SystemTh>
                <SystemTh className="text-right">Đã thanh toán</SystemTh>
                <SystemTh className="text-right">Còn nợ NCC</SystemTh>
                <SystemTh className="text-right">Tỷ trọng</SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton rows={4} columns={9} />
              ) : !data?.byShop || data.byShop.length === 0 ? (
                <SystemTableEmpty message="Không có số liệu nhập hàng cho cửa hàng đã chọn" />
              ) : (
                data.byShop.map((s) => {
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
        </div>
      )}

      {/* Tab 2: THEO NHÀ CUNG CẤP */}
      {activeTab === 'SUPPLIERS' && (
        <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
          <SystemTableWrapper>
            <SystemThead>
              <SystemTr>
                <SystemTh>Nhà cung cấp</SystemTh>
                <SystemTh className="text-center">Số phiếu</SystemTh>
                <SystemTh className="text-center">Số lượng nhập</SystemTh>
                <SystemTh className="text-right">Tổng tiền hàng gốc</SystemTh>
                <SystemTh className="text-right">Đã trừ trả hàng</SystemTh>
                <SystemTh className="text-right">Tiền nhập thực nhận (Net)</SystemTh>
                <SystemTh className="text-right">Đã thanh toán</SystemTh>
                <SystemTh className="text-right">Còn nợ NCC</SystemTh>
                <SystemTh className="text-right">Tỷ lệ thanh toán</SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton rows={4} columns={9} />
              ) : !data?.bySupplier || data.bySupplier.length === 0 ? (
                <SystemTableEmpty message="Không có số liệu nhập hàng cho nhà cung cấp đã chọn" />
              ) : (
                data.bySupplier.map((s) => {
                  const payRate =
                    s.netAmount > 0
                      ? Math.min(100, Math.round((s.paidAmount / s.netAmount) * 100))
                      : 100;
                  return (
                    <SystemTr key={s.supplierId}>
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
                  );
                })
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>
      )}

      {/* Tab 3: TOP SẢN PHẨM & SKU */}
      {activeTab === 'PRODUCTS' && (
        <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
          <SystemTableWrapper>
            <SystemThead>
              <SystemTr>
                <SystemTh>Mã SKU</SystemTh>
                <SystemTh>Tên sản phẩm</SystemTh>
                <SystemTh>Phân loại hàng</SystemTh>
                <SystemTh className="text-center">Số lần nhập</SystemTh>
                <SystemTh className="text-center">Số lượng nhập</SystemTh>
                <SystemTh className="text-right">Đơn giá bình quân</SystemTh>
                <SystemTh className="text-right">Tổng thành tiền</SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton rows={5} columns={7} />
              ) : !data?.topProducts || data.topProducts.length === 0 ? (
                <SystemTableEmpty message="Không có sản phẩm nào được nhập trong khoảng thời gian này" />
              ) : (
                data.topProducts.map((p, idx) => (
                  <SystemTr key={`${p.sku}-${idx}`}>
                    <SystemTd className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {p.sku}
                    </SystemTd>
                    <SystemTd className="font-medium text-gray-900 dark:text-white max-w-[300px] truncate">
                      {p.productName}
                    </SystemTd>
                    <SystemTd className="text-xs text-gray-500 dark:text-gray-400">
                      {p.variationName || 'Mặc định'}
                    </SystemTd>
                    <SystemTd className="text-center font-semibold text-gray-700 dark:text-gray-300">
                      {p.receiptsCount}
                    </SystemTd>
                    <SystemTd className="text-center font-mono font-bold text-gray-900 dark:text-white">
                      {p.quantity.toLocaleString('vi-VN')}
                    </SystemTd>
                    <SystemTd className="text-right font-mono text-gray-700 dark:text-gray-300">
                      {p.avgPrice.toLocaleString('vi-VN')}đ
                    </SystemTd>
                    <SystemTd className="text-right font-mono font-bold text-gray-900 dark:text-white">
                      {p.totalAmount.toLocaleString('vi-VN')}đ
                    </SystemTd>
                  </SystemTr>
                ))
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>
      )}

      {/* Tab 4: DANH SÁCH PHIẾU NHẬP GẦN ĐÂY */}
      {activeTab === 'RECEIPTS' && (
        <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
          <SystemTableWrapper>
            <SystemThead>
              <SystemTr>
                <SystemTh>Mã phiếu</SystemTh>
                <SystemTh>Ngày nhập</SystemTh>
                <SystemTh>Cửa hàng</SystemTh>
                <SystemTh>Nhà cung cấp</SystemTh>
                <SystemTh className="text-center">Số SKU</SystemTh>
                <SystemTh className="text-right">Hàng thực nhận</SystemTh>
                <SystemTh className="text-right">Tổng tiền hàng (Net)</SystemTh>
                <SystemTh className="text-right">Đã thanh toán</SystemTh>
                <SystemTh className="text-right">Còn nợ NCC</SystemTh>
                <SystemTh className="text-center">Trạng thái nợ</SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton rows={5} columns={10} />
              ) : !data?.receipts || data.receipts.length === 0 ? (
                <SystemTableEmpty message="Không tìm thấy phiếu nhập nào phù hợp bộ lọc" />
              ) : (
                data.receipts.map((r: any) => {
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
                      <SystemTd className="text-right font-mono text-gray-800 dark:text-gray-200">
                        {netItems.toLocaleString('vi-VN')}đ
                        {returnDed > 0 && (
                          <div className="text-[10px] text-orange-500 font-normal">
                            - Trả: {returnDed.toLocaleString('vi-VN')}đ
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
        </div>
      )}
    </div>
  );
};
