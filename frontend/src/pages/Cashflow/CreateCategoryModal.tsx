import React, { useState } from 'react';
import { Tag, CheckCircle2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
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

  const generateCodeFromName = (catName: string, catType: CashCategoryType) => {
    if (!catName.trim()) return '';
    const prefix = catType === 'EXPENSE' ? 'CHI' : 'THU';
    const clean = catName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toUpperCase();
    return `${prefix}_${clean}`.slice(0, 30);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setCode(generateCodeFromName(val, type));
  };

  const handleTypeChange = (newType: CashCategoryType) => {
    setType(newType);
    setCode(generateCodeFromName(name, newType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Vui lòng nhập Tên khoản mục');
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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Mã khoản mục</span>
                <span className="text-[10px] text-slate-400 font-normal">Tự động sinh</span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={code || 'Hệ thống tự động cấp'}
                title="Mã khoản mục được hệ thống tự động sinh ngầm khi lưu"
                className="w-full px-3.5 py-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-sm font-semibold uppercase text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Nhóm loại <span className="text-rose-500">*</span>
              </label>
              <Select
                value={type}
                onChange={(val) => handleTypeChange(val as CashCategoryType)}
                options={[
                  { value: 'EXPENSE', label: 'Khoản chi (Chi phí)', icon: ArrowUpRight, color: 'text-rose-500' },
                  { value: 'INCOME', label: 'Khoản thu (Doanh thu)', icon: ArrowDownLeft, color: 'text-emerald-500' },
                ]}
                className="w-full"
              />
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="VD: Chi phí chạy quảng cáo Facebook/Shopee Ads"
              className="w-full px-3.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none"
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
            <span>{submitting ? 'Đang tạo...' : 'Lưu khoản mục'}</span>
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
