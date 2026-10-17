import React, { useState } from 'react';
import {
  Truck,
  Building2,
  Hash,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Landmark,
  UserCheck,
  FileText,
  X,
  Check,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { toast } from '../ui/Toast';

export interface QuickCreateSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSupplier: SupplierItem) => void;
  initialName?: string;
  existingCount?: number;
}

export const QuickCreateSupplierModal: React.FC<QuickCreateSupplierModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  existingCount = 0,
}) => {
  const [code, setCode] = useState<string>(() => {
    const seq = existingCount > 0 ? existingCount + 1 : Math.floor(100 + Math.random() * 900);
    return `NCC${String(seq).padStart(3, '0')}`;
  });
  const [name, setName] = useState<string>(initialName);
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankBeneficiary, setBankBeneficiary] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync initialName when modal opens
  React.useEffect(() => {
    if (initialName) {
      setName(initialName);
    }
  }, [initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Vui lòng nhập tên nhà cung cấp');
      return;
    }

    const supplierCode = code.trim() || `NCC${Date.now().toString().slice(-4)}`;

    setIsSubmitting(true);
    try {
      const res: any = await suppliersApi.create({
        code: supplierCode,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        bankBeneficiary: bankBeneficiary.trim() || undefined,
        status: 'ACTIVE',
        note: note.trim() || undefined,
      });

      toast.success(`Đã thêm nhà cung cấp "${name.trim()}" thành công!`);
      onSuccess(res?.data || res);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể tạo nhà cung cấp');
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
          <span className="sm:hidden font-semibold truncate">Thêm nhanh NCC</span>
          <span className="hidden sm:inline font-semibold truncate">Thêm nhanh Nhà cung cấp</span>
        </div>
      }
      subtitle={
        <div className="min-w-0 truncate">
          <span className="sm:hidden truncate">Tạo đối tác chọn ngay vào đơn</span>
          <span className="hidden sm:inline truncate">Tạo mới đối tác cung ứng để chọn ngay vào giao dịch</span>
        </div>
      }
      icon={Truck}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-3 sm:space-y-3.5 text-xs p-3 sm:p-5">
          {/* 1. THÔNG TIN CƠ BẢN */}
          <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
              <span>Thông tin đối tác</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Hash size={13} className="text-[#5865f2]" />
                  <span>Mã NCC *</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="NCC001"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Truck size={13} className="text-[#5865f2]" />
                  <span>Tên Nhà cung cấp *</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Công ty TNHH SX & TM An Phát"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Phone size={13} className="text-emerald-500" />
                  <span>Số điện thoại</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Mail size={13} className="text-blue-500" />
                  <span>Email</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supplier@company.vn"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-amber-500" />
                <span>Địa chỉ kho / trụ sở</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Cụm Công nghiệp Triều Khúc, Tân Triều, Thanh Trì, Hà Nội"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
              />
            </div>
          </div>

          {/* 2. TÀI KHOẢN NGÂN HÀNG */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
            <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-100 dark:border-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Tài khoản nhận thanh toán</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Landmark size={12} className="text-indigo-500" />
                  <span>Ngân hàng</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="MB, VCB, ACB..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <CreditCard size={12} className="text-indigo-500" />
                  <span>Số tài khoản</span>
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="0123456789..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <UserCheck size={12} className="text-indigo-500" />
                  <span>Chủ tài khoản</span>
                </label>
                <input
                  type="text"
                  value={bankBeneficiary}
                  onChange={(e) => setBankBeneficiary(e.target.value)}
                  placeholder="NGUYEN VAN A"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                />
              </div>
            </div>
          </div>

          {/* 3. GHI CHÚ */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <FileText size={13} className="text-gray-400" />
              <span>Ghi chú thêm</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú về chiết khấu, thời gian giao hàng..."
              className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
          <ModalButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
          >
            <X size={14} />
            <span>Hủy</span>
          </ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
          >
            <Check size={14} />
            <span className="sm:hidden">Tạo NCC</span>
            <span className="hidden sm:inline">Tạo Nhà Cung Cấp</span>
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
};
