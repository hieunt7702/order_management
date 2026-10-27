import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Warehouse,
  Boxes,
  Search,
  RefreshCw,
  ArrowDownLeft,
  Sliders,
  Copy,
  Check,
  Package,
  Layers,
  ArrowUpRight,
  TrendingDown,
  AlertTriangle,
  FileText,
  User,
  Clock,
} from 'lucide-react';
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
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { inventoryApi, InventoryLedgerEntry, VariantInventorySummary } from '../../services/inventoryApi';
import { MovementTypeBadge, formatLedgerNote } from '../../utils/inventoryUtils';

export interface ProductLedgerTarget {
  variantId: string;
  sku?: string;
  productName?: string;
  variantName?: string;
  warehouseId?: string;
  warehouseName?: string;
  onHand?: number;
  listingMappingsCount?: number;
}

export interface ProductLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ProductLedgerTarget | null;
  warehouses: Array<{ id: string; name: string; code?: string }>;
  onOpenReceive?: (variantId: string, warehouseId?: string) => void;
  onOpenAdjust?: (variantId: string, warehouseId?: string) => void;
}

const MOVEMENT_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại biến động' },
  { value: 'DISPATCH', label: 'Xuất kho bán (Đơn hàng)' },
  { value: 'RECEIVE', label: 'Nhập kho NCC / Nhập lẻ' },
  { value: 'ADJUST', label: 'Điều chỉnh kiểm kê' },
  { value: 'RETURN_RECEIVE', label: 'Khách hoàn (Đạt chuẩn)' },
  { value: 'RETURN_DAMAGE', label: 'Khách hoàn (Hàng lỗi)' },
  { value: 'PURCHASE_RETURN', label: 'Xuất trả NCC' },
  { value: 'BORROW_RECEIVE', label: 'Mượn hàng NCC' },
  { value: 'BORROW_RETURN', label: 'Cho mượn / Trả mượn' },
  { value: 'STATUS_CONVERT', label: 'Chuyển trạng thái lưu kho' },
  { value: 'SCRAP_DISPOSAL', label: 'Xuất hủy / Mất hàng' },
  { value: 'OPENING_BALANCE', label: 'Số dư đầu kỳ' },
];

