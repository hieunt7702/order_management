import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Wallet, CheckCircle2, Info, Building2, Landmark } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import {
  cashflowApi,
  CashAccountModel,
  CreateInternalTransferPayload,
} from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface InternalTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: CashAccountModel[];
  defaultFromAccountId?: string;
  defaultToAccountId?: string;
}

export const InternalTransferModal: React.FC<InternalTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  defaultFromAccountId,
  defaultToAccountId,
}) => {
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(0);
      setFeeAmount(0);
      setReferenceCode('');
      setNote('');
      setTransferDate(new Date().toISOString().split('T')[0]);

      if (defaultFromAccountId) {
        setFromAccountId(defaultFromAccountId);
      } else if (accounts.length > 0) {
        // Tự động gợi ý rút từ Ví Shopee nếu có
        const shopeeAcc = accounts.find((a) => a.type === 'PLATFORM_WALLET');
        setFromAccountId(shopeeAcc ? shopeeAcc.id : accounts[0].id);
      }

      if (defaultToAccountId) {
        setToAccountId(defaultToAccountId);
      } else if (accounts.length > 1) {
        // Tự động gợi ý chuyển về MB Bank
        const bankAcc = accounts.find((a) => a.type === 'BANK');
        setToAccountId(bankAcc ? bankAcc.id : accounts[1].id);
      }
    }
  }, [isOpen, accounts, defaultFromAccountId, defaultToAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId) {
      toast.warning('Vui lòng chọn cả tài khoản nguồn và tài khoản đích');
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.warning('Tài khoản nguồn và tài khoản đích không được trùng nhau');
      return;
    }
    if (!amount || amount <= 0) {
      toast.warning('Vui lòng nhập số tiền chuyển lớn hơn 0');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    if (fromAcc && Number(fromAcc.currentBalance) < amount) {
      toast.warning(
        `Số dư tài khoản nguồn (${Number(fromAcc.currentBalance).toLocaleString(
          'vi-VN',
        )}đ) nhỏ hơn số tiền muốn chuyển`,
      );
    }

    const payload: CreateInternalTransferPayload = {
      fromAccountId,
      toAccountId,
      amount,
      feeAmount: feeAmount || 0,
      transferDate: `${transferDate}T12:00:00.000Z`,
      referenceCode: referenceCode.trim() || undefined,
      note: note.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await cashflowApi.createInternalTransfer(payload);
      toast.success('Chuyển tiền nội bộ thành công (Đã đối ứng số dư 2 tài khoản)');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi chuyển tiền');
    } finally {
      setSubmitting(false);
    }
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const netAmount = Math.max(0, amount - feeAmount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="sm:hidden font-semibold truncate">Chuyển tiền nội bộ</span>
          <span className="hidden sm:inline font-semibold truncate">Chuyển tiền nội bộ / Rút tiền sàn Shopee</span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate">
          <span className="sm:hidden truncate">Chuyển dịch giữa các tài khoản</span>
          <span className="hidden sm:inline truncate">
            Chuyển dịch dòng tiền giữa các tài khoản mà không tính trùng doanh thu hoặc chi phí
          </span>
        </div>
      }
      icon={ArrowLeftRight}
    >
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-3.5 sm:space-y-4 p-3 sm:p-6 max-h-[85vh] overflow-y-auto text-xs sm:text-sm">
          {/* Nguyên tắc kế toán quan trọng */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Nguyên tắc không tính thu hai lần:</span> Khi rút tiền từ
              Số dư sàn Shopee về tài khoản Ngân hàng (MB Bank), hệ thống chỉ ghi nhận giảm số dư sàn
              và tăng số dư ngân hàng, <b>tuyệt đối không ghi thêm doanh thu lần hai</b>.
            </div>
          </div>

          {/* Chọn tài khoản nguồn & đích */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tài khoản nguồn (Tiền ra) <span className="text-rose-500">*</span>
              </label>
              <Select
                value={fromAccountId}
                onChange={(val) => setFromAccountId(String(val || ''))}
                options={[
                  { value: '', label: '-- Chọn tài khoản nguồn --' },
                  ...accounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${Number(acc.currentBalance).toLocaleString('vi-VN')}đ)`,
                    icon: acc.type === 'CASH' ? Wallet : acc.type === 'BANK' ? Landmark : Building2,
                    badge: acc.type === 'CASH' ? 'Tiền mặt' : acc.type === 'BANK' ? 'Ngân hàng' : 'Ví sàn',
                  })),
                ]}
                placeholder="-- Chọn tài khoản nguồn --"
                searchable={true}
                className="w-full"
              />
              {fromAccount && (
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                  <span>Số dư hiện tại:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {Number(fromAccount.currentBalance).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tài khoản đích (Tiền vào) <span className="text-emerald-500">*</span>
              </label>
              <Select
                value={toAccountId}
                onChange={(val) => setToAccountId(String(val || ''))}
                options={[
                  { value: '', label: '-- Chọn tài khoản đích --' },
                  ...accounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.name} (${Number(acc.currentBalance).toLocaleString('vi-VN')}đ)`,
                    disabled: acc.id === fromAccountId,
                    icon: acc.type === 'CASH' ? Wallet : acc.type === 'BANK' ? Landmark : Building2,
                    badge: acc.type === 'CASH' ? 'Tiền mặt' : acc.type === 'BANK' ? 'Ngân hàng' : 'Ví sàn',
                  })),
                ]}
                placeholder="-- Chọn tài khoản đích --"
                searchable={true}
                className="w-full"
              />
              {toAccount && (
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                  <span>Số dư hiện tại:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {Number(toAccount.currentBalance).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Số tiền & Phí */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Số tiền chuyển (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <CurrencyInput
                value={amount}
                onChange={(v) => setAmount(v || 0)}
                placeholder="0"
                className="text-lg font-bold"
              />
              {fromAccount && Number(fromAccount.currentBalance) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(Number(fromAccount.currentBalance))}
                  className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Rút toàn bộ số dư ({Number(fromAccount.currentBalance).toLocaleString('vi-VN')}đ)
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Phí chuyển tiền / Phí rút sàn (nếu có)
              </label>
              <CurrencyInput
                value={feeAmount}
                onChange={(v) => setFeeAmount(v || 0)}
                placeholder="0"
              />
              <div className="mt-1.5 text-[11px] text-slate-500">
                Thực nhận vào đích: <b>{netAmount.toLocaleString('vi-VN')}đ</b>
              </div>
            </div>
          </div>

          {/* Ngày & Mã giao dịch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Ngày chuyển tiền
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Mã giao dịch ngân hàng / Số UNC
              </label>
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="VD: FT26088219901"
                className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Ghi chú chuyển tiền
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Rút tiền doanh thu tuần 42 từ ví Shopee về tài khoản MB Bank"
              className="w-full px-3.5 py-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 w-full">
          <ModalButton
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="gap-1.5 flex-none px-4 py-2.5 sm:py-2 text-xs font-semibold shrink-0"
          >
            Đóng
          </ModalButton>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded sm:rounded shadow-xs transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="sm:hidden">{submitting ? 'Đang chuyển...' : 'Chuyển tiền'}</span>
            <span className="hidden sm:inline">{submitting ? 'Đang chuyển...' : 'Xác nhận chuyển tiền nội bộ'}</span>
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
