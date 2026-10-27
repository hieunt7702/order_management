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
  CircleDollarSign,
  Save,
  Eye,
  Sparkles,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
  reportsApi,
  OrderReconciliationItem,
  OrderReconciliationSummary,
  OrderReconciliationTransactionsData,
  ShopOrdersReportData,
  ShopOrderItem,
} from '../../services/reportsApi';
import { ordersApi } from '../../services/ordersApi';
import { OrderDetailDrawer } from '../Orders/OrderDetailDrawer';
import { formatCurrency } from '../../utils';
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
  const { shops, warehouses, selectedShopId, setSelectedShopId } = useWorkspaceStore();

  const currentShop = shops.find((s) => s.id === selectedShopId);
  const isFilteringSpecificShop = Boolean(selectedShopId && selectedShopId !== 'ALL');

  // Filters state (Shop filter is controlled from Top Header)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Data & loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<OrderReconciliationSummary>({
    totalVariants: 0,
    totalImportedQuantity: 0,
    totalExportedQuantity: 0,
    totalExportedAmount: 0,
    totalOrdersCount: 0,
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

  // Active View Switcher: 'SHOP_ORDERS' | 'SKU_RECONCILIATION'
  const [activeReportView, setActiveReportView] = useState<'SHOP_ORDERS' | 'SKU_RECONCILIATION'>('SHOP_ORDERS');

  // Shop Orders Report State
  const [shopOrdersData, setShopOrdersData] = useState<ShopOrdersReportData | null>(null);
  const [isLoadingShopOrders, setIsLoadingShopOrders] = useState<boolean>(true);
  const [shopOrdersPage, setShopOrdersPage] = useState<number>(1);
  const [shopOrdersLimit, setShopOrdersLimit] = useState<number>(50);
  const [shopVirtualFilter, setShopVirtualFilter] = useState<'ALL' | 'VIRTUAL_ONLY' | 'REAL_ONLY'>('ALL');
  const [shopOrderSearch, setShopOrderSearch] = useState<string>('');

  // Inline Edits for Financials: { [orderId]: { customRevenue: string; codAmount: string; isDirty: boolean } }
  const [pendingEdits, setPendingEdits] = useState<Record<string, { customRevenue: string; codAmount: string; isDirty: boolean }>>({});
  const [isSavingBatch, setIsSavingBatch] = useState<boolean>(false);

  // Drawer for order detail
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Load report data (SKU level)
  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getOrderReconciliationReport({
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
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

  // Load shop orders report (Shop level with all 38 orders, virtual orders, COD, custom revenue)
  const loadShopOrdersData = useCallback(async () => {
    setIsLoadingShopOrders(true);
    try {
      const res = await reportsApi.getShopOrdersReport({
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: shopOrderSearch.trim() || undefined,
        page: shopOrdersPage,
        limit: shopOrdersLimit,
      });
      if (res) {
        setShopOrdersData(res);
        // Initialize pending edits
        const initialEdits: Record<string, { customRevenue: string; codAmount: string; isDirty: boolean }> = {};
        (res.orders || []).forEach((o) => {
          initialEdits[o.id] = {
            customRevenue: o.customRevenue !== null && o.customRevenue !== undefined ? String(o.customRevenue) : String(o.totalAmount || 0),
            codAmount: String(o.codAmount || 0),
            isDirty: false,
          };
        });
        setPendingEdits(initialEdits);
      }
    } catch (err: any) {
      console.error('Error loading shop orders report:', err);
      toast.error('Lỗi tải báo cáo đơn hàng shop', err?.message || 'Không thể kết nối máy chủ');
    } finally {
      setIsLoadingShopOrders(false);
    }
  }, [selectedShopId, startDate, endDate, shopOrderSearch, shopOrdersPage, shopOrdersLimit]);

  useEffect(() => {
    if (activeReportView === 'SKU_RECONCILIATION') {
      loadReportData();
    }
  }, [activeReportView, loadReportData]);

  useEffect(() => {
    if (activeReportView === 'SHOP_ORDERS') {
      loadShopOrdersData();
    }
  }, [activeReportView, loadShopOrdersData]);

  // Filter shop orders client side by virtual / real
  const filteredShopOrders = useMemo(() => {
    if (!shopOrdersData?.orders) return [];
    let list = shopOrdersData.orders;
    if (shopVirtualFilter === 'VIRTUAL_ONLY') {
      list = list.filter((o) => o.isVirtual);
    } else if (shopVirtualFilter === 'REAL_ONLY') {
      list = list.filter((o) => !o.isVirtual);
    }
    return list;
  }, [shopOrdersData?.orders, shopVirtualFilter]);

  // Count dirty edits
  const dirtyCount = useMemo(() => {
    return Object.values(pendingEdits).filter((e) => e.isDirty).length;
  }, [pendingEdits]);

  // Batch save financial changes
  const handleSaveBatchFinancials = async () => {
    const dirtyEntries = Object.entries(pendingEdits).filter(([_, val]) => val.isDirty);
    if (dirtyEntries.length === 0) {
      toast.info('Không có thay đổi nào cần lưu');
      return;
    }

    setIsSavingBatch(true);
    try {
      const payload = dirtyEntries.map(([orderId, val]) => {
        const rev = parseFloat(String(val.customRevenue).replace(/,/g, ''));
        const cod = parseFloat(String(val.codAmount).replace(/,/g, ''));
        return {
          id: orderId,
          customRevenue: isNaN(rev) ? null : rev,
          codAmount: isNaN(cod) ? 0 : cod,
        };
      });

      await ordersApi.batchUpdateFinancials({ orders: payload });
      toast.success('Lưu thành công', `Đã cập nhật doanh thu & COD cho ${payload.length} đơn hàng`);
      await loadShopOrdersData();
    } catch (err: any) {
      console.error('Error saving batch financials:', err);
      toast.error('Lỗi cập nhật doanh thu', err?.message || 'Không thể lưu thay đổi');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Single save financial change
  const handleSaveSingleOrderFinancials = async (orderId: string) => {
    const edit = pendingEdits[orderId];
    if (!edit) return;

    try {
      const rev = parseFloat(String(edit.customRevenue).replace(/,/g, ''));
      const cod = parseFloat(String(edit.codAmount).replace(/,/g, ''));
      await ordersApi.updateFinancials(orderId, {
        customRevenue: isNaN(rev) ? null : rev,
        codAmount: isNaN(cod) ? 0 : cod,
      });
      toast.success('Lưu thành công', 'Đã lưu doanh thu và COD đơn hàng');
      setPendingEdits((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], isDirty: false },
      }));
      await loadShopOrdersData();
    } catch (err: any) {
      toast.error('Lỗi lưu', err?.message);
    }
  };

  // Open full OrderDetailDrawer
  const handleOpenOrderDetail = async (orderId: string) => {
    try {
      const fullOrder = await ordersApi.findOne(orderId);
      setSelectedOrderForDrawer(fullOrder);
      setIsDrawerOpen(true);
    } catch (err: any) {
      toast.error('Lỗi tải chi tiết đơn hàng', err?.message);
    }
  };

  // Export shop orders to Excel
  const handleExportShopOrdersExcel = async () => {
    try {
      toast.info('Đang chuẩn bị file Excel báo cáo đơn hàng shop...');
      const fullRes = await reportsApi.getShopOrdersReport({
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: shopOrderSearch.trim() || undefined,
        page: 1,
        limit: 1000,
      });

      const orderList = fullRes?.orders || shopOrdersData?.orders || [];
      if (!orderList.length) {
        toast.warning('Không có dữ liệu đơn hàng để xuất');
        return;
      }

      const rows = orderList.map((o, idx) => {
        const edit = pendingEdits[o.id];
        const effectiveRev = edit && edit.isDirty ? parseFloat(edit.customRevenue) || o.effectiveRevenue : o.effectiveRevenue;
        const cod = edit && edit.isDirty ? parseFloat(edit.codAmount) || o.codAmount : o.codAmount;
        const profit = o.isVirtual ? effectiveRev - cod : effectiveRev - o.cogsTotal;

        return {
          'STT': idx + 1,
          'Mã đơn hàng Shopee': o.externalOrderId,
          'Mã đơn nội bộ': o.internalOrderCode,
          'Cửa hàng (Shop)': o.shopName,
          'Ngày đặt hàng': o.orderDate ? new Date(o.orderDate).toLocaleString('vi-VN') : '',
          'Người nhận': o.recipientName || '',
          'SĐT người nhận': o.recipientPhone || '',
          'Mã vận đơn': o.trackingCode || '',
          'Loại đơn hàng': o.isVirtual ? 'Đơn ảo (Buff)' : 'Đơn thường',
          'Trừ kho vật lý?': o.isRealGoods ? 'Có xuất hàng thật' : 'Không trừ kho',
          'Trạng thái sàn': o.platformStatus,
          'Trạng thái kho': o.verificationStatus === 'VERIFIED' ? 'Đã xuất kho' : 'Chưa quét kho',
          'Tiền bán sản phẩm (VNĐ)': o.productsSellingTotal,
          'Tiền COD shipper (VNĐ)': cod,
          'Tiền sàn quyết toán (VNĐ)': o.settledPayout || 0,
          'Tiền người mua trả (VNĐ)': o.buyerPaidAmount || 0,
          'Doanh thu đơn hàng (VNĐ)': effectiveRev,
          'Doanh thu nhập tay?': o.customRevenue !== null ? 'Có (Nhập tay)' : 'Tự động từ sàn',
          'Lợi nhuận đối chiếu (VNĐ)': profit,
          'Công thức tính': o.isVirtual ? 'Lợi nhuận = Doanh thu - Tiền COD trả shipper' : 'Lợi nhuận = Doanh thu - Giá vốn hàng xuất',
          'Chi tiết mặt hàng': o.items.map((it) => `${it.productName} (SKU: ${it.sku}, SL: ${it.rawQuantity}, Đơn giá: ${it.unitPrice.toLocaleString('vi-VN')}đ)`).join('; '),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BaoCaoDonHangShop');

      const shopTag = isFilteringSpecificShop ? `_${currentShop?.code || 'Shop'}` : '_TatCaShop';
      const fileName = `Bao_Cao_Don_Hang_Shop${shopTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Xuất file Excel thành công!');
    } catch (err: any) {
      console.error('Error exporting shop orders Excel:', err);
      toast.error('Lỗi xuất file Excel', err?.message);
    }
  };

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
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
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
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
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
        [`Tiền hàng đi ${isFilteringSpecificShop ? `(${currentShop?.name || 'Shop'})` : '(Tổng)'} (VNĐ)`]: item.exportedAmount || 0,
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

      const shopTag = isFilteringSpecificShop ? `_${currentShop?.code || 'Shop'}` : '';
      const fileName = `Bao_Cao_Don_Hang${shopTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Xuất file Excel thành công!');
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      toast.error('Lỗi xuất file Excel', err?.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:h-full md:overflow-hidden space-y-2.5 sm:space-y-3 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
              <TrendingUp size={20} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
              <span className="sm:hidden truncate">Báo cáo đối soát đơn</span>
              <span className="hidden sm:inline truncate">Báo cáo đơn hàng & Đối soát Nhập - Xuất - Tồn</span>
            </h1>
            {isFilteringSpecificShop ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0 whitespace-nowrap">
                <Store size={12} />
                <span>Shop: {currentShop?.name || selectedShopId}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 rounded-full text-[11px] sm:text-xs font-normal bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 shrink-0 whitespace-nowrap">
                <Store size={12} />
                <span className="sm:hidden">Tất cả Shop</span>
                <span className="hidden sm:inline">Tất cả Shop (Đổi ở Header)</span>
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            So khớp số lượng đơn hàng đi và tổng doanh số xuất bán theo từng shop từ Header, kiểm tra số liệu hệ thống
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={activeReportView === 'SHOP_ORDERS' ? handleExportShopOrdersExcel : handleExportExcel}
            className="flex items-center gap-1.5 h-8 text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Xuất Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={activeReportView === 'SHOP_ORDERS' ? loadShopOrdersData : loadReportData}
            disabled={activeReportView === 'SHOP_ORDERS' ? isLoadingShopOrders : isLoading}
            className="flex items-center gap-1.5 h-8 text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            <RotateCcw size={13} className={(activeReportView === 'SHOP_ORDERS' ? isLoadingShopOrders : isLoading) ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-[#14151a] rounded-lg border border-gray-200/80 dark:border-gray-800 w-fit shrink-0">
        <button
          type="button"
          onClick={() => setActiveReportView('SHOP_ORDERS')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeReportView === 'SHOP_ORDERS'
              ? 'bg-white dark:bg-[#1f2230] text-[#5865f2] dark:text-indigo-400 shadow-xs border border-gray-200/70 dark:border-gray-700/80'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Store size={14} className={activeReportView === 'SHOP_ORDERS' ? 'text-[#5865f2]' : 'text-gray-400'} />
          <span>Báo cáo đơn hàng theo Cửa hàng</span>
          {shopOrdersData?.summary.totalOrders !== undefined && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-300">
              {shopOrdersData.summary.totalOrders} đơn
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveReportView('SKU_RECONCILIATION')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            activeReportView === 'SKU_RECONCILIATION'
              ? 'bg-white dark:bg-[#1f2230] text-[#5865f2] dark:text-indigo-400 shadow-xs border border-gray-200/70 dark:border-gray-700/80'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Boxes size={14} className={activeReportView === 'SKU_RECONCILIATION' ? 'text-[#5865f2]' : 'text-gray-400'} />
          <span>Đối soát Sản phẩm & Tồn kho (Nhập - Xuất - Tồn)</span>
          {summary.totalVariants !== undefined && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {summary.totalVariants} SKU
            </span>
          )}
        </button>
      </div>

      {/* ------------------- VIEW 1: SHOP ORDERS REPORT ------------------- */}
      {activeReportView === 'SHOP_ORDERS' && (
        <>
          {/* 4 Summary KPI Metric Cards for Shop Orders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
            <SystemMetricPairCard
              leftItem={{
                title: isFilteringSpecificShop ? `Tổng đơn hàng: ${currentShop?.name}` : 'Tổng đơn hàng (Tất cả shop)',
                value: `${(shopOrdersData?.summary.totalOrders || 0).toLocaleString('vi-VN')} đơn`,
                subtitle: `Thật: ${shopOrdersData?.summary.realOrdersCount || 0} • Ảo (Buff): ${shopOrdersData?.summary.virtualOrdersCount || 0}`,
                icon: ShoppingBag,
                colorScheme: 'indigo',
              }}
              rightItem={{
                title: 'Tiền bán sản phẩm',
                value: `${(shopOrdersData?.summary.totalProductsSelling || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `Đơn giá × SL mua (chuẩn sàn)`,
                icon: CircleDollarSign,
                colorScheme: 'green',
              }}
            />

            <SystemMetricPairCard
              leftItem={{
                title: 'Tiền COD trả shipper',
                value: `${(shopOrdersData?.summary.virtualCodAmount || shopOrdersData?.summary.totalCod || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `Phải trả shipper đơn ảo/COD`,
                icon: Truck,
                colorScheme: 'orange',
              }}
              rightItem={{
                title: 'Lợi nhuận ròng đơn ảo',
                value: `${(shopOrdersData?.summary.virtualProfit || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `= Doanh thu ảo - Tiền COD shipper`,
                icon: CheckCircle2,
                colorScheme: 'purple',
              }}
            />

            <SystemMetricPairCard
              leftItem={{
                title: 'Doanh thu đơn hàng',
                value: `${(shopOrdersData?.summary.totalRevenue || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `Gồm cả doanh thu nhập tay đối chiếu`,
                icon: TrendingUp,
                colorScheme: 'green',
              }}
              rightItem={{
                title: 'Tổng lợi nhuận đối chiếu',
                value: `${(shopOrdersData?.summary.totalProfit || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `Đơn thật (Lãi - Vốn) + Đơn ảo (Lãi - COD)`,
                icon: CircleDollarSign,
                colorScheme: 'green',
              }}
            />

            <SystemMetricPairCard
              leftItem={{
                title: 'Đơn ảo (Buff đơn)',
                value: `${(shopOrdersData?.summary.virtualOrdersCount || 0).toLocaleString('vi-VN')} đơn`,
                subtitle: `Doanh thu: ${(shopOrdersData?.summary.virtualRevenue || 0).toLocaleString('vi-VN')} đ`,
                icon: Sparkles,
                colorScheme: 'purple',
              }}
              rightItem={{
                title: 'Đơn hàng thật',
                value: `${(shopOrdersData?.summary.realOrdersCount || 0).toLocaleString('vi-VN')} đơn`,
                subtitle: `Doanh thu: ${(shopOrdersData?.summary.realRevenue || 0).toLocaleString('vi-VN')} đ`,
                icon: PackageCheck,
                colorScheme: 'indigo',
              }}
            />
          </div>

          {/* Shop Orders Quick Filter Bar */}
          {summary.shopsSummary && summary.shopsSummary.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 bg-gray-50/70 dark:bg-[#14151a] rounded-lg border border-gray-200/80 dark:border-gray-800 shrink-0">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1 mr-1">
                <Store size={13} className="text-[#5865f2]" />
                <span>Xem đơn theo shop:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedShopId('ALL');
                  setShopOrdersPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all cursor-pointer border shrink-0 ${
                  selectedShopId === 'ALL'
                    ? 'bg-[#5865f2] text-white border-[#5865f2] font-semibold shadow-xs'
                    : 'bg-white dark:bg-[#1a1b23] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#202430]'
                }`}
              >
                <Store size={12} />
                <span>Tất cả Shop</span>
                <span className={`font-mono text-[11px] font-bold ${selectedShopId === 'ALL' ? 'text-indigo-100' : 'text-[#5865f2]'}`}>
                  {summary.shopsSummary.reduce((sum, s) => sum + s.ordersCount, 0)} đơn
                </span>
              </button>

              {summary.shopsSummary.map((s) => {
                const isSelected = selectedShopId === s.shopId;
                return (
                  <button
                    key={s.shopId}
                    type="button"
                    onClick={() => {
                      setSelectedShopId(s.shopId);
                      setShopOrdersPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                        : 'bg-white dark:bg-[#1a1b23] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#202430]'
                    }`}
                  >
                    <Store size={12} className={isSelected ? 'text-white' : 'text-gray-400'} />
                    <span>{s.shopName}:</span>
                    <span className={`font-mono font-bold ${isSelected ? 'text-emerald-100' : 'text-gray-800 dark:text-gray-200'}`}>
                      {s.ordersCount} đơn
                    </span>
                    {s.virtualOrdersCount > 0 && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${isSelected ? 'bg-purple-900/60 text-purple-200' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'}`}>
                        {s.virtualOrdersCount} ảo
                      </span>
                    )}
                    {s.virtualProfit !== undefined && s.virtualProfit !== 0 && (
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-200' : 'text-purple-600 dark:text-purple-400'}`}>
                        (Lãi ảo: {s.virtualProfit.toLocaleString('vi-VN')}đ)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Shop Orders Filter Toolbar */}
          <SystemFilter className="p-2 sm:p-2.5 flex-col gap-2 shrink-0">
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

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
              <div className="col-span-2 sm:w-[220px]">
                <SystemDatePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setStartDate(start || '');
                    setEndDate(end || '');
                    setDatePreset(start || end ? 'CUSTOM' : 'ALL');
                    setShopOrdersPage(1);
                  }}
                  size="sm"
                  className="w-full"
                  placeholder="Khoảng ngày đối soát..."
                />
              </div>

              <div className="col-span-1 sm:w-48">
                <Select
                  value={selectedShopId || 'ALL'}
                  onChange={(val) => {
                    setSelectedShopId(String(val));
                    setShopOrdersPage(1);
                  }}
                  options={[
                    { value: 'ALL', label: 'Tất cả Shop', icon: Store },
                    ...shops.map((s) => ({
                      value: s.id,
                      label: s.name,
                      icon: Store,
                    })),
                  ]}
                  placeholder="Chọn shop..."
                  icon={Store}
                  size="sm"
                  className="w-full font-medium"
                  menuWidth="w-56"
                />
              </div>

              <div className="col-span-1 sm:w-44">
                <Select
                  value={shopVirtualFilter}
                  onChange={(val) => {
                    setShopVirtualFilter(val as any);
                  }}
                  options={[
                    { value: 'ALL', label: 'Tất cả loại đơn' },
                    { value: 'VIRTUAL_ONLY', label: 'Chỉ đơn ảo (Buff)' },
                    { value: 'REAL_ONLY', label: 'Chỉ đơn thật' },
                  ]}
                  size="sm"
                  className="w-full font-medium"
                  menuWidth="w-48"
                />
              </div>

              <div className="col-span-2 sm:flex-1 sm:min-w-[180px]">
                <SystemFilterSearch
                  value={shopOrderSearch}
                  onChange={(e) => {
                    setShopOrderSearch(e.target.value);
                    setShopOrdersPage(1);
                  }}
                  placeholder="Tìm theo mã đơn Shopee, MVD, khách hàng..."
                  className="w-full"
                />
              </div>

              {(selectedShopId !== 'ALL' ||
                shopVirtualFilter !== 'ALL' ||
                datePreset !== 'ALL' ||
                startDate ||
                endDate ||
                shopOrderSearch) && (
                <div className="col-span-2 sm:col-span-1 sm:ml-auto">
                  <SystemFilterReset
                    onClick={() => {
                      setSelectedShopId('ALL');
                      setShopVirtualFilter('ALL');
                      setDatePreset('ALL');
                      setStartDate('');
                      setEndDate('');
                      setShopOrderSearch('');
                      setShopOrdersPage(1);
                    }}
                    label="Xóa lọc"
                  />
                </div>
              )}
            </div>
          </SystemFilter>

          {/* Floating Batch Save Banner */}
          {dirtyCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-gray-900/95 text-white shadow-xl backdrop-blur-md border border-indigo-500/40 animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-indigo-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    Đang có {dirtyCount} đơn hàng được sửa doanh thu / COD đối chiếu
                  </p>
                  <p className="text-[11px] text-indigo-200">
                    Nhấn Lưu toàn bộ để cập nhật vào hệ thống và đối chiếu tức thì
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadShopOrdersData()}
                  className="h-8 text-xs text-gray-300 hover:text-white hover:bg-white/10"
                >
                  Hủy thay đổi
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={isSavingBatch}
                  onClick={handleSaveBatchFinancials}
                  className="h-8 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-md"
                >
                  <Save size={14} className={isSavingBatch ? 'animate-spin' : ''} />
                  <span>{isSavingBatch ? 'Đang lưu...' : `Lưu toàn bộ (${dirtyCount})`}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Desktop Table View for Shop Orders */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper
              tableClassName="w-full text-left border-collapse table-fixed min-w-[1300px]"
              pagination={
                <SystemPagination
                  currentPage={shopOrdersPage}
                  totalPages={shopOrdersData?.pagination?.totalPages || 1}
                  totalItems={shopOrdersData?.pagination?.totalItems || 0}
                  itemsPerPage={shopOrdersLimit}
                  onPageChange={(p) => setShopOrdersPage(p)}
                  onLimitChange={(l) => {
                    setShopOrdersLimit(l);
                    setShopOrdersPage(1);
                  }}
                />
              }
            >
              <colgroup>
                <col style={{ width: '42px' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '70px' }} />
              </colgroup>
              <SystemThead>
                <SystemTr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-[#1a1b23]/50">
                  <SystemTh align="center" className="text-center">STT</SystemTh>
                  <SystemTh align="left">Mã đơn / Cửa hàng</SystemTh>
                  <SystemTh align="left">Khách hàng / Vận đơn</SystemTh>
                  <SystemTh align="center" className="text-center">Loại đơn & Trạng thái</SystemTh>
                  <SystemTh align="right" className="text-right">Tiền bán SP (Sàn)</SystemTh>
                  <SystemTh align="right" className="text-right">Tiền COD shipper</SystemTh>
                  <SystemTh align="right" className="text-right">Quyết toán sàn</SystemTh>
                  <SystemTh align="right" className="text-right">Doanh thu đối chiếu</SystemTh>
                  <SystemTh align="right" className="text-right">Lợi nhuận đối chiếu</SystemTh>
                  <SystemTh align="center" className="text-center">Thao tác</SystemTh>
                </SystemTr>
              </SystemThead>

              <SystemTbody>
                {isLoadingShopOrders ? (
                  <SystemTableSkeleton rows={8} cols={10} />
                ) : filteredShopOrders.length === 0 ? (
                  <SystemTableEmpty
                    colSpan={10}
                    title="Không có đơn hàng nào khớp bộ lọc"
                    description="Hãy thử đổi shop, khoảng ngày hoặc xóa từ khóa tìm kiếm."
                  />
                ) : (
                  filteredShopOrders.map((order, idx) => {
                    const edit = pendingEdits[order.id] || {
                      customRevenue: order.customRevenue !== null ? String(order.customRevenue) : String(order.totalAmount || 0),
                      codAmount: String(order.codAmount || 0),
                      isDirty: false,
                    };
                    const isDirty = edit.isDirty;
                    const parsedRev = parseFloat(String(edit.customRevenue).replace(/,/g, ''));
                    const parsedCod = parseFloat(String(edit.codAmount).replace(/,/g, ''));
                    const effectiveRev = !isNaN(parsedRev) ? parsedRev : order.effectiveRevenue;
                    const cod = !isNaN(parsedCod) ? parsedCod : order.codAmount;
                    const profit = order.isVirtual ? effectiveRev - cod : effectiveRev - order.cogsTotal;

                    return (
                      <SystemTr
                        key={order.id}
                        className={`hover:bg-gray-50/70 dark:hover:bg-[#1a1b23]/60 transition-colors ${
                          isDirty ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        {/* STT */}
                        <SystemTd align="center" className="text-center text-xs text-gray-500 font-mono">
                          {(shopOrdersPage - 1) * shopOrdersLimit + idx + 1}
                        </SystemTd>

                        {/* Order Code & Shop */}
                        <SystemTd align="left">
                          <div className="flex flex-col min-w-0 py-1">
                            <button
                              type="button"
                              onClick={() => handleOpenOrderDetail(order.id)}
                              className="text-xs font-bold text-gray-900 dark:text-white hover:text-[#5865f2] dark:hover:text-indigo-400 truncate text-left flex items-center gap-1 group"
                              title="Click để xem chi tiết đơn"
                            >
                              <span className="truncate">{order.externalOrderId || order.internalOrderCode}</span>
                              <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[#5865f2]" />
                            </button>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 font-medium">
                                <Store size={10} className="text-gray-400" />
                                {order.shopName}
                              </span>
                              <span>•</span>
                              <span>{order.orderDate ? new Date(order.orderDate).toLocaleDateString('vi-VN') : ''}</span>
                            </div>
                          </div>
                        </SystemTd>

                        {/* Customer & Tracking */}
                        <SystemTd align="left">
                          <div className="flex flex-col min-w-0 py-1">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={order.recipientName || 'Khách hàng'}>
                              {order.recipientName || 'Khách lẻ'}
                            </span>
                            <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5" title={order.trackingCode || ''}>
                              MVD: {order.trackingCode || 'Chưa có'}
                            </span>
                          </div>
                        </SystemTd>

                        {/* Order Type & Status */}
                        <SystemTd align="center">
                          <div className="flex flex-col items-center gap-1 py-1">
                            {order.isVirtual ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Sparkles size={10} />
                                <span>Đơn ảo (Buff)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                Đơn thường
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-300 font-medium">
                                {order.platformStatus}
                              </span>
                              {order.verificationStatus === 'VERIFIED' ? (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium">
                                  Đã xuất kho
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </SystemTd>

                        {/* Product Selling Total with Breakdown */}
                        <SystemTd align="right">
                          <div className="flex flex-col items-end group relative py-1">
                            <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                              {order.productsSellingTotal.toLocaleString('vi-VN')} đ
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {order.items.reduce((s, it) => s + it.rawQuantity, 0)} sp ({order.items.length} dòng)
                            </span>
                            {/* Hover tooltip showing breakdown: rawQty x unitPrice = subtotal */}
                            <div className="hidden group-hover:block absolute right-0 top-full z-30 w-72 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 pointer-events-none mt-1">
                              <div className="font-semibold text-gray-300 border-b border-gray-700 pb-1 mb-1.5 flex items-center justify-between">
                                <span>Chi tiết tiền bán sản phẩm:</span>
                                <span className="text-[10px] text-indigo-300">Đơn giá × SL mua</span>
                              </div>
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {order.items.map((it, i) => (
                                  <div key={i} className="flex justify-between items-center py-0.5 text-[10px]">
                                    <span className="truncate pr-2 font-mono text-gray-300">
                                      {it.sku || it.productName}: {it.rawQuantity} × {it.unitPrice.toLocaleString('vi-VN')}đ
                                    </span>
                                    <span className="font-mono font-bold shrink-0 text-emerald-400">
                                      {it.subtotal.toLocaleString('vi-VN')}đ
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </SystemTd>

                        {/* Tiền COD shipper (Direct inline edit) */}
                        <SystemTd align="right">
                          <div className="flex flex-col items-end gap-0.5 py-1">
                            <div className="relative w-28">
                              <input
                                type="number"
                                value={edit.codAmount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPendingEdits((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...prev[order.id],
                                      codAmount: val,
                                      isDirty: true,
                                    },
                                  }));
                                }}
                                className="w-full text-right px-2 py-1 text-xs font-mono font-medium rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                                placeholder="0"
                              />
                            </div>
                            {order.isVirtual ? (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                Trả shipper
                              </span>
                            ) : null}
                          </div>
                        </SystemTd>

                        {/* Settled / Paid Payout */}
                        <SystemTd align="right">
                          <div className="flex flex-col items-end py-1">
                            {order.settledPayout !== null ? (
                              <>
                                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {order.settledPayout.toLocaleString('vi-VN')} đ
                                </span>
                                <span className="text-[10px] text-gray-400">Sàn quyết toán</span>
                              </>
                            ) : order.buyerPaidAmount !== null && order.buyerPaidAmount > 0 ? (
                              <>
                                <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {order.buyerPaidAmount.toLocaleString('vi-VN')} đ
                                </span>
                                <span className="text-[10px] text-gray-400">Người mua trả</span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 font-mono">-</span>
                            )}
                          </div>
                        </SystemTd>

                        {/* Custom Revenue (Nhập tay đối chiếu) */}
                        <SystemTd align="right">
                          <div className="flex flex-col items-end gap-0.5 py-1">
                            <div className="relative w-28">
                              <input
                                type="number"
                                value={edit.customRevenue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPendingEdits((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ...prev[order.id],
                                      customRevenue: val,
                                      isDirty: true,
                                    },
                                  }));
                                }}
                                className={`w-full text-right px-2 py-1 text-xs font-mono font-medium rounded border focus:outline-none focus:ring-1 focus:ring-[#5865f2] ${
                                  order.customRevenue !== null
                                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-900 dark:text-white'
                                }`}
                                placeholder="0"
                              />
                            </div>
                            {order.customRevenue !== null ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded">
                                Nhập tay
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-400">Từ sàn</span>
                            )}
                          </div>
                        </SystemTd>

                        {/* Calculated Profit */}
                        <SystemTd align="right">
                          <div className="flex flex-col items-end py-1">
                            {order.isVirtual ? (
                              <>
                                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                                  {(effectiveRev - cod).toLocaleString('vi-VN')} đ
                                </span>
                                <span
                                  className="text-[9px] text-purple-500/80 font-mono cursor-help"
                                  title={`Lợi nhuận đơn ảo = Doanh thu (${effectiveRev.toLocaleString('vi-VN')}đ) - Tiền COD (${cod.toLocaleString('vi-VN')}đ)`}
                                >
                                  = Doanh thu - COD
                                </span>
                              </>
                            ) : (
                              <>
                                <span className={`font-mono text-xs font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {profit.toLocaleString('vi-VN')} đ
                                </span>
                                <span className="text-[9px] text-gray-400 font-mono">
                                  = Doanh thu - Vốn
                                </span>
                              </>
                            )}
                          </div>
                        </SystemTd>

                        {/* Action buttons */}
                        <SystemTd align="center">
                          <div className="flex items-center justify-center gap-1">
                            {isDirty && (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleOrderFinancials(order.id)}
                                className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                title="Lưu doanh thu & COD đơn này"
                              >
                                <Save size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenOrderDetail(order.id)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#1a1b23] text-gray-600 dark:text-gray-400 hover:text-[#5865f2] transition-colors"
                              title="Xem chi tiết đơn hàng"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Cards View for Shop Orders */}
          <div className="flex flex-col md:hidden space-y-2.5 overflow-y-auto pb-4">
            {isLoadingShopOrders ? (
              <div className="py-12 text-center text-xs text-gray-500 animate-pulse">
                Đang tải danh sách đơn hàng shop...
              </div>
            ) : filteredShopOrders.length === 0 ? (
              <SystemTableEmpty
                colSpan={1}
                title="Không tìm thấy đơn hàng"
                description="Hãy thử đổi bộ lọc shop hoặc từ khóa tìm kiếm."
              />
            ) : (
              filteredShopOrders.map((order, idx) => {
                const edit = pendingEdits[order.id] || {
                  customRevenue: order.customRevenue !== null ? String(order.customRevenue) : String(order.totalAmount || 0),
                  codAmount: String(order.codAmount || 0),
                  isDirty: false,
                };
                const isDirty = edit.isDirty;
                const parsedRev = parseFloat(String(edit.customRevenue).replace(/,/g, ''));
                const parsedCod = parseFloat(String(edit.codAmount).replace(/,/g, ''));
                const effectiveRev = !isNaN(parsedRev) ? parsedRev : order.effectiveRevenue;
                const cod = !isNaN(parsedCod) ? parsedCod : order.codAmount;
                const profit = order.isVirtual ? effectiveRev - cod : effectiveRev - order.cogsTotal;

                return (
                  <div
                    key={order.id}
                    className={`p-3 rounded-lg border bg-white dark:bg-[#14151a] shadow-xs space-y-2.5 transition-all ${
                      isDirty ? 'border-amber-300 dark:border-amber-700/60' : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                            {order.externalOrderId || order.internalOrderCode}
                          </span>
                          {order.isVirtual ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                              Đơn ảo
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              Đơn thường
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                          <span>{order.shopName}</span>
                          <span>•</span>
                          <span>{order.orderDate ? new Date(order.orderDate).toLocaleDateString('vi-VN') : ''}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isDirty && (
                          <button
                            type="button"
                            onClick={() => handleSaveSingleOrderFinancials(order.id)}
                            className="px-2 py-1 rounded bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <Save size={12} />
                            <span>Lưu</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenOrderDetail(order.id)}
                          className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Tiền bán SP (Sàn)</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {order.productsSellingTotal.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Quyết toán sàn</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {order.settledPayout !== null ? `${order.settledPayout.toLocaleString('vi-VN')} đ` : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block mb-0.5">Tiền COD shipper:</span>
                        <input
                          type="number"
                          value={edit.codAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingEdits((prev) => ({
                              ...prev,
                              [order.id]: {
                                ...prev[order.id],
                                codAmount: val,
                                isDirty: true,
                              },
                            }));
                          }}
                          className="w-full text-right px-2 py-1 text-xs font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-900 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block mb-0.5">Doanh thu đối chiếu:</span>
                        <input
                          type="number"
                          value={edit.customRevenue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingEdits((prev) => ({
                              ...prev,
                              [order.id]: {
                                ...prev[order.id],
                                customRevenue: val,
                                isDirty: true,
                              },
                            }));
                          }}
                          className="w-full text-right px-2 py-1 text-xs font-mono rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-900 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <span className="text-[11px] text-gray-500">
                        {order.isVirtual ? 'Lợi nhuận đơn ảo (Doanh thu - COD):' : 'Lợi nhuận đơn thật (Doanh thu - Vốn):'}
                      </span>
                      <span className={`font-mono font-bold ${order.isVirtual ? 'text-purple-600 dark:text-purple-400' : profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {profit.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            <div className="rounded-[4px] border border-gray-200/60 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
              <SystemPagination
                currentPage={shopOrdersPage}
                totalPages={shopOrdersData?.pagination?.totalPages || 1}
                totalItems={shopOrdersData?.pagination?.totalItems || 0}
                itemsPerPage={shopOrdersLimit}
                onPageChange={(p) => setShopOrdersPage(p)}
                onLimitChange={(l) => {
                  setShopOrdersLimit(l);
                  setShopOrdersPage(1);
                }}
                className="border-t-0"
              />
            </div>
          </div>
        </>
      )}

      {/* ------------------- VIEW 2: SKU RECONCILIATION REPORT ------------------- */}
      {activeReportView === 'SKU_RECONCILIATION' && (
        <>
          {/* 4 Summary KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
            <SystemMetricPairCard
          leftItem={{
            title: 'Sản phẩm thực nhập kho',
            value: `${summary.totalImportedQuantity.toLocaleString('vi-VN')}`,
            subtitle:
              summary.totalStockBefore !== undefined
                ? `Tồn trước nhập: ${summary.totalStockBefore.toLocaleString('vi-VN')}${
                    summary.totalSupplierReturned && summary.totalSupplierReturned > 0
                      ? ` • Trả NCC: ${summary.totalSupplierReturned.toLocaleString('vi-VN')}`
                      : ''
                  }`
                : summary.totalSupplierReturned && summary.totalSupplierReturned > 0
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
            title: isFilteringSpecificShop ? `Tiền hàng đi: ${currentShop?.name || 'Shop'}` : 'Tổng tiền hàng đi (Tất cả shop)',
            value: `${(summary.totalExportedAmount || 0).toLocaleString('vi-VN')} đ`,
            subtitle: isFilteringSpecificShop
              ? `Tính theo giá hàng nhập của ${currentShop?.name || 'shop'}`
              : `Tính theo giá hàng nhập (${(summary.totalExportedQuantity || 0).toLocaleString('vi-VN')} sp xuất)`,
            icon: CircleDollarSign,
            colorScheme: 'green',
          }}
          rightItem={{
            title: isFilteringSpecificShop ? `Số đơn đi (${currentShop?.name || 'Shop'})` : 'Tổng số đơn hàng đi',
            value: `${(summary.totalOrdersCount || 0).toLocaleString('vi-VN')} đơn`,
            subtitle: `Sản phẩm đã xuất: ${(summary.totalExportedQuantity || 0).toLocaleString('vi-VN')}`,
            icon: ShoppingBag,
            colorScheme: 'indigo',
          }}
        />

        <SystemMetricPairCard
          leftItem={{
            title: 'SKU khớp đối soát',
            value: `${summary.balancedCount.toLocaleString('vi-VN')}`,
            subtitle: `Tồn kho = Tồn trước nhập + Nhập - Bán`,
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
            colorScheme: summary.outOfStockCount > 0 ? 'red' : 'green',
          }}
        />
      </div>

      {/* Shop Outbound Value Quick Bar */}
      {summary.shopsSummary && summary.shopsSummary.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 bg-gray-50/70 dark:bg-[#14151a] rounded-lg border border-gray-200/80 dark:border-gray-800 shrink-0">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1 mr-1">
            <CircleDollarSign size={13} className="text-emerald-500" />
            <span>Tiền hàng đi theo shop:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedShopId('ALL');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all cursor-pointer border shrink-0 ${
              selectedShopId === 'ALL'
                ? 'bg-[#5865f2] text-white border-[#5865f2] font-semibold shadow-xs'
                : 'bg-white dark:bg-[#1a1b23] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#202430]'
            }`}
          >
            <Store size={12} />
            <span>Tất cả</span>
            <span className={`font-mono text-[11px] font-bold ${selectedShopId === 'ALL' ? 'text-indigo-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {(summary.shopsSummary.reduce((sum, s) => sum + s.totalExportedAmount, 0)).toLocaleString('vi-VN')} đ
            </span>
          </button>
          {summary.shopsSummary.map((s) => {
            const isSelected = selectedShopId === s.shopId;
            return (
              <button
                key={s.shopId}
                type="button"
                onClick={() => {
                  setSelectedShopId(s.shopId);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                    : 'bg-white dark:bg-[#1a1b23] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#202430]'
                }`}
              >
                <Store size={12} className={isSelected ? 'text-white' : 'text-gray-400'} />
                <span>{s.shopName}:</span>
                <span className={`font-mono font-bold ${isSelected ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {s.totalExportedAmount.toLocaleString('vi-VN')} đ
                </span>
                <span className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                  ({s.ordersCount} đơn)
                </span>
              </button>
            );
          })}
        </div>
      )}

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
              value={selectedShopId || 'ALL'}
              onChange={(val) => {
                setSelectedShopId(String(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả Shop', icon: Store },
                ...shops.map((s) => ({
                  value: s.id,
                  label: s.name,
                  icon: Store,
                })),
              ]}
              placeholder="Chọn shop..."
              icon={Store}
              size="sm"
              className="w-full font-medium"
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
          <div className="col-span-1 sm:w-40">
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
          <div className="col-span-2 sm:flex-1 sm:min-w-[180px]">
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

      {/* Desktop Table View */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
        <SystemTableWrapper
          tableClassName="w-full text-left border-collapse table-fixed min-w-[1200px]"
          pagination={
            <SystemPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={limit}
              onPageChange={(page) => setCurrentPage(page)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setCurrentPage(1);
              }}
            />
          }
        >
          <colgroup>
            <col style={{ width: '48px' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '70px' }} />
          </colgroup>
          <SystemThead>
            <SystemTr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-[#1a1b23]/50">
              <SystemTh align="center" className="text-center">STT</SystemTh>
              <SystemTh align="left">Sản phẩm & SKU hệ thống</SystemTh>
              <SystemTh align="center" className="text-center font-bold text-gray-700 dark:text-gray-300">
                Số hàng trước nhập
              </SystemTh>
              <SystemTh align="right" className="text-right">Đã nhập kho</SystemTh>
              <SystemTh align="right" className="text-right">Đơn hàng đi</SystemTh>
              <SystemTh align="right" className="text-right">
                {isFilteringSpecificShop ? `Tiền hàng đi (${currentShop?.name || 'Shop'})` : 'Tiền hàng đi (Giá nhập)'}
              </SystemTh>
              <SystemTh align="center" className="text-center">Đối soát chênh lệch</SystemTh>
              <SystemTh align="center" className="text-center">Tỷ lệ xuất / nhập</SystemTh>
              <SystemTh align="center" className="text-center">Chi tiết</SystemTh>
            </SystemTr>
          </SystemThead>

          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton rows={8} cols={9} />
            ) : items.length === 0 ? (
              <SystemTableEmpty
                colSpan={9}
                title="Không tìm thấy sản phẩm đối soát"
                description="Hãy thử thay đổi bộ lọc ngày, kho hàng hoặc từ khóa tìm kiếm SKU."
              />
            ) : (
              items.map((item, index) => {
                const isBalanced = item.reconciliationStatus === 'BALANCED';
                const isSurplus = item.reconciliationStatus === 'SURPLUS';
                const isDeficit = item.reconciliationStatus === 'DEFICIT';

                return (
                  <SystemTr
                    key={item.variantId}
                    className="hover:bg-gray-50/70 dark:hover:bg-[#1a1b23]/60 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(item.variantId)}
                  >
                    {/* STT */}
                    <SystemTd align="center" className="text-center text-xs text-gray-500 font-mono">
                      {(currentPage - 1) * limit + index + 1}
                    </SystemTd>

                    {/* Product Name & Master Variant SKU */}
                    <SystemTd align="left">
                      <div className="flex flex-col min-w-0 py-1">
                        <span
                          className="text-xs font-semibold text-gray-900 dark:text-white truncate block hover:text-[#5865f2]"
                          title={item.productName}
                        >
                          {item.productName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                            {item.sku}
                          </span>
                          {item.variantName && item.variantName !== item.productName && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={item.variantName}>
                              • {item.variantName}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded shrink-0">
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    </SystemTd>

                    {/* Số hàng trước nhập */}
                    <SystemTd align="center" className="text-center font-mono">
                      <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                        {item.stockBefore.toLocaleString('vi-VN')}
                      </span>
                    </SystemTd>

                    {/* Nhập kho */}
                    <SystemTd align="right" className="text-right">
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
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap"
                            title={`Gốc: ${item.grossImportedQuantity} • Đã trả NCC: ${item.supplierReturnedQuantity}`}
                          >
                            Gốc +{item.grossImportedQuantity} • Trả -{item.supplierReturnedQuantity}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {item.receiptsCount} phiếu nhập
                          </span>
                        )}
                      </div>
                    </SystemTd>

                    {/* Đơn hàng đi (Xuất bán) */}
                    <SystemTd align="right" className="text-right">
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
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap"
                            title={`Đơn: ${item.grossExportedQuantity} • Khách hoàn: ${item.customerReturnedQuantity}`}
                          >
                            Đơn {item.grossExportedQuantity} • Hoàn -{item.customerReturnedQuantity}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {item.ordersCount} đơn hàng
                          </span>
                        )}
                      </div>
                    </SystemTd>

                    {/* Tổng tiền đơn đi (theo giá hàng nhập) */}
                    <SystemTd align="right" className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {(item.exportedAmount || 0).toLocaleString('vi-VN')} đ
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {item.exportedQuantity > 0 && item.exportedAmount
                            ? `~${Math.round(item.exportedAmount / item.exportedQuantity).toLocaleString('vi-VN')} đ/sp (giá nhập)`
                            : '0 đ'}
                        </span>
                      </div>
                    </SystemTd>

                    {/* Đối soát chênh lệch */}
                    <SystemTd align="center" className="text-center">
                      <div className="inline-flex flex-col items-center">
                        {isBalanced && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                            <CheckCircle2 size={11} /> Khớp (0)
                          </span>
                        )}
                        {isSurplus && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 whitespace-nowrap"
                            title={`Kho thực tế (${item.onHand}) cao hơn lý thuyết (${item.calculatedStock}) là ${item.discrepancy} cái`}
                          >
                            <AlertTriangle size={11} /> Lệch thừa (+{item.discrepancy})
                          </span>
                        )}
                        {isDeficit && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 whitespace-nowrap"
                            title={`Kho thực tế (${item.onHand}) thấp hơn lý thuyết (${item.calculatedStock}) là ${Math.abs(item.discrepancy)} cái`}
                          >
                            <AlertCircle size={11} /> Lệch thiếu ({item.discrepancy})
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-mono whitespace-nowrap">
                          <span>Kho: <strong className="text-gray-900 dark:text-gray-200">{item.onHand}</strong></span>
                          <span>•</span>
                          <span>Lý thuyết: <strong className="text-gray-900 dark:text-gray-200">{item.calculatedStock}</strong></span>
                        </div>
                      </div>
                    </SystemTd>

                    {/* Tỷ lệ xuất / nhập */}
                    <SystemTd align="center" className="text-center">
                      <div className="flex flex-col items-center w-28 mx-auto">
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
                    <SystemTd align="center" className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item.variantId)}
                        className="px-2.5 py-1 text-xs font-medium text-[#5865f2] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 whitespace-nowrap"
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

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 flex flex-col min-h-fit space-y-3 pb-8">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Đang tải dữ liệu đối soát...
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Không tìm thấy sản phẩm đối soát nào
          </div>
        ) : (
          items.map((item) => {
            const isBalanced = item.reconciliationStatus === 'BALANCED';
            const isSurplus = item.reconciliationStatus === 'SURPLUS';
            const isDeficit = item.reconciliationStatus === 'DEFICIT';

            return (
              <div
                key={item.variantId}
                onClick={() => handleOpenDetail(item.variantId)}
                className="p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border border-gray-200/60 dark:border-white/[0.08] space-y-2 cursor-pointer shadow-none card-border transition-colors hover:border-gray-300 dark:hover:border-white/[0.15]"
              >
                {/* Header: SKU badge + Variant & Status badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-mono font-bold text-xs text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/40">
                      {item.sku}
                    </span>
                    {item.variantName && item.variantName !== item.productName && (
                      <span className="text-[11px] text-gray-400 truncate max-w-[150px]">
                        {item.variantName}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded shrink-0">
                      {item.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isBalanced && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={11} /> Khớp (0)
                      </span>
                    )}
                    {isSurplus && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle size={11} /> Thừa (+{item.discrepancy})
                      </span>
                    )}
                    {isDeficit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertCircle size={11} /> Thiếu ({item.discrepancy})
                      </span>
                    )}
                  </div>
                </div>

                {/* Product Name & Outbound GMV */}
                <div className="text-xs text-gray-500 flex items-center justify-between font-normal gap-2">
                  <span className="truncate font-medium text-gray-900 dark:text-white" title={item.productName}>
                    {item.productName}
                  </span>
                  <span className="font-medium text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                    {(item.exportedAmount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>

                {/* Quantitative flow breakdown (dashed divider) */}
                <div className="grid grid-cols-4 gap-1.5 py-1.5 border-t border-dashed border-gray-100 dark:border-gray-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block truncate">Trước nhập</span>
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                      {item.stockBefore.toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block truncate">Thực nhập</span>
                    <span
                      className={`font-mono font-bold ${
                        item.importedQuantity > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {item.importedQuantity > 0 ? `+${item.importedQuantity.toLocaleString('vi-VN')}` : item.importedQuantity.toLocaleString('vi-VN')}
                    </span>
                    {item.supplierReturnedQuantity && item.supplierReturnedQuantity > 0 ? (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 block truncate">
                        Trả -{item.supplierReturnedQuantity}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-400 block truncate">{item.receiptsCount} phiếu</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block truncate">Đơn hàng đi</span>
                    <span
                      className={`font-mono font-bold ${
                        item.exportedQuantity > 0
                          ? 'text-[#5865f2] dark:text-indigo-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {item.exportedQuantity > 0 ? `-${item.exportedQuantity.toLocaleString('vi-VN')}` : item.exportedQuantity.toLocaleString('vi-VN')}
                    </span>
                    {item.customerReturnedQuantity && item.customerReturnedQuantity > 0 ? (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block truncate">
                        Hoàn -{item.customerReturnedQuantity}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-400 block truncate">{item.ordersCount} đơn</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block truncate">Lý thuyết</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      {item.calculatedStock.toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Footer: Fulfillment rate & detail prompt */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-800 text-gray-400 font-normal">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-500">Tỷ lệ xuất:</span>
                    <span className="font-mono font-semibold text-xs text-gray-800 dark:text-gray-200">
                      {item.fulfillmentRatePercent}%
                    </span>
                    <div className="w-14 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden inline-block ml-0.5">
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
                  <span className="text-xs font-medium text-[#5865f2] dark:text-indigo-400 inline-flex items-center gap-0.5">
                    Chi tiết <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="rounded-[4px] border border-gray-200/60 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
          <SystemPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={limit}
            onPageChange={(page) => setCurrentPage(page)}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setCurrentPage(1);
            }}
            className="border-t-0"
          />
        </div>
        <div className="h-6 md:hidden shrink-0" aria-hidden="true" />
      </div>
      </>
      )}

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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-center">
                    <div className="p-2 rounded bg-white dark:bg-[#131720] border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block truncate">Số hàng trước nhập</span>
                      <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                        {(detailData.stockBefore ?? 0).toLocaleString('vi-VN')} {detailData.variant.unit}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720] border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block truncate">Thực nhập kho</span>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.max(
                          0,
                          detailData.receipts.reduce((s, r) => s + r.receivedQuantity, 0) -
                            (detailData.purchaseReturns?.reduce((s, pr) => s + pr.quantity, 0) || 0)
                        )}{' '}
                        {detailData.variant.unit}
                      </span>
                      {detailData.purchaseReturns && detailData.purchaseReturns.length > 0 ? (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 block font-medium truncate">
                          (Nhập: {detailData.receipts.reduce((s, r) => s + r.receivedQuantity, 0)} • Trả:{' '}
                          {detailData.purchaseReturns.reduce((s, pr) => s + pr.quantity, 0)})
                        </span>
                      ) : null}
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720] border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block truncate">Thực xuất bán (Đơn)</span>
                      <span className="font-mono text-xs font-bold text-[#5865f2] dark:text-indigo-400">
                        {Math.max(
                          0,
                          detailData.orders.reduce((s, o) => s + o.quantity, 0) -
                            (detailData.orderReturns?.reduce((s, or) => s + or.sellableQuantity, 0) || 0)
                        )}{' '}
                        {detailData.variant.unit}
                      </span>
                      {detailData.orderReturns && detailData.orderReturns.length > 0 ? (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-medium truncate">
                          (Đơn: {detailData.orders.reduce((s, o) => s + o.quantity, 0)} • Hoàn:{' '}
                          {detailData.orderReturns.reduce((s, or) => s + or.sellableQuantity, 0)})
                        </span>
                      ) : null}
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-[#131720] border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block truncate">Tồn kho thực tế</span>
                      <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                        {detailData.inventoryBalances.reduce((s, b) => s + b.onHand, 0)} {detailData.variant.unit}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-2 rounded bg-white dark:bg-[#131720] border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block truncate">Tồn khả dụng</span>
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
                      <>
                        {/* Outbound Value Summary for Variant */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 gap-1.5 text-xs">
                          <span className="text-gray-700 dark:text-gray-300">
                            Đơn hàng xuất: <strong className="text-gray-900 dark:text-white">{detailData.orders.length} đơn</strong>
                            {' • '}Số lượng xuất: <strong className="text-[#5865f2] dark:text-indigo-400">{detailData.orders.reduce((s, o) => s + o.quantity, 0)} {detailData.variant.unit}</strong>
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                            <CircleDollarSign size={14} className="text-emerald-500" />
                            <span>Tổng tiền hàng đi (Giá nhập):</span>
                            <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {(
                                detailData.orders.reduce((s, o) => s + o.quantity, 0) *
                                (detailData.variant.costPrice || 0)
                              ).toLocaleString('vi-VN')}{' '}
                              đ
                            </span>
                          </span>
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                              <tr>
                                <th className="p-2.5">Mã đơn hàng</th>
                                <th className="p-2.5">Mã vận đơn</th>
                                <th className="p-2.5">Shop bán</th>
                                <th className="p-2.5">Ngày đặt</th>
                                <th className="p-2.5 text-center">Số lượng</th>
                                <th className="p-2.5 text-right">Đơn giá</th>
                                <th className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">Thành tiền</th>
                                <th className="p-2.5 text-center">Trạng thái sàn</th>
                                <th className="p-2.5 text-center">Xuất kho</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {detailData.orders.map((o) => {
                                const rawQty = o.rawQuantity && o.rawQuantity > 0 ? o.rawQuantity : 1;
                                const unitPrice = Number(o.discountedPrice || o.unitPrice || detailData.variant.sellingPrice || 0);
                                const subtotal = o.itemAmount !== undefined && o.itemAmount > 0 ? o.itemAmount : (rawQty * unitPrice);
                                return (
                                  <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                                    <td className="p-2.5 font-mono font-bold text-gray-900 dark:text-white">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>{o.internalOrderCode || o.externalOrderId}</span>
                                        {o.isVirtual && (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                            Đơn ảo
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2.5 font-mono text-gray-600 dark:text-gray-400">
                                      {o.trackingCode || '—'}
                                    </td>
                                    <td className="p-2.5 text-gray-800 dark:text-gray-200 font-medium">
                                      {o.shopName}
                                    </td>
                                    <td className="p-2.5 text-gray-500">
                                      {o.orderDate ? new Date(o.orderDate).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td className="p-2.5 text-center font-mono font-bold text-[#5865f2] dark:text-indigo-400">
                                      <span>{rawQty}</span>
                                      {o.packMultiplier && o.packMultiplier > 1 && (
                                        <span className="block text-[10px] font-normal text-gray-400">
                                          (= {o.quantity} sp kho)
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                                      {unitPrice.toLocaleString('vi-VN')}đ
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      {subtotal.toLocaleString('vi-VN')}đ
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
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-2">
                          {detailData.orders.map((o) => {
                            const rawQty = o.rawQuantity && o.rawQuantity > 0 ? o.rawQuantity : 1;
                            const unitPrice = Number(o.discountedPrice || o.unitPrice || detailData.variant.sellingPrice || 0);
                            const subtotal = o.itemAmount !== undefined && o.itemAmount > 0 ? o.itemAmount : (rawQty * unitPrice);
                            return (
                              <div
                                key={o.id}
                                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2 shadow-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                      <span>{o.internalOrderCode || o.externalOrderId}</span>
                                      {o.isVirtual && (
                                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                          Đơn ảo
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                      Shop: <span className="font-medium text-gray-700 dark:text-gray-300">{o.shopName}</span>
                                    </div>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                                    {o.platformStatus}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 py-1 border-y border-gray-100 dark:border-gray-800/80">
                                  <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                                    Vận đơn: {o.trackingCode || '—'}
                                  </span>
                                  <span className="text-[11px]">
                                    {o.orderDate ? new Date(o.orderDate).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-[#5865f2] dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded font-mono">
                                      x{rawQty} {o.packMultiplier && o.packMultiplier > 1 ? `(=${o.quantity})` : ''}
                                    </span>
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 font-medium">
                                      {unitPrice.toLocaleString('vi-VN')}đ
                                    </span>
                                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      = {subtotal.toLocaleString('vi-VN')}đ
                                    </span>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      o.fulfillmentStatus === 'DISPATCHED'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {o.fulfillmentStatus === 'DISPATCHED' ? 'Đã quét xuất' : 'Chờ xuất'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
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
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-[#1a1b23] text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                              <tr>
                                <th className="p-2.5">Mã phiếu nhập</th>
                                <th className="p-2.5">Nhà cung cấp</th>
                                <th className="p-2.5">Kho nhận</th>
                                <th className="p-2.5">Ngày nhập</th>
                                <th className="p-2.5 text-center font-bold text-gray-700 dark:text-gray-300">Số hàng trước nhập</th>
                                <th className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">SL thực nhận (+)</th>
                                <th className="p-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">Tồn sau nhập (=)</th>
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
                                  <td className="p-2.5 text-gray-500 whitespace-nowrap">
                                    {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('vi-VN') : '—'}
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                      {(r.stockBefore ?? 0).toLocaleString('vi-VN')}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40">
                                      +{r.receivedQuantity.toLocaleString('vi-VN')}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    <span className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
                                      ={(r.stockAfter ?? r.receivedQuantity).toLocaleString('vi-VN')}
                                    </span>
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

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-2">
                          {detailData.receipts.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2.5 shadow-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono font-bold text-xs text-[#5865f2] dark:text-indigo-400 truncate">
                                    {r.receiptCode}
                                  </div>
                                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                    NCC: <span className="font-medium text-gray-700 dark:text-gray-300">{r.supplierName}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 block">
                                    {r.paymentStatus}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                                    {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* 3-Step Stock Movement Pill */}
                              <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-gray-50 dark:bg-[#131720] border border-gray-100 dark:border-gray-800 text-center">
                                <div>
                                  <span className="text-[10px] text-gray-400 block truncate">Trước nhập</span>
                                  <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {(r.stockBefore ?? 0).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 block truncate">Thực nhận (+)</span>
                                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    +{r.receivedQuantity.toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 block truncate">Tồn sau nhập</span>
                                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    ={(r.stockAfter ?? r.receivedQuantity).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>

                              {/* Warehouse & Price Info */}
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-800/80">
                                <span className="text-gray-500 text-[11px] truncate">
                                  Kho: <span className="text-gray-700 dark:text-gray-300 font-medium">{r.warehouseName}</span>
                                </span>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {r.subtotal.toLocaleString('vi-VN')}đ
                                  </span>
                                  <span className="text-[10px] text-gray-400 block">
                                    ({r.unitPrice.toLocaleString('vi-VN')}đ/{detailData.variant.unit})
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
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
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
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

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-2">
                          {detailData.purchaseReturns.map((pr) => (
                            <div
                              key={pr.id}
                              className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2 shadow-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                                    {pr.returnCode}
                                  </div>
                                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                    NCC: <span className="font-medium text-gray-700 dark:text-gray-300">{pr.supplierName}</span>
                                  </div>
                                </div>
                                <span className="text-[11px] text-gray-400 shrink-0">
                                  {pr.returnDate ? new Date(pr.returnDate).toLocaleDateString('vi-VN') : '—'}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 text-center">
                                <div>
                                  <span className="text-[10px] text-gray-500 block">SL trả</span>
                                  <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                                    -{pr.quantity}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-500 block">Đơn giá hoàn</span>
                                  <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {pr.unitPrice.toLocaleString('vi-VN')}đ
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-500 block">Giảm trừ nợ</span>
                                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {pr.debtOffsetAmount.toLocaleString('vi-VN')}đ
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800/80">
                                <span>Phiếu gốc: <span className="font-mono text-gray-700 dark:text-gray-300">{pr.receiptCode || '—'}</span></span>
                                {pr.reason && <span className="italic text-gray-400 truncate max-w-[150px]">{pr.reason}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
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
                      <>
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
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

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-2">
                          {detailData.orderReturns.map((or) => (
                            <div
                              key={or.id}
                              className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2 shadow-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                    {or.returnCode}
                                  </div>
                                  <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                    Shop: <span className="font-medium text-gray-700 dark:text-gray-300">{or.shopName}</span>
                                  </div>
                                </div>
                                <span className="text-[11px] text-gray-400 shrink-0">
                                  {or.receivedDate ? new Date(or.receivedDate).toLocaleDateString('vi-VN') : '—'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs py-1 border-y border-gray-100 dark:border-gray-800">
                                <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                                  Đơn: {or.orderCode || '—'}
                                </span>
                                <span className="font-mono text-[11px] text-gray-500">
                                  VĐ: {or.trackingCode || '—'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                    Bán lại: +{or.sellableQuantity}
                                  </span>
                                  {or.damagedQuantity > 0 && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40">
                                      Lỗi: +{or.damagedQuantity}
                                    </span>
                                  )}
                                </div>
                                {or.reason && (
                                  <span className="text-[11px] text-gray-400 italic truncate max-w-[140px]">
                                    {or.reason}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 5: Warehouse balances */}
                {detailActiveTab === 'WAREHOUSES' && (
                  <div className="space-y-2">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-800 rounded">
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

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-2">
                      {detailData.inventoryBalances.map((b) => (
                        <div
                          key={b.warehouseId}
                          className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b23] space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-xs text-gray-900 dark:text-white">
                              {b.warehouseName}
                            </div>
                            <span className="font-mono text-[11px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                              {b.warehouseCode}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 py-2 border-t border-gray-100 dark:border-gray-800 text-center">
                            <div>
                              <span className="text-[10px] text-gray-400 block truncate">Tồn thực tế</span>
                              <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                                {b.onHand.toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block truncate">Đang giữ</span>
                              <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                                {b.reserved.toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block truncate">Khả dụng</span>
                              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {b.available.toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block truncate">Hàng lỗi</span>
                              <span className="font-mono text-xs font-medium text-rose-500">
                                {b.damaged.toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </ModalBody>
        </Modal>
      )}

      {/* Order Detail Drawer */}
      {selectedOrderForDrawer && (
        <OrderDetailDrawer
          order={selectedOrderForDrawer}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedOrderForDrawer(null);
          }}
          onRefresh={() => {
            loadShopOrdersData();
            if (activeReportView === 'SKU_RECONCILIATION') {
              loadReportData();
            }
          }}
        />
      )}
    </div>
  );
};

export default OrderReportsPage;