export const ProductLedgerModal: React.FC<ProductLedgerModalProps> = ({
  isOpen,
  onClose,
  target,
  warehouses,
  onOpenReceive,
  onOpenAdjust,
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [movementType, setMovementType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const [ledgerEntries, setLedgerEntries] = useState<InventoryLedgerEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [variantSummary, setVariantSummary] = useState<VariantInventorySummary | null>(null);
  const [copiedSku, setCopiedSku] = useState<boolean>(false);

  // Sync warehouse selection with target when modal opens
  useEffect(() => {
    if (isOpen && target) {
      setSelectedWarehouseId(target.warehouseId || '');
      setMovementType('');
      setSearchTerm('');
      setPage(1);
    }
  }, [isOpen, target]);

  // Load summary for the variant
  const fetchSummary = useCallback(async () => {
    if (!target?.variantId) return;
    try {
      const summary = await inventoryApi.getVariantSummary(
        target.variantId,
        selectedWarehouseId || undefined,
      );
      setVariantSummary(summary);
    } catch (err) {
      console.error('Lỗi tải tóm tắt tồn kho biến thể:', err);
    }
  }, [target?.variantId, selectedWarehouseId]);

  // Load ledger history
  const fetchLedger = useCallback(async () => {
    if (!target?.variantId) return;
    setIsLoading(true);
    try {
      const res: any = await inventoryApi.getLedger({
        variantId: target.variantId,
        warehouseId: selectedWarehouseId || undefined,
        movementType: movementType || undefined,
        search: searchTerm.trim() || undefined,
        page,
        limit,
      });

      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      const total = typeof res?.total === 'number' ? res.total : items.length;
      setLedgerEntries(items);
      setTotalEntries(total);
    } catch (err: any) {
      console.error('Lỗi tải lịch sử biến động sản phẩm:', err);
      toast.error('Lỗi tải lịch sử biến động', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [target?.variantId, selectedWarehouseId, movementType, searchTerm, page, limit]);

  useEffect(() => {
    if (isOpen && target?.variantId) {
      fetchSummary();
      fetchLedger();
    }
  }, [isOpen, target?.variantId, fetchSummary, fetchLedger]);

  const handleCopySku = (skuText: string) => {
    navigator.clipboard.writeText(skuText);
    setCopiedSku(true);
    toast.success(`Đã sao chép SKU: ${skuText}`);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  if (!target) return null;

  const displaySku = target.sku || variantSummary?.variant?.sku || target.variantId;
  const displayProductName =
    target.productName ||
    variantSummary?.variant?.product?.name ||
    'Sản phẩm không tên';
  const displayVariantName =
    target.variantName || variantSummary?.variant?.name;

  // Resolve onHand from summary or target
  const liveOnHand =
    variantSummary?.summary?.sellableStock ?? target.onHand ?? 0;
  const isNegative = liveOnHand < 0;
  const isZero = liveOnHand === 0;

  // Calculate quick stats from current entries
  const totalInbound = ledgerEntries
    .filter((l) => (l.deltaOnHand || 0) > 0)
    .reduce((acc, l) => acc + (l.deltaOnHand || 0), 0);
  const totalOutbound = ledgerEntries
    .filter((l) => (l.deltaOnHand || 0) < 0)
    .reduce((acc, l) => acc + Math.abs(l.deltaOnHand || 0), 0);

  const totalPages = Math.ceil(totalEntries / limit) || 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            Biến động tồn kho
          </span>
          <button
            type="button"
            onClick={() => handleCopySku(displaySku)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#5865f2]/10 text-[#5865f2] hover:bg-[#5865f2]/20 transition-colors border border-[#5865f2]/20 cursor-pointer"
            title="Nhấn để sao chép SKU"
          >
            <span>{displaySku}</span>
            {copiedSku ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-md">
            {displayProductName}
          </span>
          {displayVariantName && displayVariantName !== displaySku && (
            <span className="text-gray-400 dark:text-gray-500">
              • {displayVariantName}
            </span>
          )}
          {target.listingMappingsCount ? (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50">
              Shopee: {target.listingMappingsCount} SKU
            </span>
          ) : null}
        </div>
      }
      icon={History}
      size="3xl"
      className="max-h-[92vh] flex flex-col"
    >
      <ModalBody className="flex-1 flex flex-col min-h-0 p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-hidden">
        {/* KPI Strip: Live stock & Ledger metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
          {/* Metric 1: Tồn thực tế */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tồn thực tế hiện tại
              </div>
              <div
                className={`text-lg sm:text-xl font-bold font-mono mt-0.5 ${
                  isNegative
                    ? 'text-rose-600 dark:text-rose-400'
                    : isZero
                      ? 'text-gray-400'
                      : 'text-gray-900 dark:text-white'
                }`}
              >
                {liveOnHand.toLocaleString('vi-VN')}
              </div>
            </div>
            <div
              className={`p-2 rounded-md ${
                isNegative
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : isZero
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isNegative ? <TrendingDown size={18} /> : <Boxes size={18} />}
            </div>
          </div>

          {/* Metric 2: Tổng lượt biến động */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tổng lượt biến động
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-[#5865f2] dark:text-[#7b85f5] mt-0.5">
                {totalEntries.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="p-2 rounded-md bg-[#5865f2]/10 text-[#5865f2]">
              <History size={18} />
            </div>
          </div>

          {/* Metric 3: Tổng lượng nhập (trang hiện tại) */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tổng nhập (trang này)
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                +{totalInbound.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft size={18} />
            </div>
          </div>

          {/* Metric 4: Tổng lượng xuất (trang hiện tại) */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tổng xuất (trang này)
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                -{totalOutbound.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="p-2 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 bg-gray-50/70 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded-lg shrink-0">
          <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm mã đơn, phiếu kho, ghi chú..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
              />
            </div>

            {/* Warehouse Filter */}
            <div className="w-full sm:w-48 shrink-0">
              <Select
                value={selectedWarehouseId}
                onChange={(val: any) => {
                  setSelectedWarehouseId(val);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Tất cả kho', icon: Warehouse },
                  ...warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.code})`,
                    icon: Warehouse,
                  })),
                ]}
                placeholder="Tất cả kho"
                icon={Warehouse}
                size="sm"
                className="w-full"
                menuWidth="w-56"
              />
            </div>

            {/* Movement Type Filter */}
            <div className="w-full sm:w-52 shrink-0">
              <Select
                value={movementType}
                onChange={(val: any) => {
                  setMovementType(val);
                  setPage(1);
                }}
                options={MOVEMENT_TYPE_FILTER_OPTIONS}
                placeholder="Tất cả loại biến động"
                size="sm"
                className="w-full"
                menuWidth="w-60"
              />
            </div>
          </div>

          {/* Refresh button */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchSummary();
                fetchLedger();
              }}
              className="h-8 px-2.5 gap-1.5 text-xs"
              title="Làm mới sổ cái"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#5865f2]' : ''} />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
        </div>

        {/* Ledger Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
            <SystemTableWrapper
              tableClassName="min-w-[950px]"
              pagination={
                <SystemPagination
                  page={page - 1}
                  totalPages={totalPages}
                  totalItems={totalEntries}
                  setPage={(p) => setPage(p + 1)}
                  itemsPerPage={limit}
                  setItemsPerPage={(newLimit) => {
                    setLimit(newLimit);
                    setPage(1);
                  }}
                />
              }
            >
              <SystemThead>
                <SystemTh className="w-12 text-center" align="center">STT</SystemTh>
                <SystemTh className="w-36">Thời gian</SystemTh>
                <SystemTh className="w-36">Loại biến động</SystemTh>
                <SystemTh className="w-32">Kho hàng</SystemTh>
                <SystemTh className="w-28 text-right">Biến động</SystemTh>
                <SystemTh className="w-36 text-center">Tồn: Trước &rarr; Sau</SystemTh>
                <SystemTh className="w-36">Mã đơn / Phiếu kho</SystemTh>
                <SystemTh className="w-48">Người làm & Ghi chú</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={8} rows={6} />
                ) : ledgerEntries.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có lịch sử biến động"
                    description={
                      searchTerm || movementType || selectedWarehouseId
                        ? 'Không tìm thấy bản ghi biến động nào phù hợp với bộ lọc hiện tại.'
                        : 'Sản phẩm này chưa phát sinh lần xuất nhập kho nào.'
                    }
                    colSpan={8}
                  />
                ) : (
                  ledgerEntries.map((entry, index) => {
                    const delta = entry.deltaOnHand ?? 0;
                    const isPositive = delta > 0;
                    const isNeg = delta < 0;
                    const type = entry.movementType;
                    const wName =
                      entry.warehouseName ||
                      warehouses.find((w) => w.id === entry.warehouseId)?.name ||
                      entry.warehouseCode ||
                      '--';
                    const stt = (page - 1) * limit + index + 1;

                    return (
                      <SystemTr key={entry.id || index}>
                        <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                          {stt}
                        </SystemTd>
                        <SystemTd className="text-gray-600 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString('vi-VN')}
                        </SystemTd>
                        <SystemTd>
                          <MovementTypeBadge type={type} delta={delta} />
                        </SystemTd>
                        <SystemTd className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                          {wName}
                        </SystemTd>
                        <SystemTd
                          className={`text-right font-bold font-mono text-xs ${
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isNeg
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-gray-500'
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </SystemTd>
                        <SystemTd className="text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/80 font-mono text-xs">
                            <span className="text-gray-500 dark:text-gray-400">
                              {entry.beforeOnHand ?? '--'}
                            </span>
                            <span className="text-gray-400">&rarr;</span>
                            <span
                              className={`font-bold ${
                                (entry.afterOnHand ?? 0) < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {entry.afterOnHand ?? '--'}
                            </span>
                          </div>
                        </SystemTd>
                        <SystemTd className="font-mono text-xs font-semibold text-[#5865f2] dark:text-[#7b85f5]">
                          <span
                            className="cursor-pointer hover:underline"
                            title={entry.voucherCode || 'Không có mã'}
                            onClick={() => {
                              if (entry.voucherCode) {
                                navigator.clipboard.writeText(entry.voucherCode);
                                toast.success(`Đã sao chép: ${entry.voucherCode}`);
                              }
                            }}
                          >
                            {entry.voucherCode || '--'}
                          </span>
                        </SystemTd>
                        <SystemTd className="text-xs text-gray-600 dark:text-gray-400 max-w-xs">
                          <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                            {entry.performerName || 'Hệ thống'}
                          </div>
                          {entry.note && (
                            <div
                              className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5"
                              title={formatLedgerNote(entry.note)}
                            >
                              {formatLedgerNote(entry.note)}
                            </div>
                          )}
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Card List View (< md) */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                Đang tải lịch sử biến động...
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-4">
                <History className="w-7 h-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chưa có lịch sử biến động
                </p>
                <p className="text-[11px] text-gray-400">
                  Không tìm thấy bản ghi nào phù hợp.
                </p>
              </div>
            ) : (
              ledgerEntries.map((entry, index) => {
                const delta = entry.deltaOnHand ?? 0;
                const isPositive = delta > 0;
                const isNeg = delta < 0;
                const type = entry.movementType;
                const wName =
                  entry.warehouseName ||
                  warehouses.find((w) => w.id === entry.warehouseId)?.name ||
                  entry.warehouseCode ||
                  '--';
                const stt = (page - 1) * limit + index + 1;

                return (
                  <div
                    key={entry.id || index}
                    className="p-3 rounded-lg bg-gray-50 dark:bg-[#14151a] border border-gray-200/80 dark:border-gray-800 space-y-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-mono text-gray-400">#{stt}</span>
                        <MovementTypeBadge type={type} delta={delta} />
                      </div>
                      <span
                        className={`font-mono font-bold text-sm ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNeg
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-gray-500'
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-white dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800">
                      <span className="text-[11px] text-gray-400">Tồn trước &rarr; Sau:</span>
                      <span className="font-mono font-medium">
                        {entry.beforeOnHand ?? '--'} &rarr;{' '}
                        <strong
                          className={
                            (entry.afterOnHand ?? 0) < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-gray-900 dark:text-white'
                          }
                        >
                          {entry.afterOnHand ?? '--'}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <span className="truncate">{wName} • {new Date(entry.createdAt).toLocaleDateString('vi-VN')}</span>
                      <span className="font-mono font-semibold text-[#5865f2] shrink-0">
                        {entry.voucherCode || '--'}
                      </span>
                    </div>

                    {entry.note && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                        {formatLedgerNote(entry.note)}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] mt-2">
                <SystemPagination
                  page={page - 1}
                  totalPages={totalPages}
                  totalItems={totalEntries}
                  setPage={(p) => setPage(p + 1)}
                  itemsPerPage={limit}
                  setItemsPerPage={(newLimit) => {
                    setLimit(newLimit);
                    setPage(1);
                  }}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-between gap-2 shrink-0 border-t border-gray-200 dark:border-gray-800 pt-3">
        <div className="flex items-center gap-2">
          {onOpenReceive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenReceive(target.variantId, selectedWarehouseId || target.warehouseId);
              }}
              className="h-8 px-2.5 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <ArrowDownLeft size={13} />
              <span>Nhập hàng</span>
            </Button>
          )}

          {onOpenAdjust && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onOpenAdjust(target.variantId, selectedWarehouseId || target.warehouseId);
              }}
              className="h-8 px-2.5 gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <Sliders size={13} />
              <span>Kiểm kê / Điều chỉnh</span>
            </Button>
          )}
        </div>

        <ModalButton variant="secondary" onClick={onClose} className="px-4">
          Đóng
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
};
