import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  AlertTriangle,
  Building2,
  FileText,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  Package,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import {
  cashflowApi,
  CashAccountModel,
  CashCategoryModel,
  CashTransactionType,
  CashTransactionStatus,
  CreateCashTransactionPayload,
} from '../../services/cashflowApi';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { purchaseReceiptsApi, PurchaseReceiptModel } from '../../services/purchaseReceiptsApi';
import { shopsApi } from '../../services/shopsApi';
import { toast } from '../../components/ui/Toast';

interface CreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: CashTransactionType;
  defaultCategoryId?: string;
  accounts: CashAccountModel[];
  categories: CashCategoryModel[];
}

export const CreateTransactionModal: React.FC<CreateTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'EXPENSE',
  defaultCategoryId,
  accounts,
  categories,
}) => {
  const [type, setType] = useState<CashTransactionType>(initialType);
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [accountId, setAccountId] = useState<string>('');
  const [isPersonalAdvance, setIsPersonalAdvance] = useState<boolean>(false);
  const [shopId, setShopId] = useState<string>('');
  const [isCommonExpense, setIsCommonExpense] = useState<boolean>(false);
  const [counterpartyName, setCounterpartyName] = useState<string>('');
  const [performedByName, setPerformedByName] = useState<string>('');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [voucherImage, setVoucherImage] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Dành cho thanh toán nhà cung cấp
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [unpaidReceipts, setUnpaidReceipts] = useState<PurchaseReceiptModel[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loadingReceipts, setLoadingReceipts] = useState<boolean>(false);

  // Danh sách shop
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);

  // Cảnh báo trùng lặp
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync type & reset
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setAmount(0);
      setNote('');
      setReferenceCode('');
      setVoucherImage('');
      setWarnings([]);
      setAllocations({});
      setIsPersonalAdvance(false);
      setTransactionDate(new Date().toISOString().split('T')[0]);

      // Tự động chọn tài khoản đầu tiên
      if (accounts.length > 0 && !accountId) {
        setAccountId(accounts[0].id);
      }

      // Load shops & suppliers
      loadInitialData();
    }
  }, [isOpen, initialType, accounts]);

  // Cập nhật categoryId tương ứng với type
  useEffect(() => {
    const validCats = categories.filter((c) => {
      if (type === 'INCOME') return c.type === 'INCOME';
      if (type === 'EXPENSE') return c.type === 'EXPENSE';
      if (type === 'REIMBURSEMENT') return c.type === 'REIMBURSEMENT';
      if (type === 'CAPITAL_IN' || type === 'CAPITAL_OUT') return c.type === 'CAPITAL';
      return false;
    });

    if (defaultCategoryId && validCats.some((c) => c.id === defaultCategoryId)) {
      setCategoryId(defaultCategoryId);
    } else if (validCats.length > 0) {
      // Ưu tiên chọn khoản mục đầu tiên
      setCategoryId(validCats[0].id);
    } else {
      setCategoryId('');
    }
  }, [type, categories, defaultCategoryId]);

  const loadInitialData = async () => {
    try {
      const [shopsRes, supRes] = await Promise.all([
        shopsApi.findAll(),
        suppliersApi.findAll({ limit: 100 }),
      ]);
      setShops(Array.isArray(shopsRes) ? shopsRes : (shopsRes as any)?.data || []);
      setSuppliers(supRes?.data || []);
    } catch (e) {
      console.error('Error loading shops/suppliers', e);
    }
  };

  // Khi chọn nhà cung cấp -> tải danh sách phiếu nhập nợ
  const isPayingSupplier =
    type === 'EXPENSE' &&
    categories.find((c) => c.id === categoryId)?.code === 'CHI_NHAP_HANG';

  useEffect(() => {
    if (isPayingSupplier && selectedSupplierId) {
      fetchSupplierReceipts(selectedSupplierId);
    } else {
      setUnpaidReceipts([]);
      setAllocations({});
    }
  }, [isPayingSupplier, selectedSupplierId]);

  const fetchSupplierReceipts = async (supId: string) => {
    setLoadingReceipts(true);
    try {
      const res = await purchaseReceiptsApi.findAll({
        supplierId: supId,
        paymentStatus: 'UNPAID',
        limit: 50,
      });
      const list = res?.data || [];
      setUnpaidReceipts(list);

      // Auto fill counterparty name
      const sup = suppliers.find((s) => s.id === supId);
      if (sup) {
        setCounterpartyName(sup.name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReceipts(false);
    }
  };

  // Phân bổ tự động số tiền vào các phiếu nợ
  const handleAutoAllocate = (totalPay: number) => {
    let remaining = totalPay;
    const newAlloc: Record<string, number> = {};

    for (const r of unpaidReceipts) {
      const debt = Number(r.remainingAmount || 0);
      if (debt <= 0) continue;

      if (remaining >= debt) {
        newAlloc[r.id] = debt;
        remaining -= debt;
      } else if (remaining > 0) {
        newAlloc[r.id] = remaining;
        remaining = 0;
      } else {
        newAlloc[r.id] = 0;
      }
    }
    setAllocations(newAlloc);
  };

  // Cảnh báo trùng lặp (debounce)
  useEffect(() => {
    if (!amount || amount <= 0) {
      setWarnings([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingDuplicate(true);
        const res = await cashflowApi.checkDuplicate({
          amount,
          transactionDate,
          counterpartyName,
          referenceCode,
        });
        if (res.hasWarning) {
          setWarnings(res.warnings);
        } else {
          setWarnings([]);
        }
      } catch (e) {
        // Silent fail
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [amount, transactionDate, counterpartyName, referenceCode]);

  // Submit Handler
  const handleSubmit = async (targetStatus: CashTransactionStatus) => {
    if (!categoryId) {
      toast.warning('Vui lòng chọn khoản mục thu/chi');
      return;
    }
    if (!amount || amount <= 0) {
      toast.warning('Vui lòng nhập số tiền lớn hơn 0');
      return;
    }
    if (!isPersonalAdvance && !accountId) {
      toast.warning('Vui lòng chọn tài khoản thanh toán');
      return;
    }

    // Build allocations payload
    const allocPayload: Array<{ receiptId: string; amount: number }> = [];
    if (isPayingSupplier) {
      Object.entries(allocations).forEach(([rId, allocAmt]) => {
        if (allocAmt > 0) {
          allocPayload.push({ receiptId: rId, amount: allocAmt });
        }
      });
    }

    // Determine from/to account
    let fromAcc: string | undefined = undefined;
    let toAcc: string | undefined = undefined;

    if (!isPersonalAdvance) {
      if (type === 'EXPENSE' || type === 'CAPITAL_OUT' || type === 'REIMBURSEMENT') {
        fromAcc = accountId;
      } else if (type === 'INCOME' || type === 'CAPITAL_IN') {
        toAcc = accountId;
      }
    }

    const payload: CreateCashTransactionPayload = {
      type,
      categoryId,
      amount,
      transactionDate: `${transactionDate}T12:00:00.000Z`,
      shopId: isCommonExpense ? undefined : shopId || undefined,
      isCommonExpense,
      fromAccountId: fromAcc,
      toAccountId: toAcc,
      paymentMethod: isPersonalAdvance
        ? 'PERSONAL_FUND'
        : accounts.find((a) => a.id === accountId)?.type === 'CASH'
        ? 'CASH'
        : 'BANK_TRANSFER',
      status: targetStatus,
      counterpartyName: counterpartyName.trim() || undefined,
      performedByName: performedByName.trim() || undefined,
      referenceCode: referenceCode.trim() || undefined,
      voucherImage: voucherImage.trim() || undefined,
      note: note.trim() || undefined,
      allocations: allocPayload.length > 0 ? allocPayload : undefined,
    };

    setSubmitting(true);
    try {
      await cashflowApi.createTransaction(payload);
      toast.success(
        targetStatus === 'DRAFT'
          ? 'Đã lưu phiếu nháp thành công (chưa trừ số dư)'
          : 'Đã xác nhận và cập nhật số dư tiền thành công',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu thu chi');
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === categoryId);
  const filteredCategories = categories.filter((c) => {
    if (type === 'INCOME') return c.type === 'INCOME';
    if (type === 'EXPENSE') return c.type === 'EXPENSE';
    if (type === 'REIMBURSEMENT') return c.type === 'REIMBURSEMENT';
    if (type === 'CAPITAL_IN' || type === 'CAPITAL_OUT') return c.type === 'CAPITAL';
    return false;
  });

  const totalAllocated = Object.values(allocations).reduce((acc, v) => acc + (v || 0), 0);
  const remainingOverpaid = Math.max(0, amount - totalAllocated);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="sm:hidden font-semibold truncate">
            {type === 'INCOME' ? 'Phiếu thu tiền' : 'Phiếu chi tiền'}
          </span>
          <span className="hidden sm:inline font-semibold truncate">
            {type === 'INCOME' ? 'Tạo phiếu thu tiền' : 'Tạo phiếu chi tiền'}
          </span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate">
          <span className="sm:hidden truncate">Quản lý dòng tiền & công nợ</span>
          <span className="hidden sm:inline truncate">
            Quản lý dòng tiền chính xác, minh bạch, liên kết đơn hàng & công nợ
          </span>
        </div>
      }
      icon={type === 'INCOME' ? ArrowDownLeft : ArrowUpRight}
    >
      <ModalBody className="space-y-3.5 sm:space-y-5 p-3 sm:p-6 max-h-[80vh] sm:max-h-[78vh] overflow-y-auto text-xs sm:text-sm">
        {/* 1. Chọn loại nghiệp vụ (Segmented Control) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Loại giao dịch <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded font-medium text-sm transition-all border ${
                type === 'EXPENSE'
                  ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950/40 dark:border-rose-600 dark:text-rose-300 shadow-sm ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-rose-500" />
              Chi tiền
            </button>

            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded font-medium text-sm transition-all border ${
                type === 'INCOME'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
              Thu tiền
            </button>

            <button
              type="button"
              onClick={() => setType('REIMBURSEMENT')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded font-medium text-sm transition-all border ${
                type === 'REIMBURSEMENT'
                  ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-300 shadow-sm ring-2 ring-amber-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              <Wallet className="w-4 h-4 text-amber-500" />
              Hoàn tiền ứng hộ
            </button>

            <button
              type="button"
              onClick={() => setType('CAPITAL_IN')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded font-medium text-sm transition-all border ${
                type === 'CAPITAL_IN' || type === 'CAPITAL_OUT'
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-indigo-300 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Góp / Rút vốn
            </button>
          </div>
        </div>

        {/* 2. Khoản mục thường dùng (Quick Chips) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Khoản mục <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">Chọn đúng khoản mục để hạch toán</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {filteredCategories.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`text-xs px-3 py-1.5 rounded border transition-all ${
                  categoryId === cat.id
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 font-medium shadow-sm'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">-- Chọn danh mục chi tiết --</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} {cat.description ? `(${cat.description})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Số tiền & Ngày giao dịch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Số tiền giao dịch (VNĐ) <span className="text-rose-500">*</span>
            </label>
            <CurrencyInput
              value={amount}
              onChange={(val) => {
                const num = val || 0;
                setAmount(num);
                if (isPayingSupplier && unpaidReceipts.length > 0) {
                  handleAutoAllocate(num);
                }
              }}
              placeholder="0"
              className="text-lg font-bold"
            />
            {/* Quick amount adders */}
            <div className="flex items-center gap-1.5 mt-2">
              {[100000, 200000, 500000, 1000000, 5000000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const newTotal = amount + preset;
                    setAmount(newTotal);
                    if (isPayingSupplier) handleAutoAllocate(newTotal);
                  }}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  +{preset >= 1000000 ? `${preset / 1000000}Tr` : `${preset / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Ngày ghi nhận giao dịch
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 4. Tài khoản thanh toán & Cá nhân ứng hộ */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Nguồn tiền thanh toán
            </label>

            {type === 'EXPENSE' && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-amber-600 dark:text-amber-400">
                <input
                  type="checkbox"
                  checked={isPersonalAdvance}
                  onChange={(e) => setIsPersonalAdvance(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                Tiền cá nhân chi hộ (Chị Hồng / nhân viên ứng trước)
              </label>
            )}
          </div>

          {!isPersonalAdvance ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Chọn tài khoản tiền --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({Number(acc.currentBalance).toLocaleString('vi-VN')}đ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/80 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                <Wallet className="w-4 h-4 mr-2 text-indigo-500 shrink-0" />
                {accounts.find((a) => a.id === accountId)?.note ||
                  'Tiền sẽ trực tiếp cộng/trừ vào tài khoản này khi xác nhận.'}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded text-xs text-amber-800 dark:text-amber-200">
              <span className="font-bold">Ghi nhận công nợ nhân viên:</span> Shop ghi nhận phải hoàn
              lại tiền cho người chi hộ. Số dư tài khoản shop sẽ không bị trừ. Khi shop hoàn trả tiền
              sẽ dùng nghiệp vụ <i>"Hoàn tiền nhân viên ứng hộ"</i> để tránh tính trùng chi phí mua
              hàng.
            </div>
          )}
        </div>

        {/* 5. Logic ĐẶC THÙ: Thanh toán nhập hàng (Hiển thị phiếu nợ và phân bổ) */}
        {isPayingSupplier && (
          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 p-4 rounded space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Liên kết phiếu nhập kho & Nhà cung cấp
              </h4>
              <span className="text-xs text-indigo-600 dark:text-indigo-300">
                Đã phân bổ: <b>{totalAllocated.toLocaleString('vi-VN')}đ</b>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Chọn nhà cung cấp cần thanh toán:
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
                >
                  <option value="">-- Chọn Nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplierId && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleAutoAllocate(amount)}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    Tự động phân bổ theo thứ tự phiếu cũ nhất
                  </button>
                </div>
              )}
            </div>

            {loadingReceipts ? (
              <p className="text-xs text-slate-400 italic">Đang tải phiếu nhập kho...</p>
            ) : unpaidReceipts.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {unpaidReceipts.map((r) => {
                  const debt = Number(r.remainingAmount || 0);
                  const alloc = allocations[r.id] || 0;
                  return (
                    <div
                      key={r.id}
                      className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.receiptCode}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ngày nhập: {new Date(r.receiptDate).toLocaleDateString('vi-VN')} | Nợ gốc:{' '}
                          {debt.toLocaleString('vi-VN')}đ
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Trả:</span>
                        <input
                          type="number"
                          value={alloc || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setAllocations({ ...allocations, [r.id]: val });
                          }}
                          className="w-28 px-2 py-1 text-right font-medium rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : selectedSupplierId ? (
              <p className="text-xs text-slate-500 italic">
                Nhà cung cấp này không có phiếu nhập nào đang còn nợ.
              </p>
            ) : null}

            {remainingOverpaid > 0 && (
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded text-xs text-blue-700 dark:text-blue-300">
                Số tiền chi dư: <b>{remainingOverpaid.toLocaleString('vi-VN')}đ</b> sẽ được theo dõi
                dưới dạng <b>tiền ứng trước / cọc NCC</b> cho các lần nhập sau.
              </div>
            )}
          </div>
        )}

        {/* 6. Chi tiết shop & Đối tượng giao dịch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gán Shop
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCommonExpense}
                  onChange={(e) => setIsCommonExpense(e.target.checked)}
                  className="rounded text-indigo-600 w-3.5 h-3.5"
                />
                Chi chung toàn hệ thống
              </label>
            </div>
            <select
              disabled={isCommonExpense}
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">-- Chi chung / Không gắn shop --</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {type === 'INCOME' ? 'Người nộp / trả tiền' : 'Người nhận tiền'}
            </label>
            <input
              type="text"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder="VD: Nhà cung cấp Bao Bì An Phát, Khách lẻ..."
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 7. Người thực hiện & Mã tham chiếu UNC */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Người thực tế chi / thu
            </label>
            <input
              type="text"
              value={performedByName}
              onChange={(e) => setPerformedByName(e.target.value)}
              placeholder="Tên người thực hiện chuyển khoản / đưa tiền"
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Mã giao dịch / Số UNC ngân hàng
            </label>
            <input
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              placeholder="VD: FT26088219901 (dùng đối chiếu)"
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 8. Ghi chú & Ảnh chứng từ */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Ghi chú nội dung thu / chi
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              currentCategory?.code === 'CHI_VAT_TU_DONG_GOI'
                ? 'VD: Mua 10 cuộn băng dính dùng tại kho A'
                : currentCategory?.code === 'CHI_GIAY_MUC_IN'
                ? 'VD: Mua 5 cuộn giấy in A6 cho máy HPRT'
                : 'Nhập ghi chú chi tiết...'
            }
            className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Link ảnh hóa đơn / Chứng từ chuyển khoản
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={voucherImage}
              onChange={(e) => setVoucherImage(e.target.value)}
              placeholder="https://... hoặc URL ảnh chụp hóa đơn"
              className="flex-1 px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* CẢNH BÁO TRÙNG LẶP NẾU CÓ */}
        {warnings.length > 0 && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              CẢNH BÁO TRÙNG LẶP GIAO DỊCH
            </div>
            {warnings.map((w, idx) => (
              <p key={idx} className="text-xs text-amber-700 dark:text-amber-300/90 pl-6">
                • {w}
              </p>
            ))}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 w-full">
        <ModalButton
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
          className="flex-none px-3.5 py-2 sm:py-1.5 text-xs font-semibold"
        >
          Đóng
        </ModalButton>

        <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
          {/* Nút 1: Lưu nháp */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('DRAFT')}
            className="px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded sm:rounded transition-all shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Lưu nháp</span>
            <span className="sm:hidden">Nháp</span>
          </button>

          {/* Nút 2: Xác nhận thu/chi */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('CONFIRMED')}
            className={`px-3.5 sm:px-5 py-2 sm:py-1.5 text-xs sm:text-sm font-semibold text-white rounded sm:rounded shadow-xs transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none active:scale-95 cursor-pointer ${
              type === 'INCOME'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {submitting ? (
              'Đang xử lý...'
            ) : type === 'INCOME' ? (
              <>
                <span className="sm:hidden">Thu tiền</span>
                <span className="hidden sm:inline">Xác nhận Đã thu tiền</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">Chi tiền</span>
                <span className="hidden sm:inline">Xác nhận Đã chi tiền</span>
              </>
            )}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
};
