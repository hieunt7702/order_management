import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  AlertTriangle,
  Landmark,
  CheckCircle2,
  Calendar,
  CreditCard,
  Building2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import {
  cashflowApi,
  CashAccountModel,
  CashCategoryModel,
  CashTransactionType,
} from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface DepositFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAccountId?: string;
  accounts: CashAccountModel[];
  categories: CashCategoryModel[];
}

export const DepositFundsModal: React.FC<DepositFundsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialAccountId,
  accounts,
  categories,
}) => {
  const [accountId, setAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [depositPurpose, setDepositPurpose] = useState<string>('GOP_VON');
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [counterpartyName, setCounterpartyName] = useState<string>('Chủ shop');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Initialize selected account & reset fields
  useEffect(() => {
    if (isOpen) {
      if (initialAccountId && accounts.some((a) => a.id === initialAccountId)) {
        setAccountId(initialAccountId);
      } else if (accounts.length > 0) {
        setAccountId(accounts[0].id);
      }
      setAmount(0);
      setDepositPurpose('GOP_VON');
      setPaymentMethod('BANK_TRANSFER');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setCounterpartyName('Chủ shop');
      setReferenceCode('');
      setNote('');
    }
  }, [isOpen, initialAccountId, accounts]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currentBalance = Number(selectedAccount?.currentBalance || 0);
  const projectedBalance = currentBalance + (amount || 0);
  const isNegative = currentBalance < 0;

  // Handle quick amount add
  const handleAddAmount = (extra: number) => {
    setAmount((prev) => Math.max(0, (prev || 0) + extra));
  };

  // Quick action: Fill negative balance
  const handleFillNegative = () => {
    if (isNegative) {
      setAmount(Math.abs(currentBalance));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      toast.error('Vui lòng chọn tài khoản nhận tiền');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('Vui lòng nhập số tiền nạp lớn hơn 0');
      return;
    }

    // Determine type and category
    let txType: CashTransactionType = 'CAPITAL_IN';
    let targetCat: CashCategoryModel | undefined = undefined;

    switch (depositPurpose) {
      case 'GOP_VON':
        txType = 'CAPITAL_IN';
        targetCat =
          categories.find((c) => c.code === 'GOP_RUT_VON') ||
          categories.find((c) => c.type === 'CAPITAL');
        break;
      case 'NAP_TIEN_QUY':
        txType = 'INCOME';
        targetCat =
          categories.find((c) => c.code === 'NAP_TIEN_QUY') ||
          categories.find((c) => c.code === 'THU_KHAC') ||
          categories.find((c) => c.type === 'INCOME');
        break;
      case 'THU_BAN_HANG':
        txType = 'INCOME';
        targetCat =
          categories.find((c) => c.code === 'THU_BAN_HANG') ||
          categories.find((c) => c.type === 'INCOME');
        break;
      case 'THU_NCC_HOAN_TIEN':
        txType = 'INCOME';
        targetCat =
          categories.find((c) => c.code === 'THU_NCC_HOAN_TIEN') ||
          categories.find((c) => c.type === 'INCOME');
        break;
      default:
        txType = 'INCOME';
        targetCat =
          categories.find((c) => c.code === 'THU_KHAC') ||
          categories.find((c) => c.type === 'INCOME');
        break;
    }

    setSubmitting(true);
    try {
      const defaultNote =
        depositPurpose === 'GOP_VON'
          ? 'Chủ shop nạp tiền góp vốn kinh doanh'
          : depositPurpose === 'NAP_TIEN_QUY'
          ? 'Nạp tiền mặt vào két / quỹ'
          : depositPurpose === 'THU_BAN_HANG'
          ? 'Thu tiền bán hàng trực tiếp'
          : depositPurpose === 'THU_NCC_HOAN_TIEN'
          ? 'Nhà cung cấp hoàn tiền'
          : 'Nạp tiền vào quỹ';

      await cashflowApi.createTransaction({
        type: txType,
        categoryId: targetCat?.id || '',
        toAccountId: accountId,
        amount,
        transactionDate,
        paymentMethod,
        counterpartyName: counterpartyName.trim() || 'Chủ shop',
        referenceCode: referenceCode.trim() || undefined,
        note: note.trim() || defaultNote,
        status: 'CONFIRMED',
      });

      toast.success(
        `Nạp thành công ${amount.toLocaleString('vi-VN')} đ vào ${
          selectedAccount?.name || 'tài khoản'
        }!`,
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi nạp tiền vào tài khoản:', err);
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi nạp tiền');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={ArrowDownLeft}
      title="Nạp tiền vào tài khoản / quỹ"
      subtitle="Bổ sung tiền mặt vào quỹ, góp vốn chủ shop hoặc nạp tiền vào tài khoản ngân hàng"
    >
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {/* 1. Chọn tài khoản nhận tiền */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Tài khoản / Quỹ nhận tiền <span className="text-red-500">*</span>
            </label>
            <Select
              value={accountId}
              onChange={(val) => setAccountId(String(val || ''))}
              options={accounts.map((acc) => ({
                value: acc.id,
                label: `${acc.name} (${acc.type === 'CASH' ? 'Tiền mặt' : acc.type === 'PLATFORM_WALLET' ? 'Ví Shopee' : `${acc.bankName || 'Ngân hàng'} ···· ${acc.accountNumber?.slice(-4) || ''}`}) - Số dư: ${Number(acc.currentBalance).toLocaleString('vi-VN')} đ`,
              }))}
              placeholder="Chọn tài khoản / quỹ"
              className="w-full text-sm font-medium"
            />

            {/* Account Card Preview */}
            {selectedAccount && (
              <div
                className={`mt-2.5 p-3 rounded-lg border transition-colors flex items-center justify-between ${
                  isNegative
                    ? 'bg-rose-500/5 border-rose-500/20 dark:bg-rose-950/20 dark:border-rose-800/40'
                    : 'bg-gray-50/70 border-gray-200 dark:bg-[#1a1b23] dark:border-gray-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                      selectedAccount.type === 'CASH'
                        ? 'bg-blue-500/10 text-blue-500'
                        : selectedAccount.type === 'PLATFORM_WALLET'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-indigo-500/10 text-indigo-500'
                    }`}
                  >
                    {selectedAccount.type === 'CASH' ? (
                      <Wallet size={15} />
                    ) : selectedAccount.type === 'PLATFORM_WALLET' ? (
                      <Wallet size={15} />
                    ) : (
                      <Landmark size={15} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {selectedAccount.name}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      Số dư hiện tại:{' '}
                      <span
                        className={`font-semibold ${
                          isNegative
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {currentBalance.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick button to clear negative balance */}
                {isNegative && (
                  <button
                    type="button"
                    onClick={handleFillNegative}
                    className="px-2.5 py-1 text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 rounded border border-rose-500/30 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Zap size={13} className="text-rose-500" />
                    <span>Nạp bù âm ({Math.abs(currentBalance).toLocaleString('vi-VN')} đ)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. Số tiền nạp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Số tiền nạp <span className="text-red-500">*</span>
              </label>
              {amount > 0 && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Dự kiến sau nạp:{' '}
                  <strong
                    className={
                      projectedBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {projectedBalance.toLocaleString('vi-VN')} đ
                  </strong>
                </span>
              )}
            </div>

            <div className="relative">
              <CurrencyInput
                value={amount}
                onChange={(val) => setAmount(val || 0)}
                placeholder="0"
                className="w-full text-base font-bold text-emerald-600 dark:text-emerald-400 h-11 pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                đ
              </span>
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: '+500k', val: 500000 },
                { label: '+1 triệu', val: 1000000 },
                { label: '+5 triệu', val: 5000000 },
                { label: '+10 triệu', val: 10000000 },
                { label: '+50 triệu', val: 50000000 },
                { label: '+100 triệu', val: 100000000 },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => handleAddAmount(chip.val)}
                  className="px-2 py-1 text-[11px] font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
              {amount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(0)}
                  className="px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-red-500 cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* 3. Mục đích & Khoản mục nạp tiền */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Mục đích / Nguồn tiền nạp <span className="text-red-500">*</span>
              </label>
              <Select
                value={depositPurpose}
                onChange={(val) => setDepositPurpose(String(val || 'GOP_VON'))}
                options={[
                  { value: 'GOP_VON', label: 'Chủ shop nạp / Góp vốn kinh doanh' },
                  { value: 'NAP_TIEN_QUY', label: 'Nạp tiền mặt vào két / quỹ' },
                  { value: 'THU_BAN_HANG', label: 'Tiền bán hàng trực tiếp' },
                  { value: 'THU_NCC_HOAN_TIEN', label: 'Nhà cung cấp hoàn tiền mặt' },
                  { value: 'THU_KHAC', label: 'Khoản thu / Nạp khác' },
                ]}
                placeholder="Chọn mục đích nạp"
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Hình thức giao dịch
              </label>
              <Select
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(String(val || 'BANK_TRANSFER'))}
                options={[
                  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
                  { value: 'CASH', label: 'Tiền mặt' },
                  { value: 'E_WALLET', label: 'Ví điện tử' },
                  { value: 'OTHER', label: 'Hình thức khác' },
                ]}
                placeholder="Chọn hình thức giao dịch"
                className="w-full text-sm"
              />
            </div>
          </div>

          {/* 4. Ngày & Người nộp tiền */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Ngày nạp tiền <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2] text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Người nộp tiền / Đối tác
              </label>
              <input
                type="text"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder="VD: Chủ shop / Nguyễn Văn A..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2] text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          {/* 5. Mã tham chiếu / Số UNC */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Mã giao dịch ngân hàng / Số UNC (nếu có)
            </label>
            <input
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              placeholder="VD: FT2601928374, UNC-091..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2] text-gray-900 dark:text-white placeholder-gray-400 font-mono"
            />
          </div>

          {/* 6. Ghi chú */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Ghi chú nội dung
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Góp vốn lưu động tháng 10, Nạp bù tiền két kho..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2] text-gray-900 dark:text-white placeholder-gray-400 resize-none"
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <ModalButton variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Hủy
          </ModalButton>
          <ModalButton
            variant="primary"
            type="submit"
            disabled={submitting || amount <= 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
          >
            {submitting ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <ArrowDownLeft size={16} />
                <span>Xác nhận nạp tiền</span>
              </>
            )}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
};
