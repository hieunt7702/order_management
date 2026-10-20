import React, { useState, useEffect } from 'react';
import {
  History,
  RotateCcw,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Warehouse,
  FileText,
  Package,
  Boxes,
  CheckCircle,
  Clock,
  Layers,
  User,
  ShieldCheck,
  Calendar,
  X,
  ArrowUpDown,
} from 'lucide-react';
import {
  inventoryApi,
  VariantInventorySummary,
  InventoryLedgerEntry,
} from '../../services/inventoryApi';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
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
} from '../ui/SystemTable';
import { Select } from '../ui/Select';
import { formatLedgerNote } from '../../utils/inventoryUtils';
import { Button } from '../ui/Button';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  variantId: string;
  sku: string;
  productName: string;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  isOpen,
  onClose,
  variantId,
  sku,
  productName,
}) => {
  const { warehouses } = useWorkspaceStore();

  const [summaryData, setSummaryData] = useState<VariantInventorySummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<InventoryLedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [movementType, setMovementType] = useState<string>('');
  const [stockState, setStockState] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail preview for clicked ledger row
  const [selectedEntry, setSelectedEntry] = useState<InventoryLedgerEntry | null>(null);

  useEffect(() => {
    if (isOpen && variantId) {
      loadVariantSummary();
      loadLedger();
    }
  }, [isOpen, variantId, selectedWarehouseId, page, limit, movementType, stockState]);

  const loadVariantSummary = async () => {
    try {
      const res = await inventoryApi.getVariantSummary(
        variantId,
        selectedWarehouseId || undefined
      );
      const data = (res as any)?.data || res;
      setSummaryData(data);
    } catch (err) {
      console.error('Lỗi tải tóm tắt tồn kho:', err);
    }
  };

  const loadLedger = async () => {
    try {
      setIsLoading(true);
      const res = await inventoryApi.getLedger({
        variantId,
        warehouseId: selectedWarehouseId || undefined,
        page,
        limit,
        movementType: movementType || undefined,
        stockState: stockState || undefined,
        search: searchTerm.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const data = (res as any)?.data || res;
      if (data && data.items) {
        setLedgerEntries(data.items);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setLedgerEntries(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Lỗi tải sổ cái tồn kho:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilter = () => {
    setPage(1);
    loadLedger();
  };

  const handleResetFilter = () => {
    setSearchTerm('');
    setMovementType('');
    setStockState('');
    setStartDate('');
    setEndDate('');
    setSelectedWarehouseId('');
    setPage(1);
  };

  const formatMovementBadge = (type: string, delta: number, state?: string) => {
    switch (type) {
      case 'RECEIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
            <ArrowDownLeft className="w-3 h-3" /> Nhập từ NCC
          </span>
        );
      case 'BORROW_RECEIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
            <ArrowDownLeft className="w-3 h-3" /> Mượn hàng NCC
          </span>
        );
      case 'BORROW_RETURN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50">
            <ArrowUpRight className="w-3 h-3" /> Cho mượn / Trả mượn
          </span>
        );
      case 'DISPATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50">
            <ArrowUpRight className="w-3 h-3" /> Xuất bán
          </span>
        );
      case 'RETURN_RECEIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/50">
            <RotateCcw className="w-3 h-3" /> Khách hoàn (Đạt chuẩn)
          </span>
        );
      case 'RETURN_DAMAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50">
            <AlertTriangle className="w-3 h-3" /> Khách hoàn (Hàng lỗi)
          </span>
        );
      case 'PURCHASE_RETURN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50">
            <ArrowUpRight className="w-3 h-3" /> Trả NCC
          </span>
        );
      case 'ADJUST':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
            <Layers className="w-3 h-3" /> Điều chỉnh kiểm kê
          </span>
        );
      case 'STATUS_CONVERT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50">
            <RotateCcw className="w-3 h-3" /> Chuyển trạng thái hàng
          </span>
        );
      case 'SCRAP_DISPOSAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50">
            <AlertTriangle className="w-3 h-3" /> Xuất hủy / Mất hàng
          </span>
        );
      case 'OPENING_BALANCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <Clock className="w-3 h-3" /> Số dư đầu kỳ
          </span>
        );
      case 'RESERVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
            <Layers className="w-3 h-3" /> Giữ hàng đơn
          </span>
        );
      case 'RELEASE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/50">
            <RotateCcw className="w-3 h-3" /> Hủy giữ hàng
          </span>
        );
      default:
        if (delta > 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
              <ArrowDownLeft className="w-3 h-3" /> Nhập kho (+)
            </span>
          );
        }
        if (delta < 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50">
              <ArrowUpRight className="w-3 h-3" /> Xuất kho (-)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {type && type !== 'UNKNOWN' ? type : 'Biến động kho'}
          </span>
        );
    }
  };

  const formatDelta = (entry: InventoryLedgerEntry) => {
    let delta = 0;
    if (entry.stockState === 'DAMAGED') {
      delta = entry.deltaDamaged;
    } else if (entry.stockState === 'PENDING_INSPECTION') {
      delta = entry.deltaInspection;
    } else {
      delta = entry.deltaOnHand;
    }

    if (delta > 0) {
      return <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{delta}</span>;
    } else if (delta < 0) {
      return <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{delta}</span>;
    }
    return <span className="font-mono text-gray-400">0</span>;
  };

  const formatBeforeAfter = (entry: InventoryLedgerEntry) => {
    if (
      entry.beforeOnHand !== null &&
      entry.beforeOnHand !== undefined &&
      entry.afterOnHand !== null &&
      entry.afterOnHand !== undefined
    ) {
      return (
        <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
          {entry.beforeOnHand} &rarr;{' '}
          <strong className="text-gray-900 dark:text-white">{entry.afterOnHand}</strong>
        </span>
      );
    }
    return <span className="text-gray-400 text-[11px]">-</span>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={<><span className="sm:hidden">Lịch sử kho: {sku}</span><span className="hidden sm:inline">{`Lịch Sử Xuất Nhập & Tồn Kho: ${sku}`}</span></>}
      subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Sản phẩm: ${productName} • Lịch sử các lần xuất, nhập, hoàn và số dư sau mỗi lần`}</span>}
      icon={History}
      size="3xl"
      maxWidth="max-w-[96vw] xl:max-w-7xl w-full"
    >
      <ModalBody className="p-3 sm:p-5 space-y-3 sm:space-y-3.5 flex flex-col flex-1 min-h-0">
        {/* Product & Warehouse Header */}
        <div className="p-3 bg-gray-50/80 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Package size={13} className="text-[#5865f2] shrink-0" />
              <span>Sản phẩm: {productName}</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[#5865f2] bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/50 flex items-center gap-1">
                <Boxes size={12} className="shrink-0" />
                <span>SKU: {sku}</span>
              </span>
              {summaryData?.variant?.name && summaryData.variant.name !== productName && (
                <span className="text-xs font-normal text-gray-400">
                  ({summaryData.variant.name})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0 flex items-center gap-1">
              <Warehouse size={13} className="text-gray-400 shrink-0" />
              <span>Xem theo kho:</span>
            </span>
            <Select
              value={selectedWarehouseId}
              onChange={(val: any) => setSelectedWarehouseId(val)}
              options={[
                { value: '', label: '-- Toàn bộ hệ thống kho --', icon: Warehouse },
                ...warehouses.map((w) => ({
                  value: w.id,
                  label: `${w.code} - ${w.name}`,
                  icon: Warehouse,
                })),
              ]}
              icon={Warehouse}
              size="sm"
              className="w-56"
              menuWidth="w-64"
            />
          </div>
        </div>

        {/* 5 Top Metric Cards with Illustrative Icons */}
        {summaryData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs shrink-0">
            {/* 1. Tồn thực tế tại kho */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
                <Boxes size={13} className="text-blue-500 shrink-0" />
                <span>Tồn thực tế kho</span>
              </div>
              <div className="text-xl font-bold font-mono text-blue-900 dark:text-blue-100 my-1">
                {(summaryData.summary?.actualWarehouseStock ?? 0).toLocaleString('vi-VN')}
              </div>
              <span className="text-[10px] text-gray-400 block leading-tight">
                Bán được + lỗi + chờ KT
              </span>
            </div>

            {/* 2. Hàng sẵn sàng bán */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                <span>Sẵn sàng bán</span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-100 my-1">
                {(summaryData.summary?.sellableStock ?? 0).toLocaleString('vi-VN')}
              </div>
              <span className="text-[10px] text-gray-400 block leading-tight">
                Hàng đạt chất lượng
              </span>
            </div>

            {/* 5. Đang hoàn về */}
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40 rounded flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                <RotateCcw size={13} className="text-purple-500 shrink-0" />
                <span>Đang hoàn về</span>
              </div>
              <div className="text-xl font-bold font-mono text-purple-900 dark:text-purple-100 my-1">
                {(summaryData.summary?.inboundReturningStock ?? 0).toLocaleString('vi-VN')}
              </div>
              <span className="text-[10px] text-gray-400 block leading-tight">
                Chưa nhận, ko tính tồn
              </span>
            </div>

            {/* 6. Hàng lỗi / hỏng */}
            <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 rounded flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                <AlertTriangle size={13} className="text-rose-500 shrink-0" />
                <span>Hàng lỗi / hỏng</span>
              </div>
              <div className="text-xl font-bold font-mono text-rose-900 dark:text-rose-100 my-1">
                {(summaryData.summary?.damagedStock ?? 0).toLocaleString('vi-VN')}
              </div>
              <span className="text-[10px] text-gray-400 block leading-tight">
                Hỏng, móp, cận date
              </span>
            </div>
          </div>
        )}

        {/* Filter Toolbar matching System Standard with Icons */}
        <div className="p-3 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Mã phiếu, người làm, chứng từ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                className="w-full pl-8 pr-3 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
              />
            </div>

            {/* Movement Type */}
            <Select
              value={movementType}
              onChange={(val: any) => setMovementType(val)}
              options={[
                { value: '', label: 'Tất cả loại biến động', icon: Layers },
                { value: 'RECEIVE', label: 'Nhập từ NCC', icon: ArrowDownLeft },
                { value: 'BORROW_RECEIVE', label: 'Mượn hàng NCC', icon: ArrowDownLeft },
                { value: 'BORROW_RETURN', label: 'Cho mượn / Trả mượn', icon: ArrowUpRight },
                { value: 'DISPATCH', label: 'Xuất bán', icon: ArrowUpRight },
                { value: 'RETURN_RECEIVE', label: 'Khách hoàn (Đạt chuẩn)', icon: RotateCcw },
                { value: 'RETURN_DAMAGE', label: 'Khách hoàn (Hàng lỗi)', icon: AlertTriangle },
                { value: 'PURCHASE_RETURN', label: 'Trả nhà cung cấp', icon: ArrowUpRight },
                { value: 'ADJUST', label: 'Điều chỉnh kiểm kê', icon: Layers },
                { value: 'STATUS_CONVERT', label: 'Chuyển trạng thái hàng', icon: RotateCcw },
                { value: 'SCRAP_DISPOSAL', label: 'Xuất hủy / Mất hàng', icon: AlertTriangle },
                { value: 'OPENING_BALANCE', label: 'Số dư đầu kỳ', icon: Clock },
                { value: 'RESERVE', label: 'Giữ hàng cho đơn', icon: Layers },
                { value: 'RELEASE', label: 'Hủy giữ hàng', icon: RotateCcw },
              ]}
              icon={Layers}
              size="sm"
              className="w-full sm:w-48"
              menuWidth="w-56"
            />

            {/* Stock State - Ẩn trên mobile */}
            <div className="hidden sm:block">
              <Select
                value={stockState}
                onChange={(val: any) => setStockState(val)}
                options={[
                  { value: '', label: 'Tất cả trạng thái hàng', icon: ShieldCheck },
                  { value: 'SELLABLE', label: 'Đủ điều kiện bán (Đạt chuẩn)', icon: CheckCircle },
                  { value: 'DAMAGED', label: 'Hàng lỗi / hỏng', icon: AlertTriangle },
                  { value: 'PENDING_INSPECTION', label: 'Chờ kiểm tra', icon: Clock },
                ]}
                icon={ShieldCheck}
                size="sm"
                className="w-44"
                menuWidth="w-52"
              />
            </div>

            {/* Date range with Calendar icon - Ẩn trên mobile */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-0 p-0 text-xs text-gray-900 dark:text-white focus:outline-none"
                  title="Từ ngày"
                />
              </div>
              <span className="text-gray-400 text-xs">&rarr;</span>
              <div className="flex items-center gap-1 px-2 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-0 p-0 text-xs text-gray-900 dark:text-white focus:outline-none"
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleApplyFilter}
              className="h-8 gap-1.5 px-3.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold cursor-pointer flex-1 sm:flex-initial justify-center"
            >
              <Filter size={13} />
              <span>Lọc dữ liệu</span>
            </Button>
            <button
              type="button"
              onClick={handleResetFilter}
              className="h-8 px-2.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#1a1b23] text-gray-500 hover:text-gray-900 dark:hover:text-white text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          </div>
        </div>

        {/* 1. Main Ledger Table: Chỉ hiển thị trên Desktop (hidden trên Mobile & Tablet) */}
        <div className="hidden lg:flex flex-col flex-1 min-h-0">
          <SystemTableWrapper
            tableClassName="min-w-[1100px]"
            pagination={
              <SystemPagination
                page={page - 1}
                totalPages={totalPages}
                totalItems={total}
                setPage={(p) => setPage(p + 1)}
                itemsPerPage={limit}
                setItemsPerPage={(l) => {
                  setLimit(l);
                  setPage(1);
                }}
              />
            }
          >
            <SystemThead>
              <SystemTr>
                <SystemTh className="w-36" align="left">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-gray-400 shrink-0" />
                    <span>Thời Gian</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-44" align="left">
                  <div className="flex items-center gap-1.5">
                    <Layers size={12} className="text-gray-400 shrink-0" />
                    <span>Loại Giao Dịch</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-36" align="left">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="text-gray-400 shrink-0" />
                    <span>Chứng Từ</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-40" align="left">
                  <div className="flex items-center gap-1.5">
                    <Warehouse size={12} className="text-gray-400 shrink-0" />
                    <span>Kho & Trạng Thái</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-28" align="right">
                  <div className="flex items-center justify-end gap-1">
                    <ArrowUpDown size={12} className="text-gray-400 shrink-0" />
                    <span>Thay Đổi</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-36" align="center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Boxes size={12} className="text-gray-400 shrink-0" />
                    <span>Tồn Trước &rarr; Sau</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-32" align="left">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-400 shrink-0" />
                    <span>Lô & HSD</span>
                  </div>
                </SystemTh>
                <SystemTh className="w-32" align="left">
                  <div className="flex items-center gap-1.5">
                    <User size={12} className="text-gray-400 shrink-0" />
                    <span>Người Thực Hiện</span>
                  </div>
                </SystemTh>
                <SystemTh className="min-w-[140px]" align="left">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="text-gray-400 shrink-0" />
                    <span>Ghi Chú</span>
                  </div>
                </SystemTh>
              </SystemTr>
            </SystemThead>
            <SystemTbody>
              {isLoading ? (
                <SystemTableSkeleton cols={9} rows={6} />
              ) : ledgerEntries.length === 0 ? (
                <SystemTableEmpty
                  colSpan={9}
                  title="Chưa có lịch sử xuất nhập"
                  description="Không tìm thấy lịch sử xuất nhập nào cho sản phẩm này theo điều kiện lọc hiện tại."
                />
              ) : (
                ledgerEntries.map((row) => (
                  <SystemTr
                    key={row.id}
                    onClick={() => setSelectedEntry(row)}
                    className="cursor-pointer"
                  >
                    {/* Thời gian */}
                    <SystemTd className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </SystemTd>

                    {/* Loại giao dịch */}
                    <SystemTd className="whitespace-nowrap">
                      {formatMovementBadge(row.movementType, row.deltaOnHand, row.stockState)}
                    </SystemTd>

                    {/* Chứng từ liên quan */}
                    <SystemTd className="font-mono font-bold text-[#5865f2] whitespace-nowrap">
                      {row.voucherCode || (row.referenceType === 'PACKAGE' ? `Kiện ${row.referenceId?.substring(0, 8)}` : row.referenceId?.substring(0, 8)) || '-'}
                    </SystemTd>

                    {/* Kho & Trạng thái */}
                    <SystemTd className="whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {row.warehouseName || row.warehouseCode}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {row.stockState === 'DAMAGED'
                          ? 'Hàng lỗi'
                          : row.stockState === 'PENDING_INSPECTION'
                          ? 'Chờ kiểm tra'
                          : 'Có thể bán'}
                      </span>
                    </SystemTd>

                    {/* Thay đổi */}
                    <SystemTd align="right" className="whitespace-nowrap">
                      {formatDelta(row)}
                    </SystemTd>

                    {/* Tồn trước -> sau */}
                    <SystemTd align="center" className="whitespace-nowrap">
                      {formatBeforeAfter(row)}
                    </SystemTd>

                    {/* Lô & HSD */}
                    <SystemTd className="text-[11px] whitespace-nowrap">
                      {row.batchCode ? (
                        <div>
                          <span className="font-mono text-gray-800 dark:text-gray-200 font-semibold">
                            {row.batchCode}
                          </span>
                          {row.expiryDate && (
                            <div className="text-[10px] text-gray-400">
                              HSD: {new Date(row.expiryDate).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </SystemTd>

                    {/* Người thực hiện */}
                    <SystemTd className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.performerName || 'Hệ thống'}
                    </SystemTd>

                    {/* Ghi chú */}
                    <SystemTd className="text-[11px] text-gray-500 max-w-xs truncate" title={formatLedgerNote(row.note) || ''}>
                      {formatLedgerNote(row.note) || '-'}
                    </SystemTd>
                  </SystemTr>
                ))
              )}
            </SystemTbody>
          </SystemTableWrapper>
        </div>

        {/* 2. Mobile & Tablet Card View: Thay thế hoàn toàn Table trên Mobile & Tablet (lg:hidden) */}
        <div className="lg:hidden flex-1 overflow-y-auto space-y-2.5 min-h-[300px]">
          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3.5 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#14151a] animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="p-8 text-center rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#14151a]">
              <Boxes size={28} className="mx-auto text-gray-400 mb-2 opacity-60" />
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Chưa có bút toán biến động</p>
              <p className="text-[11px] text-gray-400 mt-1">Không tìm thấy lịch sử biến động nào cho sản phẩm này theo điều kiện lọc hiện tại.</p>
            </div>
          ) : (
            ledgerEntries.map((row) => {
              const formattedDate = new Date(row.createdAt).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const voucher = row.voucherCode || (row.referenceType === 'PACKAGE' ? `Kiện ${row.referenceId?.substring(0, 8)}` : row.referenceId?.substring(0, 8)) || '-';

              return (
                <div
                  key={row.id}
                  onClick={() => setSelectedEntry(row)}
                  className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800/80 space-y-2.5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors shadow-xs"
                >
                  {/* Dòng 1: Badge loại biến động & Thay đổi tồn */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {formatMovementBadge(row.movementType, row.deltaOnHand, row.stockState)}
                    </div>
                    <div className="text-right shrink-0">
                      {formatDelta(row)}
                    </div>
                  </div>

                  {/* Dòng 2: Chứng từ & Tồn trước -> sau */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={12} className="text-[#5865f2] shrink-0" />
                      <span className="text-gray-400 text-[11px]">Chứng từ:</span>
                      <span className="font-mono font-bold text-[#5865f2] truncate">
                        {voucher}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] shrink-0">
                      <span className="text-gray-400">Tồn:</span>
                      {formatBeforeAfter(row)}
                    </div>
                  </div>

                  {/* Dòng 3: Kho, Trạng thái & Thời gian */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-gray-100 dark:border-gray-800/60 text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Warehouse size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                        {row.warehouseName || row.warehouseCode}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ({row.stockState === 'DAMAGED'
                          ? 'Hàng lỗi'
                          : row.stockState === 'PENDING_INSPECTION'
                          ? 'Chờ KT'
                          : 'Đủ ĐK bán'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                      <Clock size={11} className="shrink-0" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Dòng 4 (nếu có): Người thực hiện, Lô/HSD, Ghi chú */}
                  {(row.performerName || row.batchCode || row.note) && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 pt-1 border-t border-dashed border-gray-100 dark:border-gray-800/40">
                      <div className="flex items-center gap-1 truncate">
                        <User size={11} className="shrink-0" />
                        <span className="truncate">{row.performerName || 'Hệ thống'}</span>
                        {row.batchCode && (
                          <span className="font-mono text-gray-600 dark:text-gray-300">
                            • Lô: {row.batchCode}
                          </span>
                        )}
                      </div>
                      {row.note && (
                        <span className="truncate max-w-[140px] text-gray-400 italic" title={formatLedgerNote(row.note)}>
                          {formatLedgerNote(row.note)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Phân trang trên Mobile & Tablet */}
          <div className="rounded border border-gray-200/80 dark:border-gray-800/80 overflow-hidden bg-white dark:bg-[#14151a] shrink-0 mt-2">
            <SystemPagination
              page={page - 1}
              totalPages={totalPages}
              totalItems={total}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={(l) => {
                setLimit(l);
                setPage(1);
              }}
              className="border-t-0"
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-end w-full">
        <ModalButton type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto gap-1.5">
          <X size={14} />
          <span>Đóng</span>
        </ModalButton>
      </ModalFooter>

      {/* Detail popup for clicked ledger row with Illustrative Icons */}
      {selectedEntry && (
        <Modal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          title={<><span className="sm:hidden">Chi tiết biến động</span><span className="hidden sm:inline">Chi tiết biến động xuất nhập tồn kho</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Mã: ${selectedEntry.id} • SKU: ${sku}`}</span>}
          icon={FileText}
          maxWidth="max-w-lg"
        >
          <ModalBody className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 text-[11px] flex items-center gap-1">
                  <Layers size={12} className="text-[#5865f2]" />
                  <span>Loại giao dịch:</span>
                </span>
                <div className="mt-1">
                  {formatMovementBadge(
                    selectedEntry.movementType,
                    selectedEntry.deltaOnHand,
                    selectedEntry.stockState
                  )}
                </div>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 text-[11px] flex items-center gap-1">
                  <Warehouse size={12} className="text-[#5865f2]" />
                  <span>Kho hàng:</span>
                </span>
                <span className="font-semibold text-gray-900 dark:text-white mt-1 block">
                  {selectedEntry.warehouseName || selectedEntry.warehouseCode}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 text-[11px] flex items-center gap-1">
                  <FileText size={12} className="text-[#5865f2]" />
                  <span>Chứng từ tham chiếu:</span>
                </span>
                <span className="font-mono font-bold text-[#5865f2] mt-1 block">
                  {selectedEntry.voucherCode || (selectedEntry.referenceType === 'PACKAGE' ? `Kiện ${selectedEntry.referenceId?.substring(0, 8)}` : selectedEntry.referenceId) || '--'}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 text-[11px] flex items-center gap-1">
                  <User size={12} className="text-[#5865f2]" />
                  <span>Người thực hiện:</span>
                </span>
                <span className="font-semibold text-gray-900 dark:text-white mt-1 block">
                  {selectedEntry.performerName || 'Hệ thống'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1">
                  <Boxes size={12} />
                  <span>Biến động số lượng:</span>
                </span>
                <span className="text-sm font-bold">{formatDelta(selectedEntry)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1">
                  <RotateCcw size={12} />
                  <span>Tồn trước &rarr; Tồn sau:</span>
                </span>
                <span>{formatBeforeAfter(selectedEntry)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Trạng thái hàng:</span>
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {selectedEntry.stockState === 'DAMAGED'
                    ? 'Hàng lỗi / hỏng'
                    : selectedEntry.stockState === 'PENDING_INSPECTION'
                    ? 'Chờ kiểm tra'
                    : 'Đủ điều kiện bán'}
                </span>
              </div>
              {selectedEntry.batchCode && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>Số lô & HSD:</span>
                  </span>
                  <span className="font-mono font-medium">
                    {selectedEntry.batchCode}{' '}
                    {selectedEntry.expiryDate
                      ? `(HSD: ${new Date(selectedEntry.expiryDate).toLocaleDateString('vi-VN')})`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {selectedEntry.note && (
              <div className="p-2.5 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800">
                <span className="text-gray-400 text-[11px] mb-0.5 flex items-center gap-1">
                  <FileText size={12} />
                  <span>Ghi chú:</span>
                </span>
                <p className="text-gray-800 dark:text-gray-200">{formatLedgerNote(selectedEntry.note)}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex items-center justify-end w-full">
            <ModalButton variant="secondary" onClick={() => setSelectedEntry(null)} className="w-full sm:w-auto gap-1.5">
              <X size={14} />
              <span>Đóng</span>
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </Modal>
  );
};
