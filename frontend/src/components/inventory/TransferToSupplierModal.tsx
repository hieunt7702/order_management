import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  Warehouse,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Package,
  Boxes,
  CreditCard,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Wallet,
  User,
  FileText,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { Select } from '../ui/Select';
import { CurrencyInput } from '../ui/CurrencyInput';
import { toast } from '../ui/Toast';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { cashflowApi, CashAccountModel } from '../../services/cashflowApi';
import { purchaseReturnsApi } from '../../services/purchaseReturnsApi';
import { productsApi } from '../../services/productsApi';

interface TransferItemRow {
  variantId: string;
  sku: string;
  productName: string;
  variationName?: string;
  availableStock: number;
  quantity: number;
  unitPrice: number;
}

interface TransferToSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWarehouseId?: string;
  initialVariantId?: string;
  warehouses: Array<{ id: string; name: string; code?: string }>;
  allVariants?: any[];
}

const COMMON_REASONS = [
  'Xuất trả hàng lỗi / hỏng do NCC',
  'Xuất trả hàng cận date / tồn kho chậm luân chuyển',
  'Xuất đổi mẫu mã / quy cách sản phẩm',
  'Xuất bán sỉ / hoàn trả hàng theo thỏa thuận',
  'Khác (ghi rõ trong ghi chú)',
];

