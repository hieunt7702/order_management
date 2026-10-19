import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft,
  ArrowRight,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Eye,
  Trash2,
  MoreHorizontal,
  Building2,
  RefreshCw,
  FileText,
  User,
  Hash,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import {
  supplierTransfersApi,
  SupplierTransferModel,
} from '../../services/supplierTransfersApi';
import { SupplierItem } from '../../services/suppliersApi';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { toast } from '../ui/Toast';
import { confirmModal } from '../ui/ConfirmModal';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
} from '../ui/SystemTable';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';
import { SystemMetricPairCard } from '../ui/SystemMetricCard';

export interface SupplierTransfersTabProps {
  suppliers: SupplierItem[];
  onRefreshData?: () => void;
  onOpenTransferModal: (fromSupplierId?: string, toSupplierId?: string) => void;
}

export const SupplierTransfersTab: React.FC<SupplierTransfersTabProps> = ({
  suppliers,
  onRefreshData,
  onOpenTransferModal,
}) => {
  const [transfers, setTransfers] = useState<SupplierTransferModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fromFilter, setFromFilter] = useState<string>('');
  const [toFilter, setToFilter] = useState<string>('');
  const [selectedTransfer, setSelectedTransfer] = useState<SupplierTransferModel | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  const loadTransfers = async () => {
    setIsLoading(true);
    try {
      const res = await supplierTransfersApi.findAll({
        search: searchTerm.trim() || undefined,
        fromSupplierId: fromFilter || undefined,
        toSupplierId: toFilter || undefined,
        limit: 100,
      });
      setTransfers(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải danh sách chuyển tiền giữa các NCC');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [fromFilter, toFilter]);

  const totalTransferAmount = useMemo(() => {
    return transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transfers]);

  const handleDeleteTransfer = async (transfer: SupplierTransferModel) => {
    const isConfirmed = await confirmModal({
      title: 'Hủy Giao Dịch Chuyển Tiền',
      message: (
        <div className="space-y-2 text-xs">
          <p>
            Bạn có chắc chắn muốn hủy phiếu chuyển tiền{' '}
            <strong className="text-gray-900 dark:text-white font-mono">{transfer.transferCode}</strong>?
          </p>
          <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            ⚠️ Hành động này sẽ hoàn trả lại số tiền{' '}
            <strong>{Number(transfer.amount).toLocaleString('vi-VN')}đ</strong> về NCC{' '}
            <strong>{transfer.fromSupplier?.name}</strong>, đồng thời trừ lại tiền và khôi phục nợ các phiếu nhập của NCC{' '}
            <strong>{transfer.toSupplier?.name}</strong> (nếu có phân bổ).
          </div>
        </div>
      ),
      confirmText: 'Xác nhận hủy phiếu',
      cancelText: 'Giữ lại',
      variant: 'destructive',
    });

    if (!isConfirmed) return;

    try {
      await supplierTransfersApi.delete(transfer.id);
      toast.success('Đã hủy phiếu chuyển tiền thành công!');
      loadTransfers();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra khi hủy phiếu chuyển tiền');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* KPI METRIC CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
        <SystemMetricPairCard
          leftItem={{
            title: 'Tổng số phiếu chuyển tiền',
            mobileTitle: 'Số phiếu chuyển',
            value: transfers.length.toString(),
            subtitle: 'Giao dịch giữa các NCC',
            icon: ArrowRightLeft,
            colorScheme: 'indigo',
          }}
          rightItem={{
            title: 'Tổng số tiền đã chuyển',
            mobileTitle: 'Tổng tiền chuyển',
            value: `${totalTransferAmount.toLocaleString('vi-VN')}đ`,
            subtitle: 'Luân chuyển giữa các NCC',
            icon: DollarSign,
            colorScheme: 'purple',
          }}
        />
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-[#14151a] p-2.5 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, NCC, ghi chú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadTransfers()}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2]"
            />
          </div>

          {/* Filter From Supplier */}
          <div className="w-44 shrink-0">
            <Select
              value={fromFilter}
              onChange={(val) => setFromFilter(String(val))}
              options={[
                { value: '', label: 'Tất cả NCC chuyển (A)' },
                ...suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.code} - ${s.name}`,
                })),
              ]}
              size="sm"
              searchable={true}
              className="w-full"
            />
          </div>

          {/* Filter To Supplier */}
          <div className="w-44 shrink-0">
            <Select
              value={toFilter}
              onChange={(val) => setToFilter(String(val))}
              options={[
                { value: '', label: 'Tất cả NCC nhận (B)' },
                ...suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.code} - ${s.name}`,
                })),
              ]}
              size="sm"
              searchable={true}
              className="w-full"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => onOpenTransferModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-3"
            title="Lập phiếu chuyển tiền giữa 2 NCC"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Chuyển tiền NCC</span>
            <span className="sm:hidden">Chuyển tiền</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadTransfers();
              onRefreshData?.();
            }}
            className="p-2 sm:px-3"
            title="Làm mới"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (sm:block) */}
      <div className="hidden sm:block">
        <SystemTableWrapper>
          <SystemThead>
            <SystemTr>
              <SystemTh className="w-32">Mã Phiếu</SystemTh>
              <SystemTh className="w-28">Ngày Chuyển</SystemTh>
              <SystemTh>NCC Chuyển (A)</SystemTh>
              <SystemTh className="w-10 text-center">➔</SystemTh>
              <SystemTh>NCC Nhận (B)</SystemTh>
              <SystemTh className="text-right w-36">Số Tiền Chuyển</SystemTh>
              <SystemTh className="w-32">Người Chuyển</SystemTh>
              <SystemTh>Ghi Chú</SystemTh>
              <SystemTh className="w-24 text-center">Phân Bổ</SystemTh>
              <SystemTh className="w-16 text-center">Thao Tác</SystemTh>
            </SystemTr>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton colSpan={10} rows={5} />
            ) : transfers.length === 0 ? (
              <SystemTableEmpty
                colSpan={10}
                icon={ArrowRightLeft}
                title="Chưa có giao dịch chuyển tiền nào"
                message="Khi bạn chuyển tiền cọc hoặc tiền thanh toán từ nhà cung cấp này sang nhà cung cấp khác, lịch sử sẽ xuất hiện tại đây."
              />
            ) : (
              transfers.map((t) => (
                <SystemTr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/50">
                  {/* Mã phiếu */}
                  <SystemTd className="font-mono font-semibold text-[#5865f2] text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTransfer(t);
                        setIsDetailModalOpen(true);
                      }}
                      className="hover:underline text-left cursor-pointer"
                    >
                      {t.transferCode}
                    </button>
                  </SystemTd>

                  {/* Ngày chuyển */}
                  <SystemTd className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(t.transferDate).toLocaleDateString('vi-VN')}
                  </SystemTd>

                  {/* NCC Chuyển (A) */}
                  <SystemTd>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                        {t.fromSupplier?.name || 'N/A'}
                      </span>
                      <span className="text-[11px] font-mono text-gray-500">
                        {t.fromSupplier?.code}
                      </span>
                    </div>
                  </SystemTd>

                  {/* Arrow */}
                  <SystemTd className="text-center text-indigo-500">
                    <ArrowRight size={14} className="mx-auto" />
                  </SystemTd>

                  {/* NCC Nhận (B) */}
                  <SystemTd>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                        {t.toSupplier?.name || 'N/A'}
                      </span>
                      <span className="text-[11px] font-mono text-gray-500">
                        {t.toSupplier?.code}
                      </span>
                    </div>
                  </SystemTd>

                  {/* Số tiền */}
                  <SystemTd className="text-right">
                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {Number(t.amount).toLocaleString('vi-VN')}đ
                    </span>
                  </SystemTd>

                  {/* Người chuyển */}
                  <SystemTd className="text-xs text-gray-700 dark:text-gray-300">
                    {t.payerName}
                  </SystemTd>

                  {/* Ghi chú */}
                  <SystemTd>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs" title={t.note || ''}>
                      {t.note || <span className="text-gray-400 italic">Không có ghi chú</span>}
                    </div>
                  </SystemTd>

                  {/* Phân bổ */}
                  <SystemTd className="text-center">
                    {t.allocations && t.allocations.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-medium">
                        <CheckCircle2 size={11} />
                        <span>{t.allocations.length} phiếu</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Ứng trước</span>
                    )}
                  </SystemTd>

                  {/* Thao tác */}
                  <SystemTd className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-1 h-7 w-7">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedTransfer(t);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <Eye size={13} className="mr-2 text-gray-500" />
                          <span>Xem chi tiết</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDeleteTransfer(t)}
                        >
                          <Trash2 size={13} className="mr-2 text-rose-500" />
                          <span>Hủy phiếu chuyển</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SystemTd>
                </SystemTr>
              ))
            )}
          </SystemTbody>
        </SystemTableWrapper>
      </div>

      {/* MOBILE CARD VIEW (sm:hidden) */}
      <div className="block sm:hidden space-y-2.5">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-gray-400">Đang tải dữ liệu...</div>
        ) : transfers.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#14151a] rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
            <ArrowRightLeft className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Chưa có giao dịch chuyển tiền
            </p>
            <p className="text-[11px] text-gray-500">
              Nhấn nút "Chuyển tiền" phía trên để thực hiện luân chuyển tiền giữa 2 NCC.
            </p>
          </div>
        ) : (
          transfers.map((t) => (
            <div
              key={t.id}
              onClick={() => {
                setSelectedTransfer(t);
                setIsDetailModalOpen(true);
              }}
              className="p-3 bg-white dark:bg-[#14151a] rounded-lg border border-gray-200 dark:border-gray-800 space-y-2 cursor-pointer active:bg-gray-50 dark:active:bg-gray-900"
            >
              {/* Top row: Code & Date */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[#5865f2]">{t.transferCode}</span>
                <span className="text-[11px] text-gray-500">
                  {new Date(t.transferDate).toLocaleDateString('vi-VN')}
                </span>
              </div>

              {/* Transfer direction */}
              <div className="p-2 bg-gray-50 dark:bg-gray-900/60 rounded border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-rose-500 font-semibold block uppercase">Từ NCC:</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {t.fromSupplier?.name}
                  </span>
                </div>
                <ArrowRight size={14} className="text-indigo-500 shrink-0 mx-1" />
                <div className="min-w-0 flex-1 text-right">
                  <span className="text-[10px] text-emerald-500 font-semibold block uppercase">Sang NCC:</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {t.toSupplier?.name}
                  </span>
                </div>
              </div>

              {/* Amount & Allocations */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-500 block">Số tiền chuyển:</span>
                  <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {Number(t.amount).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                {t.allocations && t.allocations.length > 0 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-medium">
                    ✓ Trừ {t.allocations.length} phiếu nợ
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500">Cọc trước</span>
                )}
              </div>

              {/* Note */}
              {t.note && (
                <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/30 text-[11px] text-amber-900 dark:text-amber-200 border border-amber-100 dark:border-amber-900/50">
                  <span className="font-semibold">Ghi chú:</span> {t.note}
                </div>
              )}

              {/* Bottom footer: Payer & Delete button */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-500">
                <span>Người chi: {t.payerName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTransfer(t);
                  }}
                  className="text-rose-600 hover:underline p-1 flex items-center gap-1 font-medium"
                >
                  <Trash2 size={12} />
                  <span>Hủy phiếu</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedTransfer && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-sm sm:text-base">
                Chi Tiết Phiếu Chuyển Tiền NCC ({selectedTransfer.transferCode})
              </span>
            </div>
          }
          size="lg"
        >
          <ModalBody className="space-y-3.5 text-xs sm:text-sm p-3.5 sm:p-5">
            {/* Header Summary */}
            <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 rounded border border-indigo-100 dark:border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-gray-500 block">Số tiền chuyển</span>
                <span className="text-lg font-mono font-bold text-indigo-700 dark:text-indigo-300">
                  {Number(selectedTransfer.amount).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="text-left sm:text-right text-xs text-gray-600 dark:text-gray-400">
                <span>Ngày chuyển: {new Date(selectedTransfer.transferDate).toLocaleDateString('vi-VN')}</span>
                <span className="block mt-0.5">Người thực hiện: {selectedTransfer.payerName}</span>
              </div>
            </div>

            {/* Source & Target details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-[#1a1b23] rounded border border-gray-200 dark:border-gray-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-600 block">
                  Nhà Cung Cấp Chuyển (Nguồn A)
                </span>
                <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                  {selectedTransfer.fromSupplier?.name}
                </p>
                <p className="text-[11px] text-gray-500 font-mono">
                  Mã NCC: {selectedTransfer.fromSupplier?.code}
                </p>
                {selectedTransfer.fromSupplier?.phone && (
                  <p className="text-[11px] text-gray-500">
                    SĐT: {selectedTransfer.fromSupplier.phone}
                  </p>
                )}
              </div>

              <div className="p-3 bg-white dark:bg-[#1a1b23] rounded border border-gray-200 dark:border-gray-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                  Nhà Cung Cấp Nhận (Đích B)
                </span>
                <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                  {selectedTransfer.toSupplier?.name}
                </p>
                <p className="text-[11px] text-gray-500 font-mono">
                  Mã NCC: {selectedTransfer.toSupplier?.code}
                </p>
                {selectedTransfer.toSupplier?.phone && (
                  <p className="text-[11px] text-gray-500">
                    SĐT: {selectedTransfer.toSupplier.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Note & Reference */}
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <FileText size={13} className="text-amber-600" />
                <span>Ghi chú giao dịch:</span>
              </div>
              <p className="text-gray-800 dark:text-gray-200 pl-4">
                {selectedTransfer.note || 'Không có ghi chú'}
              </p>
              {selectedTransfer.referenceCode && (
                <p className="text-[11px] text-gray-500 pl-4 mt-1">
                  Mã tham chiếu / UNC: <span className="font-mono">{selectedTransfer.referenceCode}</span>
                </p>
              )}
            </div>

            {/* Allocations breakdown */}
            {selectedTransfer.allocations && selectedTransfer.allocations.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-xs text-gray-800 dark:text-gray-200 block">
                  Danh sách phiếu nhập được phân bổ giảm trừ nợ ({selectedTransfer.allocations.length} phiếu):
                </span>
                <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-medium">
                      <tr>
                        <th className="p-2 text-left">Mã Phiếu Nhập</th>
                        <th className="p-2 text-right">Tổng Nợ Phiếu</th>
                        <th className="p-2 text-right">Số Tiền Trừ Nợ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedTransfer.allocations.map((a) => (
                        <tr key={a.id}>
                          <td className="p-2 font-mono font-semibold text-[#5865f2]">
                            {a.receipt?.receiptCode || a.receiptId}
                          </td>
                          <td className="p-2 text-right font-mono text-gray-500">
                            {Number(a.receipt?.payableAmount || 0).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600">
                            {Number(a.allocatedAmount).toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2 w-full p-3 sm:p-4">
            <ModalButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setIsDetailModalOpen(false);
                handleDeleteTransfer(selectedTransfer);
              }}
            >
              Hủy phiếu chuyển này
            </ModalButton>
            <ModalButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailModalOpen(false)}
            >
              Đóng
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};
