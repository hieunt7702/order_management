import React, { useState, useEffect } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  Calendar,
  Clock,
  DollarSign,
  Truck,
  Building2,
  Receipt,
  CheckCircle2,
  FileText,
  Warehouse,
  Store,
  Boxes,
  Package,
  Percent,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  purchaseReceiptsApi,
  PurchaseReceiptModel,
  UpdatePurchaseReceiptPayload,
} from '../../services/purchaseReceiptsApi';
import { SupplierItem } from '../../services/suppliersApi';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { Select } from '../ui/Select';
import { CurrencyInput } from '../ui/CurrencyInput';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

interface EditPurchaseReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: PurchaseReceiptModel | null;
  suppliers: SupplierItem[];
  warehouses: any[];
  shops: any[];
  allVariants: any[];
  onSuccess: (updated: PurchaseReceiptModel) => void;
}

export const EditPurchaseReceiptModal: React.FC<EditPurchaseReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  suppliers,
  warehouses,
  shops,
  allVariants,
  onSuccess,
}) => {
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fullReceipt, setFullReceipt] = useState<PurchaseReceiptModel | null>(receipt);

  const [form, setForm] = useState<UpdatePurchaseReceiptPayload>({
    supplierId: '',
    warehouseId: '',
    shopId: undefined,
    receiptDate: '',
    paymentDueDate: '',
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 0,
    shippingFeePayerType: 'PAID_TO_SUPPLIER',
    note: '',
    syncOrderCogs: true,
    items: [],
  });

  // Load detailed receipt when modal opens
  useEffect(() => {
    if (!isOpen || !receipt) return;

    let isMounted = true;
    setIsLoadingDetail(true);

    purchaseReceiptsApi
      .findOne(receipt.id)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data;
        setFullReceipt(data);

        setForm({
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          shopId: data.shopId || undefined,
          receiptDate: data.receiptDate ? data.receiptDate.split('T')[0] : '',
          paymentDueDate: data.paymentDueDate ? data.paymentDueDate.split('T')[0] : '',
          discountAmount: Number(data.discountAmount || 0),
          taxAmount: Number(data.taxAmount || 0),
          shippingFee: Number(data.shippingFee || 0),
          shippingFeePayerType: data.shippingFeePayerType || 'PAID_TO_SUPPLIER',
          note: data.note || '',
          syncOrderCogs: true,
          items:
            data.items && data.items.length > 0
              ? data.items.map((it) => ({
                  id: it.id,
                  variantId: it.variantId,
                  productName: it.productName,
                  variationName: it.variationName || '',
                  sku: it.sku,
                  orderedQuantity: it.orderedQuantity,
                  receivedQuantity: it.receivedQuantity,
                  disputedQuantity: it.disputedQuantity || 0,
                  unitPrice: Number(it.unitPrice || 0),
                  note: it.note || '',
                }))
              : [
                  {
                    variantId: '',
                    productName: '',
                    variationName: '',
                    sku: '',
                    orderedQuantity: 1,
                    receivedQuantity: 1,
                    disputedQuantity: 0,
                    unitPrice: 0,
                    note: '',
                  },
                ],
        });
      })
      .catch((err) => {
        toast.error('Lỗi khi tải chi tiết phiếu nhập', err?.response?.data?.message || err?.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, receipt]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const currentItems = form.items || [];
    const updated = [...currentItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'variantId') {
      const v = allVariants.find((item) => item.id === value);
      if (v) {
        updated[index].sku = v.sku || '';
        updated[index].productName = v.product?.name || v.productName || v.name || '';
        updated[index].variationName =
          v.name && v.name !== 'Mặc định' && v.name !== (v.product?.name || '') ? v.name : '';
        updated[index].unitPrice = Number(v.costPrice || 0);
      }
    }
    setForm({ ...form, items: updated });
  };

  const addItemRow = () => {
    const currentItems = form.items || [];
    setForm({
      ...form,
      items: [
        ...currentItems,
        {
          variantId: '',
          productName: '',
          variationName: '',
          sku: '',
          orderedQuantity: 1,
          receivedQuantity: 1,
          disputedQuantity: 0,
          unitPrice: 0,
          note: '',
        },
      ],
    });
  };

  const removeItemRow = (index: number) => {
    const currentItems = form.items || [];
    if (currentItems.length <= 1) {
      toast.warning('Phiếu nhập phải có ít nhất 1 dòng sản phẩm');
      return;
    }
    setForm({
      ...form,
      items: currentItems.filter((_, i) => i !== index),
    });
  };

  const getVariantStock = (variantId: string, warehouseId?: string) => {
    if (!variantId) return 0;
    const v = allVariants.find((it) => it.id === variantId);
    if (!v) return 0;
    if (warehouseId && (v as any).inventoryBalances && Array.isArray((v as any).inventoryBalances)) {
      const wb = (v as any).inventoryBalances.find((b: any) => b.warehouseId === warehouseId);
      if (wb) return Number(wb.onHand || 0);
    }
    if ((v as any).inventoryBalances && Array.isArray((v as any).inventoryBalances)) {
      return (v as any).inventoryBalances.reduce((sum: number, b: any) => sum + Number(b.onHand || 0), 0);
    }
    return Number((v as any).onHand || 0);
  };

  // Tính toán số tiền thời gian thực
  const formItemsSubtotal = (form.items || []).reduce(
    (sum, it) => sum + (Number(it.receivedQuantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  const formPayable =
    formItemsSubtotal -
    Number(form.discountAmount || 0) +
    Number(form.taxAmount || 0) +
    (form.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? Number(form.shippingFee || 0) : 0);

  const oldTotalItems = Number(fullReceipt?.totalItemsAmount || 0);
  const oldPayable = Number(fullReceipt?.payableAmount || 0);
  const paidAmount = Number(fullReceipt?.paidAmount || 0);
  const returnDeduction = Number(fullReceipt?.returnDeductionAmount || 0);

  const hasPaidOrReturn = paidAmount > 0 || returnDeduction > 0;
  const isExcessPaid = paidAmount + returnDeduction > formPayable;
  const excessAmount = isExcessPaid ? paidAmount + returnDeduction - formPayable : 0;
  const newRemainingDebt = Math.max(0, formPayable - paidAmount - returnDeduction);

  const currentSupplier = suppliers.find((s) => s.id === form.supplierId);
  const currentSupplierDebtBefore = Number(currentSupplier?.closingDebt || 0);
  const payableDelta = formPayable - oldPayable;
  const projectedSupplierDebt = currentSupplierDebtBefore + payableDelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullReceipt) return;

    if (!form.items || form.items.length === 0) {
      toast.warning('Phiếu nhập phải có ít nhất 1 sản phẩm');
      return;
    }

    for (const it of form.items) {
      if (!it.variantId || !it.sku) {
        toast.warning('Vui lòng chọn đầy đủ biến thể sản phẩm cho tất cả các dòng hàng');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await purchaseReceiptsApi.update(fullReceipt.id, form);
      toast.success(
        'Cập nhật phiếu nhập thành công! Giá vốn và số tiền toàn hệ thống đã được đồng bộ.',
      );
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật phiếu nhập', err?.response?.data?.message || err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">
            Chỉnh sửa phiếu nhập: {fullReceipt?.receiptCode || receipt?.receiptCode || ''}
          </span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
          Sửa đơn giá nhập, số lượng thực nhận và tự động cập nhật giá vốn toàn bộ hệ thống
        </div>
      }
      icon={Pencil}
      size="2xl"
    >
      {isLoadingDetail ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#5865f2]" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Đang tải dữ liệu chi tiết phiếu nhập...
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-3.5 p-3 sm:p-5">
            {/* System Sync Banner */}
            <div className="p-3 bg-gradient-to-r from-indigo-50 to-amber-50 dark:from-indigo-950/40 dark:to-amber-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded flex items-start gap-2.5 text-xs">
              <Sparkles className="w-4 h-4 text-[#5865f2] shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <div className="font-semibold text-indigo-950 dark:text-indigo-200">
                  ⚡ Tự động đồng bộ số tiền & giá vốn toàn hệ thống
                </div>
                <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  Khi bạn sửa lại <strong>Đơn giá nhập hàng</strong> hoặc <strong>Số lượng thực nhận</strong>, hệ thống sẽ:
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-gray-700 dark:text-gray-300 font-medium">
                    <li>Cập nhật đơn giá mới vào <strong>Giá vốn (Cost Price)</strong> của từng SKU.</li>
                    <li>
                      Tự động tính toán lại <strong>Giá vốn hàng bán (COGS) & Lợi nhuận gộp</strong> cho toàn bộ đơn hàng liên quan.
                    </li>
                    <li>Điều chỉnh lại <strong>Số dư nợ NCC</strong> và <strong>Sổ cái kho (Inventory Ledger)</strong> chính xác.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-3.5 bg-gray-50/70 dark:bg-gray-900/50 rounded border border-gray-200/80 dark:border-gray-800">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Building2 size={13} className="text-[#5865f2] shrink-0" />
                  <span>Nhà cung cấp</span>
                </label>
                {hasPaidOrReturn ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={`${fullReceipt?.supplier?.code || ''} - ${fullReceipt?.supplier?.name || ''}`}
                      className="w-full h-8 px-2.5 text-xs bg-gray-100 dark:bg-[#131720] border border-gray-200 dark:border-gray-800 rounded text-gray-600 dark:text-gray-300 cursor-not-allowed select-none"
                    />
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      * Đã có thanh toán / trả hàng nên cố định NCC
                    </p>
                  </div>
                ) : (
                  <Select
                    value={form.supplierId}
                    onChange={(val) => setForm({ ...form, supplierId: String(val) })}
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    }))}
                    placeholder="-- Chọn Nhà Cung Cấp --"
                    searchable={true}
                    size="sm"
                    className="w-full"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Warehouse size={13} className="text-[#5865f2] shrink-0" />
                  <span>Kho nhập hàng *</span>
                </label>
                <Select
                  value={form.warehouseId}
                  onChange={(val) => setForm({ ...form, warehouseId: String(val) })}
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.code} - ${w.name}`,
                  }))}
                  placeholder="-- Chọn Kho Nhập Hàng --"
                  searchable={true}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Store size={13} className="text-gray-400 shrink-0" />
                  <span>Shop sở hữu (Tùy chọn)</span>
                </label>
                <Select
                  value={form.shopId || ''}
                  onChange={(val) => setForm({ ...form, shopId: val ? String(val) : undefined })}
                  options={[
                    { value: '', label: '-- Dùng chung toàn workspace --' },
                    ...shops.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    })),
                  ]}
                  placeholder="-- Dùng chung toàn workspace --"
                  searchable={true}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <FileText size={13} className="text-[#5865f2] shrink-0" />
                  <span>Mã phiếu nhập</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={fullReceipt?.receiptCode || ''}
                  className="w-full h-8 px-2.5 text-xs font-mono uppercase font-bold bg-gray-100 dark:bg-[#131720] border border-gray-200 dark:border-gray-800 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Calendar size={13} className="text-gray-400 shrink-0" />
                  <span>Ngày nhập hàng</span>
                </label>
                <input
                  type="date"
                  value={form.receiptDate || ''}
                  onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
                  className="w-full h-8 px-2.5 py-0 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] transition-colors box-border"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Clock size={13} className="text-gray-400 shrink-0" />
                  <span>Hạn thanh toán nợ</span>
                </label>
                <input
                  type="date"
                  value={form.paymentDueDate || ''}
                  onChange={(e) => setForm({ ...form, paymentDueDate: e.target.value })}
                  className="w-full h-8 px-2.5 py-0 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] transition-colors box-border"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Boxes size={14} className="text-[#5865f2]" />
                  <span>Danh sách sản phẩm & đơn giá nhập (Đồng bộ tồn kho & giá vốn)</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  className="flex items-center gap-1 text-xs py-1 h-7"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng</span>
                </Button>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border border-gray-200 dark:border-gray-800 rounded overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="py-2 px-3 w-[26%]">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-gray-400" />
                          <span>Biến Thể / SKU *</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]">
                        <div className="flex items-center justify-center gap-1" title="Số lượng tồn kho thực tế hiện tại">
                          <Boxes size={12} className="text-blue-500" />
                          <span>Tồn Hiện Tại</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[10%]">
                        <span>SL Đặt</span>
                      </th>
                      <th className="py-2 px-2 text-center w-[11%]">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 size={12} className="text-indigo-500" />
                          <span>SL Thực Nhận</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[10%]">
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle size={12} className="text-rose-500" />
                          <span>Lỗi/Thiếu</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[15%]">
                        <div className="flex items-center justify-end gap-1 text-amber-600 dark:text-amber-400 font-bold">
                          <DollarSign size={12} />
                          <span>Đơn Giá Nhập (đ) *</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[12%]">
                        <div className="flex items-center justify-end gap-1">
                          <Receipt size={12} className="text-gray-400" />
                          <span>Thành Tiền</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(form.items || []).map((row, idx) => {
                      const rowSubtotal = (row.receivedQuantity || 0) * (row.unitPrice || 0);
                      const currentStock = getVariantStock(row.variantId, form.warehouseId);

                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-2.5">
                            <Select
                              value={row.variantId}
                              onChange={(val) => handleItemChange(idx, 'variantId', String(val))}
                              options={[
                                { value: '', label: '-- Chọn biến thể SKU --' },
                                ...allVariants.map((v) => {
                                  const prodName = v.product?.name || v.productName || '';
                                  const varName =
                                    v.name && v.name !== 'Mặc định' && v.name !== prodName
                                      ? ` (${v.name})`
                                      : '';
                                  const stock = getVariantStock(v.id, form.warehouseId);
                                  return {
                                    value: v.id,
                                    label: `[${v.sku || 'SKU'}] ${prodName}${varName}`,
                                    badge: `Tồn: ${stock} • Giá vốn: ${v.costPrice ? `${Number(v.costPrice).toLocaleString('vi-VN')}đ` : '0đ'}`,
                                  };
                                }),
                              ]}
                              placeholder="-- Chọn biến thể SKU --"
                              searchable={true}
                              size="sm"
                              className="w-full"
                            />
                            <input
                              type="text"
                              placeholder="Ghi chú hàng lỗi/hỏng (nếu có)"
                              value={row.note || ''}
                              onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                              className="w-full mt-1.5 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700/80 p-0.5 text-[11px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {row.variantId ? (
                              <span
                                className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 inline-block"
                                title="Tồn kho thực tế hiện tại"
                              >
                                {currentStock.toLocaleString('vi-VN')}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={row.orderedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'orderedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded px-1 text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.receivedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-[#5865f2]/60 rounded px-1 text-xs font-bold text-[#5865f2] dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.disputedQuantity || 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'disputedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-rose-300 dark:border-rose-700/80 rounded px-1 text-xs text-rose-600 dark:text-rose-400 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <CurrencyInput
                              value={row.unitPrice}
                              onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                              className="w-28 ml-auto"
                              inputClassName="h-8 text-right px-2 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/80 bg-amber-50/40 dark:bg-amber-950/20"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                            {rowSubtotal.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="p-2 text-center">
                            {(form.items || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                className="text-gray-400 hover:text-rose-500 cursor-pointer"
                                title="Xóa dòng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-2.5">
                {(form.items || []).map((row, idx) => {
                  const rowSubtotal = (row.receivedQuantity || 0) * (row.unitPrice || 0);
                  const currentStock = getVariantStock(row.variantId, form.warehouseId);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-gray-800/90 rounded border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-700/60">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                          <Package size={13} className="text-[#5865f2]" />
                          <span>Sản phẩm #{idx + 1}</span>
                        </span>
                        {(form.items || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                          Biến thể / SKU *
                        </label>
                        <Select
                          value={row.variantId}
                          onChange={(val) => handleItemChange(idx, 'variantId', String(val))}
                          options={[
                            { value: '', label: '-- Chọn biến thể SKU --' },
                            ...allVariants.map((v) => ({
                              value: v.id,
                              label: `[${v.sku || 'SKU'}] ${v.product?.name || v.name || ''}`,
                            })),
                          ]}
                          placeholder="-- Chọn biến thể SKU --"
                          searchable={true}
                          size="sm"
                          className="w-full"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">SL Đặt</label>
                          <input
                            type="number"
                            min="1"
                            value={row.orderedQuantity}
                            onChange={(e) => handleItemChange(idx, 'orderedQuantity', Number(e.target.value))}
                            className="h-7 w-full text-center bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mb-0.5">
                            Thực Nhận
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={row.receivedQuantity}
                            onChange={(e) => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))}
                            className="h-7 w-full text-center bg-white dark:bg-[#161b26] border border-[#5865f2] rounded text-xs font-bold text-[#5865f2]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-rose-600 dark:text-rose-400 mb-0.5">Lỗi/Thiếu</label>
                          <input
                            type="number"
                            min="0"
                            value={row.disputedQuantity || 0}
                            onChange={(e) => handleItemChange(idx, 'disputedQuantity', Number(e.target.value))}
                            className="h-7 w-full text-center bg-white dark:bg-[#161b26] border border-rose-300 dark:border-rose-700 rounded text-xs text-rose-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <div>
                          <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1">
                            Đơn Giá Nhập (đ) *
                          </label>
                          <CurrencyInput
                            value={row.unitPrice}
                            onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                            inputClassName="h-8 p-1 text-xs font-bold font-mono text-amber-700 dark:text-amber-300 bg-amber-50/40"
                          />
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-gray-500 mb-1">Thành tiền</span>
                          <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                            {rowSubtotal.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Adjustments & System Sync Option */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Percent size={13} className="text-emerald-500" />
                    <span>Chiết khấu / Giảm giá trực tiếp (đ)</span>
                  </label>
                  <CurrencyInput
                    value={form.discountAmount}
                    onChange={(val) => setForm({ ...form, discountAmount: val })}
                    suffix="đ"
                    inputClassName="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Receipt size={13} className="text-indigo-500" />
                    <span>Thuế VAT (đ)</span>
                  </label>
                  <CurrencyInput
                    value={form.taxAmount}
                    onChange={(val) => setForm({ ...form, taxAmount: val })}
                    suffix="đ"
                    inputClassName="h-8 text-xs font-mono"
                  />
                </div>

                {/* Shipping Fee */}
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                    <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Cước vận chuyển & Bốc xếp</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <CurrencyInput
                      placeholder="Số tiền cước (đ)"
                      value={form.shippingFee}
                      onChange={(val) => setForm({ ...form, shippingFee: val })}
                      suffix="đ"
                      inputClassName="h-8 text-xs font-mono"
                    />
                    <Select
                      value={form.shippingFeePayerType}
                      onChange={(val) => setForm({ ...form, shippingFeePayerType: val })}
                      options={[
                        { value: 'PAID_TO_SUPPLIER', label: 'Trả cho NCC (Cộng vào nợ NCC)' },
                        { value: 'PAID_TO_CARRIER', label: 'Trả riêng bên VC (Không tính nợ)' },
                      ]}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Checkbox Sync Order COGS */}
                <div className="p-2.5 rounded bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={form.syncOrderCogs ?? true}
                      onChange={() => setForm({ ...form, syncOrderCogs: !(form.syncOrderCogs ?? true) })}
                      size="sm"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                        ⚡ Đồng bộ lại Giá vốn (COGS) & Lợi nhuận cho tất cả đơn hàng đã phát sinh
                      </span>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                        Hệ thống sẽ duyệt toàn bộ đơn hàng có chứa các SKU trong phiếu này và tính lại giá vốn chính xác theo đơn giá nhập mới.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Comparison Summary Card */}
              <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded p-3.5 sm:p-4 flex flex-col justify-between">
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider pb-1 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                    <span>So sánh giá trị tài chính</span>
                    <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">Thời gian thực</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>Tổng tiền hàng cũ:</span>
                    <span className="font-mono text-gray-500 line-through">
                      {oldTotalItems.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 font-medium">
                    <span>Tổng tiền hàng mới:</span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {formItemsSubtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>Phải trả NCC cũ:</span>
                    <span className="font-mono text-gray-500 line-through">
                      {oldPayable.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-gray-900 dark:text-white font-bold pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                    <span>Phải trả NCC mới:</span>
                    <span className="font-mono font-extrabold text-sm text-[#5865f2] dark:text-indigo-400">
                      {formPayable.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span>Đã thanh toán (phân bổ):</span>
                    <span className="font-mono font-bold">
                      {paidAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  {returnDeduction > 0 && (
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span>Giảm trừ do trả hàng:</span>
                      <span className="font-mono font-bold">
                        -{returnDeduction.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {isExcessPaid ? (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                      ⚠️ <strong>Đã trả dư {excessAmount.toLocaleString('vi-VN')}đ:</strong> Số tiền này sẽ tự động chuyển thành <strong>Tiền ứng trước (Advance)</strong> tại NCC để trừ vào các đơn tiếp theo.
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                      <span>Còn nợ phiếu nhập mới:</span>
                      <span className="font-mono font-bold text-sm">
                        {newRemainingDebt.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {currentSupplier && (
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 space-y-1 text-xs">
                      <div className="flex justify-between items-center text-gray-500">
                        <span>Công nợ NCC trước khi sửa:</span>
                        <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                          {currentSupplierDebtBefore > 0
                            ? `Nợ NCC ${currentSupplierDebtBefore.toLocaleString('vi-VN')}đ`
                            : currentSupplierDebtBefore < 0
                            ? `NCC giữ cọc ${Math.abs(currentSupplierDebtBefore).toLocaleString('vi-VN')}đ`
                            : '0đ'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-gray-500">
                        <span>Biến động phiếu (Delta):</span>
                        <span
                          className={`font-mono font-semibold ${
                            payableDelta > 0 ? 'text-rose-600' : payableDelta < 0 ? 'text-emerald-600' : 'text-gray-600'
                          }`}
                        >
                          {payableDelta > 0
                            ? `+${payableDelta.toLocaleString('vi-VN')}đ`
                            : payableDelta < 0
                            ? `${payableDelta.toLocaleString('vi-VN')}đ`
                            : '0đ'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center font-bold pt-1 border-t border-dashed border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-indigo-900 dark:text-indigo-200">Dự kiến nợ NCC sau khi lưu:</span>
                        <span
                          className={`font-mono text-sm ${
                            projectedSupplierDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {projectedSupplierDebt > 0
                            ? `Còn nợ: ${projectedSupplierDebt.toLocaleString('vi-VN')}đ`
                            : projectedSupplierDebt < 0
                            ? `Dư cọc: ${Math.abs(projectedSupplierDebt).toLocaleString('vi-VN')}đ`
                            : '0đ (Sạch nợ)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Ghi chú chỉnh sửa
                  </label>
                  <textarea
                    rows={2}
                    value={form.note || ''}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Lý do sửa phiếu nhập (ví dụ: sửa đơn giá nhập hàng bị nhầm lẫn)..."
                    className="w-full text-xs p-2 bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="gap-1.5 flex-none px-4 py-2 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy bỏ</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-1.5 flex-1 sm:flex-none py-2 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Đang đồng bộ toàn hệ thống...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Lưu thay đổi & Đồng bộ hệ thống</span>
                </>
              )}
            </ModalButton>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
};