export const TransferToSupplierModal: React.FC<TransferToSupplierModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialWarehouseId,
  initialVariantId,
  warehouses,
  allVariants,
}) => {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [accounts, setAccounts] = useState<CashAccountModel[]>([]);
  const [internalVariants, setInternalVariants] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const resolvedVariants = (allVariants && allVariants.length > 0) ? allVariants : internalVariants;

  // Form State
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId || warehouses[0]?.id || '');
  const [supplierId, setSupplierId] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Financial settlement
  const [settlementType, setSettlementType] = useState<'OFFSET_DEBT' | 'ACCUMULATE_DEBT' | 'IMMEDIATE_PAYMENT'>('OFFSET_DEBT');
  const [immediateFundSource, setImmediateFundSource] = useState<'CASH_FUND' | 'BANK_ACCOUNT'>('BANK_ACCOUNT');
  const [immediateAccountId, setImmediateAccountId] = useState<string>('');
  const [immediatePaymentMethod, setImmediatePaymentMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [immediatePayerName, setImmediatePayerName] = useState<string>('');

  // Items
  const [items, setItems] = useState<TransferItemRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialWarehouseId) {
      setWarehouseId(initialWarehouseId);
    }
  }, [initialWarehouseId]);

  const loadInitialData = async () => {
    setIsLoadingInitial(true);
    try {
      // 1. Fetch suppliers & accounts independently using allSettled to prevent cross-failure
      const [suppSettled, accSettled] = await Promise.allSettled([
        suppliersApi.findAll(),
        cashflowApi.getAccounts(),
      ]);

      if (suppSettled.status === 'fulfilled') {
        const suppRes: any = suppSettled.value;
        const suppList = suppRes?.data || (Array.isArray(suppRes) ? suppRes : []);
        setSuppliers(suppList);
        if (suppList.length > 0 && !supplierId) {
          setSupplierId(suppList[0].id);
        }
      }

      if (accSettled.status === 'fulfilled') {
        const accRes: any = accSettled.value;
        const accList = accRes?.data || (Array.isArray(accRes) ? accRes : []);
        setAccounts(accList);
        const defaultBank = accList.find((a: any) => a.type === 'BANK' && a.isActive);
        if (defaultBank) {
          setImmediateAccountId(defaultBank.id);
        } else if (accList.length > 0) {
          setImmediateAccountId(accList[0].id);
        }
      }

      // 2. Load variants list if not provided via props
      let currentVariants = (allVariants && allVariants.length > 0) ? allVariants : [];
      if (currentVariants.length === 0) {
        try {
          const prodRes: any = await productsApi.findAll({ limit: 200 });
          const products = prodRes?.data || prodRes?.items || [];
          const flat = products.flatMap((p: any) =>
            (p.variants || []).map((v: any) => ({
              id: v.id,
              sku: v.sku,
              name: v.name,
              productName: p.name,
              costPrice: Number(v.costPrice || 0),
              sellingPrice: Number(v.sellingPrice || 0),
              onHand: v.inventoryBalances?.reduce((sum: number, b: any) => sum + (b.onHand || 0), 0) ?? 0,
              availableStock: v.inventoryBalances?.reduce((sum: number, b: any) => sum + ((b.onHand || 0) - (b.reserved || 0)), 0) ?? 0,
            }))
          );
          currentVariants = flat;
          setInternalVariants(flat);
        } catch (e) {
          console.warn('Could not auto-load product variants for transfer modal:', e);
        }
      }

      // 3. Initialize initial variant item if provided
      if (initialVariantId && currentVariants.length > 0) {
        const found = currentVariants.find((v: any) => v.id === initialVariantId);
        if (found) {
          setItems([
            {
              variantId: found.id,
              sku: found.sku || '',
              productName: found.productName || found.name || 'Sản phẩm',
              variationName: found.name && found.name !== found.productName ? found.name : undefined,
              availableStock: Number(found.availableStock ?? found.onHand ?? 999),
              quantity: 1,
              unitPrice: Number(found.costPrice || 0),
            },
          ]);
          return;
        }
      }

      // 4. Default 1 blank row
      setItems((prev) => {
        if (prev.length > 0) return prev;
        return [
          {
            variantId: '',
            sku: '',
            productName: '',
            availableStock: 0,
            quantity: 1,
            unitPrice: 0,
          },
        ];
      });
    } catch (err) {
      console.error('Error loading data for transfer modal:', err);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        variantId: '',
        sku: '',
        productName: '',
        availableStock: 0,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) {
      toast.warning('Phiếu chuyển hàng phải có ít nhất 1 sản phẩm');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemSelect = (idx: number, variantId: string) => {
    const list = (resolvedVariants && resolvedVariants.length > 0) ? resolvedVariants : (allVariants || []);
    const found = list.find((v: any) => v.id === variantId);
    if (!found) return;

    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        variantId: found.id,
        sku: found.sku || '',
        productName: found.productName || found.name || '',
        variationName: found.name && found.name !== found.productName ? found.name : undefined,
        availableStock: Number(found.availableStock ?? found.onHand ?? found.available ?? 999),
        unitPrice: Number(found.costPrice || 0),
      };
      return next;
    });
  };

  const handleItemChange = (idx: number, field: 'quantity' | 'unitPrice', val: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const totalAmount = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitPrice || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.warning('Vui lòng chọn nhà cung cấp nhận hàng');
      return;
    }
    if (!warehouseId) {
      toast.warning('Vui lòng chọn kho xuất hàng');
      return;
    }

    const validItems = items.filter((it) => it.variantId && it.quantity > 0);
    if (validItems.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm với số lượng lớn hơn 0');
      return;
    }

    // Check stock warning if quantity exceeds available
    const overStock = validItems.find((it) => it.availableStock > 0 && it.quantity > it.availableStock);
    if (overStock) {
      toast.warning(`Sản phẩm [${overStock.sku}] xuất ${overStock.quantity} vượt quá tồn kho hiện có (${overStock.availableStock})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalReason = reason === 'Khác (ghi rõ trong ghi chú)' ? customReason || 'Xuất chuyển hàng cho NCC' : reason;

      const payload = {
        supplierId,
        warehouseId,
        returnDate: new Date(returnDate).toISOString(),
        settlementType,
        debtOffsetAmount: totalAmount,
        reason: finalReason,
        note: note.trim() || undefined,
        immediatePaymentMethod: settlementType === 'IMMEDIATE_PAYMENT' ? immediatePaymentMethod : undefined,
        immediateFundSource: settlementType === 'IMMEDIATE_PAYMENT' ? immediateFundSource : undefined,
        immediateAccountId: settlementType === 'IMMEDIATE_PAYMENT' ? immediateAccountId : undefined,
        immediatePayerName: settlementType === 'IMMEDIATE_PAYMENT' ? immediatePayerName || selectedSupplier?.name : undefined,
        items: validItems.map((it) => ({
          variantId: it.variantId,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      };

      await purchaseReturnsApi.create(payload);

      let successMsg = `Đã lập phiếu chuyển hàng cho NCC ${selectedSupplier?.name || ''} thành công!`;
      if (settlementType === 'OFFSET_DEBT') {
        successMsg += ` Đã khấu trừ ${new Intl.NumberFormat('vi-VN').format(totalAmount)}đ vào công nợ.`;
      } else if (settlementType === 'IMMEDIATE_PAYMENT') {
        successMsg += ` Đã ghi nhận thu ${new Intl.NumberFormat('vi-VN').format(totalAmount)}đ vào tài khoản quỹ.`;
      } else {
        successMsg += ` Đã cộng dồn ${new Intl.NumberFormat('vi-VN').format(totalAmount)}đ vào nợ NCC.`;
      }

      toast.success(successMsg);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating purchase return:', err);
      toast.error('Không thể lập phiếu chuyển hàng', err?.response?.data?.message || err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chuyển hàng cho Nhà cung cấp"
      subtitle="Xuất kho chuyển hàng • Trừ công nợ NCC / Thanh toán ngay"
      icon={Truck}
      size="3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 w-full max-w-full overflow-hidden">
        <ModalBody className="space-y-4 p-4 sm:p-5 max-h-[78vh] overflow-y-auto overflow-x-hidden custom-scrollbar text-xs sm:text-sm w-full max-w-full min-w-0">
          {/* Warehouse and Supplier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-800">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Warehouse size={13} className="text-[#5865f2]" />
                <span>Kho xuất hàng *</span>
              </label>
              <Select
                value={warehouseId}
                onChange={(val) => setWarehouseId(String(val))}
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: `${w.name} ${w.code ? `(${w.code})` : ''}`,
                }))}
                size="sm"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Building2 size={13} className="text-emerald-500" />
                <span>Nhà cung cấp nhận hàng *</span>
              </label>
              <Select
                value={supplierId}
                onChange={(val) => setSupplierId(String(val))}
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.code})`,
                }))}
                size="sm"
                className="w-full"
                searchable
              />
            </div>

            {/* Supplier Debt Status Card */}
            {selectedSupplier && (
              <div className="sm:col-span-2 p-2.5 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Công nợ hiện tại với NCC:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{selectedSupplier.name}</span>
                  </div>
                  <div>
                    {selectedSupplier.closingDebt > 0 ? (
                      <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                        Shop đang nợ NCC: {Number(selectedSupplier.closingDebt).toLocaleString('vi-VN')}đ
                      </span>
                    ) : selectedSupplier.closingDebt < 0 ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        NCC đang nợ shop / tiền cọc: {Math.abs(Number(selectedSupplier.closingDebt)).toLocaleString('vi-VN')}đ
                      </span>
                    ) : (
                      <span className="font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        Công nợ cân bằng (0đ)
                      </span>
                    )}
                  </div>
                </div>

                {totalAmount > 0 && settlementType !== 'IMMEDIATE_PAYMENT' && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/60 dark:bg-indigo-950/30 p-2 rounded">
                    <span className="text-[#5865f2] dark:text-[#7b85f5] font-medium flex items-center gap-1">
                      <CreditCard size={13} /> Sau khi chuyển ({totalAmount.toLocaleString('vi-VN')}đ):
                    </span>
                    {(() => {
                      const projectedDebt = Number(selectedSupplier.closingDebt) - totalAmount;
                      if (projectedDebt > 0) {
                        return (
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            Shop còn nợ NCC: {projectedDebt.toLocaleString('vi-VN')}đ
                          </span>
                        );
                      } else if (projectedDebt < 0) {
                        return (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            NCC sẽ nợ lại shop: {Math.abs(projectedDebt).toLocaleString('vi-VN')}đ
                          </span>
                        );
                      } else {
                        return (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Công nợ hết (Cân bằng 0đ)
                          </span>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span>Ngày giờ chuyển hàng *</span>
              </label>
              <input
                type="datetime-local"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full max-w-full min-w-0 box-border bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-400" />
                <span>Lý do chuyển hàng</span>
              </label>
              <Select
                value={reason}
                onChange={(val) => setReason(String(val))}
                options={COMMON_REASONS.map((r) => ({ value: r, label: r }))}
                size="sm"
                className="w-full"
              />
            </div>

            {reason === 'Khác (ghi rõ trong ghi chú)' && (
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Nhập chi tiết lý do chuyển hàng..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                />
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-800/80 px-3 py-2 font-semibold text-xs text-gray-800 dark:text-gray-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Boxes size={13} className="text-[#5865f2]" />
                <span>Danh sách mặt hàng chuyển</span>
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-[#5865f2] hover:text-[#4752c4] flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Plus size={13} />
                <span>Thêm mặt hàng</span>
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              {items.map((row, idx) => {
                const subtotal = (row.quantity || 0) * (row.unitPrice || 0);

                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-white dark:bg-[#181b22] rounded border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center gap-2 text-xs"
                  >
                    {/* SKU Selection */}
                    <div className="flex-1 min-w-0 w-full">
                      <Select
                        value={row.variantId}
                        onChange={(val) => handleItemSelect(idx, String(val))}
                        options={[
                          { value: '', label: '-- Chọn mặt hàng SKU --' },
                          ...(resolvedVariants || allVariants || []).map((v: any) => ({
                            value: v.id,
                            label: `[${v.sku || 'SKU'}] ${v.productName || v.name || ''}`,
                            badge: `Tồn: ${v.onHand ?? v.availableStock ?? 0}`,
                          })),
                        ]}
                        placeholder="-- Chọn mặt hàng SKU --"
                        searchable
                        size="sm"
                        className="w-full"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="w-full md:w-28 shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5 md:hidden">
                        <span>Số lượng</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        placeholder="Số lượng"
                        value={row.quantity || ''}
                        onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-700 rounded p-1.5 text-xs text-center font-bold text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="w-full md:w-36 shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5 md:hidden">
                        <span>Đơn giá xuất</span>
                      </div>
                      <CurrencyInput
                        placeholder="Đơn giá xuất"
                        value={row.unitPrice}
                        onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                        inputClassName="p-1.5 text-xs text-right font-mono"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="w-full md:w-36 shrink-0 flex items-center justify-between md:justify-end gap-2">
                      <span className="text-[10px] text-gray-400 md:hidden">Thành tiền:</span>
                      <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        {subtotal.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    {/* Delete button */}
                    <div className="shrink-0 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length <= 1}
                        className="text-rose-500 hover:text-rose-600 disabled:opacity-30 p-1 cursor-pointer"
                        title="Xóa dòng"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Total amount summary */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">
                  Tổng giá trị hàng chuyển:
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {totalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>

          {/* 2 Settlement Options: OFFSET_DEBT & IMMEDIATE_PAYMENT */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Phương thức xử lý tài chính & công nợ *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Trừ vào công nợ */}
              <div
                onClick={() => setSettlementType('OFFSET_DEBT')}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  settlementType === 'OFFSET_DEBT'
                    ? 'border-[#5865f2] bg-indigo-50/70 dark:bg-indigo-950/30 ring-1 ring-[#5865f2]'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white mb-1">
                  <CreditCard size={14} className="text-[#5865f2]" />
                  <span>1. Trừ vào công nợ NCC (Mặc định)</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Trừ trực tiếp vào nợ NCC: Đang nợ 100m, chuyển 30m → Còn nợ NCC 70m (nếu chuyển vượt nợ sẽ tính vào tiền cọc / NCC nợ shop).
                </p>
              </div>

              {/* Option 2: Thanh toán luôn */}
              <div
                onClick={() => setSettlementType('IMMEDIATE_PAYMENT')}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  settlementType === 'IMMEDIATE_PAYMENT'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white mb-1">
                  <DollarSign size={14} className="text-emerald-500" />
                  <span>2. NCC thanh toán tiền luôn</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  NCC trả tiền mặt hoặc chuyển khoản ngay: Tự động cộng tiền vào tài khoản quỹ/ngân hàng của shop.
                </p>
              </div>
            </div>

            {/* Immediate Payment Details if selected */}
            {settlementType === 'IMMEDIATE_PAYMENT' && (
              <div className="p-3 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Wallet size={12} className="text-amber-600" />
                      <span>Nguồn tiền nhận *</span>
                    </label>
                    <Select
                      value={immediateFundSource}
                      onChange={(val) => {
                        const nextSource = val as any;
                        setImmediateFundSource(nextSource);
                        const match = accounts.find((a) => (nextSource === 'BANK_ACCOUNT' ? a.type === 'BANK' : a.type === 'CASH') && a.isActive);
                        if (match) setImmediateAccountId(match.id);
                      }}
                      options={[
                        { value: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng' },
                        { value: 'CASH_FUND', label: 'Quỹ tiền mặt' },
                      ]}
                      size="sm"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <CreditCard size={12} className="text-indigo-500" />
                      <span>Tài khoản nhận tiền *</span>
                    </label>
                    <Select
                      value={immediateAccountId}
                      onChange={(val) => setImmediateAccountId(String(val))}
                      options={accounts
                        .filter((a) => (immediateFundSource === 'BANK_ACCOUNT' ? a.type === 'BANK' : a.type === 'CASH'))
                        .map((a) => ({
                          value: a.id,
                          label: `${a.name} (${Number(a.currentBalance || 0).toLocaleString('vi-VN')}đ)`,
                        }))}
                      size="sm"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <User size={12} className="text-gray-400" />
                      <span>Người chi tiền (Đại diện NCC)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={selectedSupplier?.name || 'Tên người nộp tiền'}
                      value={immediatePayerName}
                      onChange={(e) => setImmediatePayerName(e.target.value)}
                      className="w-full bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-1.5 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <CheckCircle2 size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Số tiền <strong>{totalAmount.toLocaleString('vi-VN')} đ</strong> sẽ được tự động cộng vào số dư tài khoản đã chọn và ghi sổ Thu tiền.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Ghi chú thêm
            </label>
            <input
              type="text"
              placeholder="Ghi chú nội dung chuyển hàng, số hợp đồng, chứng từ kèm theo..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
          <ModalButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-1.5 flex-none px-4 py-2 text-xs font-semibold shrink-0"
          >
            <X size={14} />
            <span>Hủy bỏ</span>
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={isSubmitting || totalAmount <= 0}
            className="gap-1.5 flex-1 sm:flex-none py-2 px-5 font-semibold text-xs active:scale-95 justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Truck size={14} className={isSubmitting ? 'animate-spin' : ''} />
            <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận chuyển hàng'}</span>
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
};
