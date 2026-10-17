import React, { useState } from 'react';
import { Landmark, CheckCircle2, Wallet, Store, User } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { cashflowApi, CashAccountType } from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shops: Array<{ id: string; name: string }>;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shops,
}) => {
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<CashAccountType>('BANK');
  const [shopId, setShopId] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setCode('');
      setName('');
      setType('BANK');
      setShopId('');
      setAccountNumber('');
      setBankName('');
      setInitialBalance(0);
      setNote('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.warning('Vui lòng nhập đầy đủ Mã và Tên tài khoản');
      return;
    }

    setSubmitting(true);
    try {
      await cashflowApi.createAccount({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        shopId: shopId || undefined,
        accountNumber: accountNumber.trim() || undefined,
        bankName: bankName.trim() || undefined,
        initialBalance: initialBalance || 0,
        note: note.trim() || undefined,
      });
      toast.success('Thêm tài khoản tiền thành công');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo tài khoản');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="sm:hidden font-semibold truncate">Thêm tài khoản</span>
          <span className="hidden sm:inline font-semibold truncate">Thêm tài khoản thanh toán mới</span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate">
          <span className="sm:hidden truncate">Quản lý quỹ tiền & ví sàn Shopee</span>
          <span className="hidden sm:inline truncate">Quản lý quỹ tiền mặt, tài khoản ngân hàng hoặc ví sàn Shopee</span>
        </div>
      }
      icon={Landmark}
    >
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-3.5 sm:space-y-4 p-3 sm:p-6 max-h-[85vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Mã tài khoản <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: TK_MB, TM_KHO_2"
                className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold uppercase focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Loại tài khoản <span className="text-rose-500">*</span>
              </label>
              <Select
                value={type}
                onChange={(val) => setType(val as CashAccountType)}
                options={[
                  { value: 'BANK', label: 'Tài khoản Ngân hàng', icon: Landmark, badge: 'Ngân hàng' },
                  { value: 'CASH', label: 'Quỹ tiền mặt tại kho', icon: Wallet, badge: 'Tiền mặt' },
                  { value: 'PLATFORM_WALLET', label: 'Số dư ví sàn Shopee', icon: Store, badge: 'Ví sàn' },
                  { value: 'PERSONAL_HOLD', label: 'Tiền cá nhân chi hộ', icon: User, badge: 'Cá nhân' },
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Tên tài khoản hiển thị <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: MB Bank - Tài khoản chính shop"
              className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
            />
          </div>

          {type === 'BANK' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Tên ngân hàng
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="MB Bank, VCB, Techcombank..."
                  className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Số tài khoản
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="88889999..."
                  className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {type === 'PLATFORM_WALLET' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Gán Shop Shopee sở hữu
              </label>
              <Select
                value={shopId}
                onChange={(val) => setShopId(String(val || ''))}
                options={[
                  { value: '', label: '-- Chọn shop sở hữu ví --' },
                  ...shops.map((s) => ({ value: s.id, label: s.name, icon: Store })),
                ]}
                placeholder="-- Chọn shop sở hữu ví --"
                searchable={true}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Số dư ban đầu (VNĐ)
            </label>
            <CurrencyInput
              value={initialBalance}
              onChange={(v) => setInitialBalance(v || 0)}
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú về mục đích sử dụng tài khoản này..."
              className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
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
            <span>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</span>
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
