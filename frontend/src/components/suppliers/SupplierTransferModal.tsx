import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Hash,
  Info,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Select } from '../ui/Select';
import { toast } from '../ui/Toast';
import { SupplierItem } from '../../services/suppliersApi';
import { supplierTransfersApi } from '../../services/supplierTransfersApi';
import { purchaseReceiptsApi, PurchaseReceiptModel } from '../../services/purchaseReceiptsApi';

export interface SupplierTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  suppliers: SupplierItem[];
  initialFromSupplierId?: string;
  initialToSupplierId?: string;
}

export const SupplierTransferModal: React.FC<SupplierTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  initialFromSupplierId,
  initialToSupplierId,
}) => {
  const [fromSupplierId, setFromSupplierId] = useState<string>('');
  const [toSupplierId, setToSupplierId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [payerName, setPayerName] = useState<string>('Quản trị viên');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Unpaid receipts of Target Supplier B
  const [unpaidReceipts, setUnpaidReceipts] = useState<PurchaseReceiptModel[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState<boolean>(false);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [showAllocations, setShowAllocations] = useState<boolean>(false);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const fromId = initialFromSupplierId || (suppliers.length > 0 ? suppliers[0].id : '');
      const toId =
        initialToSupplierId ||
        (suppliers.length > 1
          ? suppliers.find((s) => s.id !== fromId)?.id || ''
          : '');

      setFromSupplierId(fromId);
      setToSupplierId(toId);
      setAmount(0);
      setTransferDate(new Date().toISOString().slice(0, 10));
      setReferenceCode('');
      setNote('');
      setAllocations({});
      setShowAllocations(false);

      if (toId) {
        loadUnpaidReceiptsForTarget(toId);
      }
    }
  }, [isOpen, initialFromSupplierId, initialToSupplierId, suppliers]);

  const fromSupplier = useMemo(
    () => suppliers.find((s) => s.id === fromSupplierId),
    [suppliers, fromSupplierId],
  );

  const toSupplier = useMemo(
    () => suppliers.find((s) => s.id === toSupplierId),
    [suppliers, toSupplierId],
  );

  const loadUnpaidReceiptsForTarget = async (supplierId: string) => {
    if (!supplierId) {
      setUnpaidReceipts([]);
      return;
    }
    setIsLoadingReceipts(true);
    try {
      const res = await purchaseReceiptsApi.findAll({
        supplierId,
        paymentStatus: 'UNPAID,PARTIALLY_PAID',
        limit: 50,
      });
      // Filter out receipts with remainingAmount <= 0
      const valid = (res.data || []).filter((r) => Number(r.remainingAmount) > 0);
      setUnpaidReceipts(valid);
      if (valid.length > 0) {
        setShowAllocations(true);
      }
    } catch (err) {
      console.warn('Lỗi tải phiếu nhập chưa thanh toán của NCC nhận:', err);
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const handleToSupplierChange = (val: string | number) => {
    const sId = String(val);
    setToSupplierId(sId);
    setAllocations({});
    loadUnpaidReceiptsForTarget(sId);
  };

  const handleAutoAllocate = (currentAmount: number) => {
    if (!unpaidReceipts.length || currentAmount <= 0) {
      setAllocations({});
      return;
    }
    let remainingToAlloc = currentAmount;
    const newAllocs: Record<string, number> = {};

    // Sort by paymentDueDate ascending (overdue first)
    const sorted = [...unpaidReceipts].sort((a, b) => {
      const dueA = a.paymentDueDate ? new Date(a.paymentDueDate).getTime() : Infinity;
      const dueB = b.paymentDueDate ? new Date(b.paymentDueDate).getTime() : Infinity;
      return dueA - dueB;
    });

    for (const r of sorted) {
      if (remainingToAlloc <= 0) break;
      const need = Number(r.remainingAmount);
      const allocAmt = Math.min(need, remainingToAlloc);
      newAllocs[r.id] = allocAmt;
      remainingToAlloc -= allocAmt;
    }
    setAllocations(newAllocs);
  };

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [allocations]);

  // Projected balances
  const fromBalanceBefore = fromSupplier?.closingDebt || 0;
  const fromBalanceAfter = fromBalanceBefore + amount;

  const toBalanceBefore = toSupplier?.closingDebt || 0;
  const toBalanceAfter = toBalanceBefore - amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromSupplierId || !toSupplierId) {
      toast.error('Vui lòng chọn đầy đủ nhà cung cấp chuyển và nhà cung cấp nhận');
      return;
    }

    if (fromSupplierId === toSupplierId) {
      toast.error('Nhà cung cấp chuyển và nhà cung cấp nhận không được trùng nhau');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('Số tiền chuyển phải lớn hơn 0');
      return;
    }

    if (!note.trim()) {
      toast.error('Vui lòng nhập ghi chú lý do chuyển tiền');
      return;
    }

    if (totalAllocated > amount) {
      toast.error(
        `Tổng tiền phân bổ (${totalAllocated.toLocaleString('vi-VN')}đ) vượt quá số tiền chuyển (${amount.toLocaleString('vi-VN')}đ)`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const allocList = Object.entries(allocations)
        .filter(([_, amt]) => amt > 0)
        .map(([receiptId, amt]) => ({
          receiptId,
          amount: amt,
          note: `Chuyển từ ${fromSupplier?.name || 'NCC khác'}`,
        }));

      await supplierTransfersApi.create({
        fromSupplierId,
        toSupplierId,
        amount,
        transferDate: new Date(transferDate).toISOString(),
        payerName: payerName.trim() || 'Quản trị viên',
        referenceCode: referenceCode.trim() || undefined,
        note: note.trim(),
        allocations: allocList.length > 0 ? allocList : undefined,
      });

      toast.success(
        `Đã chuyển ${amount.toLocaleString('vi-VN')}đ từ ${fromSupplier?.name} sang ${toSupplier?.name} thành công!`,
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Có lỗi xảy ra khi thực hiện chuyển tiền giữa 2 NCC');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-indigo-100 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
              Chuyển Tiền Giữa 2 Nhà Cung Cấp
            </h3>
          </div>
        </div>
      }
      subtitle={
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
          Chuyển tiền đã thanh toán / tiền cọc từ NCC A sang NCC B và cập nhật công nợ đồng bộ
        </span>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-3.5 sm:space-y-4 text-xs sm:text-sm p-3.5 sm:p-5">
          {/* DIRECTIONAL FLOW PREVIEW BANNER */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-blue-50/90 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-blue-950/30 rounded-lg border border-indigo-200/80 dark:border-indigo-800/60">
            <div className="flex items-center justify-between gap-2 text-xs">
              {/* NCC A (Nguồn) */}
              <div className="flex-1 min-w-0 bg-white/80 dark:bg-gray-900/80 p-2.5 rounded border border-indigo-100 dark:border-gray-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block truncate">
                  NCC Chuyển (Nguồn A)
                </span>
                <p className="font-semibold text-gray-900 dark:text-white text-xs truncate mt-0.5">
                  {fromSupplier ? `${fromSupplier.code} - ${fromSupplier.name}` : 'Chưa chọn'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                  <span>Dư nợ hiện tại:</span>
                  <span
                    className={`font-mono font-semibold ${
                      fromBalanceBefore > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : fromBalanceBefore < 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {fromBalanceBefore < 0
                      ? `Cọc ${Math.abs(fromBalanceBefore).toLocaleString('vi-VN')}đ`
                      : `${fromBalanceBefore.toLocaleString('vi-VN')}đ`}
                  </span>
                </div>
              </div>

              {/* Arrow Flow Center */}
              <div className="flex flex-col items-center justify-center shrink-0 px-1 sm:px-2 text-[#5865f2]">
                <ArrowRight className="w-5 h-5 animate-pulse" />
                <span className="text-[10px] font-mono font-bold mt-0.5 whitespace-nowrap">
                  {amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : 'Số tiền'}
                </span>
              </div>

              {/* NCC B (Đích) */}
              <div className="flex-1 min-w-0 bg-white/80 dark:bg-gray-900/80 p-2.5 rounded border border-indigo-100 dark:border-gray-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block truncate">
                  NCC Nhận (Đích B)
                </span>
                <p className="font-semibold text-gray-900 dark:text-white text-xs truncate mt-0.5">
                  {toSupplier ? `${toSupplier.code} - ${toSupplier.name}` : 'Chưa chọn'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                  <span>Dư nợ hiện tại:</span>
                  <span
                    className={`font-mono font-semibold ${
                      toBalanceBefore > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : toBalanceBefore < 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {toBalanceBefore < 0
                      ? `Cọc ${Math.abs(toBalanceBefore).toLocaleString('vi-VN')}đ`
                      : `${toBalanceBefore.toLocaleString('vi-VN')}đ`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. SELECTION & AMOUNT SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Field: NCC Chuyển A */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Building2 size={13} className="text-rose-500" />
                <span>Nhà cung cấp chuyển tiền (NCC A) *</span>
              </label>
              <Select
                value={fromSupplierId}
                onChange={(val) => {
                  const id = String(val);
                  setFromSupplierId(id);
                  if (id === toSupplierId) {
                    const alt = suppliers.find((s) => s.id !== id)?.id || '';
                    setToSupplierId(alt);
                    loadUnpaidReceiptsForTarget(alt);
                  }
                }}
                options={[
                  { value: '', label: '-- Chọn Nhà Cung Cấp A --' },
                  ...suppliers.map((s) => ({
                    value: s.id,
                    label: `${s.code} - ${s.name}`,
                    icon: Building2,
                    badge:
                      s.closingDebt < 0
                        ? `Cọc: ${Math.abs(s.closingDebt).toLocaleString('vi-VN')}đ`
                        : s.closingDebt > 0
                        ? `Nợ: ${s.closingDebt.toLocaleString('vi-VN')}đ`
                        : '0đ',
                  })),
                ]}
                placeholder="-- Chọn NCC chuyển (A) --"
                searchable={true}
                size="sm"
                className="w-full"
              />
              {fromSupplier && fromSupplier.closingDebt < 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400">
                  <span>Tiền cọc NCC A đang giữ:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAdvance = Math.abs(fromSupplier.closingDebt);
                      setAmount(maxAdvance);
                      handleAutoAllocate(maxAdvance);
                    }}
                    className="font-mono font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Bấm để chuyển toàn bộ số tiền cọc này"
                  >
                    <span>{Math.abs(fromSupplier.closingDebt).toLocaleString('vi-VN')}đ</span>
                    <span className="text-[10px] text-[#5865f2]">(Chuyển hết)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Field: NCC Nhận B */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Building2 size={13} className="text-emerald-500" />
                <span>Nhà cung cấp nhận tiền (NCC B) *</span>
              </label>
              <Select
                value={toSupplierId}
                onChange={handleToSupplierChange}
                options={[
                  { value: '', label: '-- Chọn Nhà Cung Cấp B --' },
                  ...suppliers
                    .filter((s) => s.id !== fromSupplierId)
                    .map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                      icon: Building2,
                      badge:
                        s.closingDebt > 0
                          ? `Đang nợ: ${s.closingDebt.toLocaleString('vi-VN')}đ`
                          : s.closingDebt < 0
                          ? `Cọc: ${Math.abs(s.closingDebt).toLocaleString('vi-VN')}đ`
                          : '0đ',
                    })),
                ]}
                placeholder="-- Chọn NCC nhận (B) --"
                searchable={true}
                size="sm"
                className="w-full"
              />
              {toSupplier && toSupplier.closingDebt > 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400">
                  <span>Shop đang nợ NCC B:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const needed = toSupplier.closingDebt;
                      setAmount(needed);
                      handleAutoAllocate(needed);
                    }}
                    className="font-mono font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    title="Bấm để chuyển vừa đủ trả hết nợ cho NCC B"
                  >
                    <span>{toSupplier.closingDebt.toLocaleString('vi-VN')}đ</span>
                    <span className="text-[10px] text-emerald-600">(Đủ trả nợ)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. AMOUNT & DATE & PAYER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Field: Số tiền chuyển */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>Số tiền chuyển (đ) *</span>
              </label>
              <CurrencyInput
                value={amount}
                onChange={(amt) => {
                  setAmount(amt);
                  handleAutoAllocate(amt);
                }}
                suffix="đ"
                inputClassName="w-full bg-white dark:bg-[#1a1b23] border border-indigo-400/80 dark:border-indigo-600 rounded px-2.5 py-1.5 font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Field: Ngày chuyển */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-500" />
                <span>Ngày chuyển *</span>
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2]"
                required
              />
            </div>

            {/* Field: Người thực hiện */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <User size={13} className="text-gray-500" />
                <span>Người thực hiện *</span>
              </label>
              <input
                type="text"
                placeholder="Tên người chi / xác nhận"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2]"
                required
              />
            </div>
          </div>

          {/* Field: Mã tham chiếu / Số UNC (Tùy chọn) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Hash size={13} className="text-gray-500" />
              <span>Mã giao dịch / Số UNC ngân hàng (nếu có)</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: UNC-MB-876251 hoặc Mã chuyển khoản"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2]"
            />
          </div>

          {/* 3. FIELD GHI CHÚ (NỔI BẬT THEO YÊU CẦU: "CÓ THÊM GHI CHÚ") */}
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-200/80 dark:border-amber-800/60 space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={13} className="text-amber-600 dark:text-amber-400" />
                <span>Ghi chú lý do chuyển tiền giữa 2 NCC *</span>
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">
                (Lưu vào sao kê cả 2 NCC)
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Chuyển tiền cọc mua đơn hàng mới sang NCC B theo thỏa thuận 3 bên; Hoặc cấn trừ công nợ giữa 2 nhà cung cấp..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#1a1b23] border border-amber-300/80 dark:border-amber-700/80 rounded focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              required
            />
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              💡 Ghi chú này sẽ được tự động hiển thị trong Sổ công nợ và Bảng sao kê đối soát của cả Nhà cung cấp A và Nhà cung cấp B.
            </p>
          </div>

          {/* 4. OPTIONAL: ALLOCATE TO UNPAID RECEIPTS OF NCC B */}
          {unpaidReceipts.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div
                className="p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowAllocations(!showAllocations)}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <Receipt size={14} className="text-[#5865f2]" />
                  <span>
                    Phân bổ trừ nợ cho các phiếu nhập của {toSupplier?.name} ({unpaidReceipts.length} phiếu)
                  </span>
                  {totalAllocated > 0 && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      Đã phân bổ: {totalAllocated.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoAllocate(amount);
                    }}
                    className="text-[11px] text-[#5865f2] hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles size={12} />
                    <span className="hidden sm:inline">Tự động phân bổ</span>
                  </button>
                  <span className="text-gray-400 text-xs">{showAllocations ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
                </div>
              </div>

              {showAllocations && (
                <div className="p-2.5 sm:p-3 space-y-2 max-h-56 overflow-y-auto">
                  {unpaidReceipts.map((r) => {
                    const remaining = Number(r.remainingAmount);
                    const curAlloc = allocations[r.id] || 0;
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/80 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-gray-900 dark:text-white">
                              {r.receiptCode}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Tổng: {Number(r.payableAmount).toLocaleString('vi-VN')}đ • Còn nợ:{' '}
                            <span className="text-rose-600 font-semibold">
                              {remaining.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const remainingTotal = Math.max(0, amount - (totalAllocated - curAlloc));
                              const toAlloc = Math.min(remaining, remainingTotal);
                              setAllocations((prev) => ({ ...prev, [r.id]: toAlloc }));
                            }}
                            className="text-[10px] text-[#5865f2] hover:underline shrink-0"
                          >
                            Tối đa
                          </button>
                          <div className="w-32">
                            <CurrencyInput
                              value={curAlloc}
                              onChange={(val) => {
                                setAllocations((prev) => ({ ...prev, [r.id]: val }));
                              }}
                              suffix="đ"
                              inputClassName="w-full text-right px-2 py-1 text-xs font-mono font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PROJECTED BALANCE PREVIEW */}
          {amount > 0 && fromSupplier && toSupplier && (
            <div className="p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-900/40 rounded border border-gray-200 dark:border-gray-800 text-xs space-y-1">
              <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                📊 Dự kiến thay đổi số dư sau khi chuyển tiền:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 block truncate">NCC A: {fromSupplier.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                    <span className="text-gray-600 line-through">
                      {fromBalanceBefore.toLocaleString('vi-VN')}đ
                    </span>
                    <ArrowRight size={11} className="text-gray-400" />
                    <span
                      className={`font-bold ${
                        fromBalanceAfter > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : fromBalanceAfter < 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-700'
                      }`}
                    >
                      {fromBalanceAfter < 0
                        ? `Cọc còn ${Math.abs(fromBalanceAfter).toLocaleString('vi-VN')}đ`
                        : `${fromBalanceAfter.toLocaleString('vi-VN')}đ`}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 block truncate">NCC B: {toSupplier.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                    <span className="text-gray-600 line-through">
                      {toBalanceBefore.toLocaleString('vi-VN')}đ
                    </span>
                    <ArrowRight size={11} className="text-gray-400" />
                    <span
                      className={`font-bold ${
                        toBalanceAfter > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : toBalanceAfter < 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-700'
                      }`}
                    >
                      {toBalanceAfter < 0
                        ? `Cọc mới ${Math.abs(toBalanceAfter).toLocaleString('vi-VN')}đ`
                        : `${toBalanceAfter.toLocaleString('vi-VN')}đ`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2 w-full p-3 sm:p-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
          <ModalButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy bỏ
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || amount <= 0 || !fromSupplierId || !toSupplierId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <ArrowRightLeft size={14} className={isSubmitting ? 'animate-spin' : ''} />
            <span>{isSubmitting ? 'Đang thực hiện...' : 'Xác nhận chuyển tiền'}</span>
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
};
