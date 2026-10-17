import React, { useState } from 'react';
import { Tag, CheckCircle2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { cashflowApi, CashCategoryType } from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: CashCategoryType;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'EXPENSE',
}) => {
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<CashCategoryType>(defaultType);
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setCode('');
      setName('');
      setType(defaultType);
      setDescription('');
    }
  }, [isOpen, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.warning('Vui lòng nhập Mã và Tên khoản mục');
      return;
    }

    setSubmitting(true);
    try {
      await cashflowApi.createCategory({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        description: description.trim() || undefined,
      });
      toast.success('Thêm khoản mục thành công');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo khoản mục');
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
          <span className="sm:hidden font-semibold truncate">Thêm khoản mục</span>
          <span className="hidden sm:inline font-semibold truncate">Thêm khoản mục thu / chi mới</span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate">
          <span className="sm:hidden truncate">Nhóm phân loại chi phí & doanh thu</span>
          <span className="hidden sm:inline truncate">Thiết lập nhóm phân loại chi phí hoặc doanh thu cho shop</span>
        </div>
      }
      icon={Tag}
    >
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-3.5 sm:space-y-4 p-3 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Mã khoản mục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: CHI_MARKETING"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold uppercase focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Nhóm loại <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CashCategoryType)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
              >
                <option value="EXPENSE">Khoản chi (Chi phí)</option>
                <option value="INCOME">Khoản thu (Doanh thu)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Tên khoản mục hiển thị <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Chi phí chạy quảng cáo Facebook/Shopee Ads"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Mô tả chi tiết / Ví dụ
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú hướng dẫn nhân viên khi chọn khoản mục này..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
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
            className="px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg sm:rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Đang tạo...' : 'Lưu khoản mục'}</span>
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
