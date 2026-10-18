import React, { useState } from 'react';
import {
  QrCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  Landmark,
  CreditCard,
  User,
  DollarSign,
  FileText,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import { buildVietQrUrl, resolveVietQrBankCode, POPULAR_BANKS } from '../../utils/vietqr';
import { formatCurrency } from '../../utils';
import { toast } from '../ui/Toast';

export interface SupplierBankQrProps {
  supplier?: {
    id?: string;
    code?: string;
    name?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  } | null;
  amount?: number;
  description?: string;
  className?: string;
  compact?: boolean;
}

export const SupplierBankQr: React.FC<SupplierBankQrProps> = ({
  supplier,
  amount = 0,
  description = '',
  className = '',
  compact = false,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!supplier) return null;

  const hasBank = !!supplier.bankAccount?.trim();
  const bankCode = resolveVietQrBankCode(supplier.bankName);
  const bankInfo = POPULAR_BANKS.find((b) => b.code === bankCode);

  const qrUrl = hasBank
    ? buildVietQrUrl({
        bankName: supplier.bankName,
        bankAccount: supplier.bankAccount,
        bankBeneficiary: supplier.bankBeneficiary,
        amount: amount > 0 ? amount : undefined,
        description: description || `Thanh toan NCC ${supplier.code || supplier.name}`,
        template: 'compact2',
      })
    : null;

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `VietQR_${supplier.code || 'NCC'}_${amount || 0}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!hasBank) {
    return (
      <div
        className={`p-3 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 ${className}`}
      >
        <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Nhà cung cấp chưa có thông tin tài khoản:</span>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
            Cần bổ sung Ngân hàng & Số tài khoản trong mục quản lý Nhà cung cấp để tự động tạo mã QR VietQR.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-[#161a22] rounded border border-indigo-200/80 dark:border-indigo-900/50 p-3 sm:p-3.5 space-y-3 shadow-2xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">
            <QrCode size={14} />
          </div>
          <div>
            <h5 className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
              <span>Mã QR Chuyển khoản VietQR</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                24/7
              </span>
            </h5>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Quét bằng app ngân hàng bất kỳ để tự điền số tiền và nội dung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="p-1 rounded text-gray-400 hover:text-[#5865f2] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Phóng to mã QR"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Tải ảnh mã QR"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid: QR Image + Bank Details */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* QR Code Column */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center p-2 rounded bg-gray-50/80 dark:bg-[#12151b] border border-gray-100 dark:border-gray-800">
          {qrUrl && !imgError ? (
            <div
              className="relative group cursor-pointer overflow-hidden rounded"
              onClick={() => setIsZoomOpen(true)}
              title="Bấm để phóng to"
            >
              <img
                src={qrUrl}
                alt="VietQR Chuyển khoản"
                className="w-36 h-auto sm:w-40 object-contain rounded bg-white p-1 transition-transform group-hover:scale-105"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium gap-1 rounded">
                <Eye size={13} />
                <span>Phóng to</span>
              </div>
            </div>
          ) : (
            <div className="w-36 h-36 flex flex-col items-center justify-center text-gray-400 text-xs">
              <QrCode size={32} className="mb-1 opacity-50" />
              <span>Không tải được QR</span>
            </div>
          )}
          <span className="text-[10px] text-gray-400 mt-1.5 text-center">
            Chạm để xem mã lớn
          </span>
        </div>

        {/* Bank Information Details Column */}
        <div className="sm:col-span-7 space-y-2 text-xs">
          {/* Ngân hàng */}
          <div className="flex items-center justify-between p-1.5 rounded bg-gray-50/60 dark:bg-[#1a1e27] border border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 min-w-0">
              <Landmark size={12} className="text-[#5865f2] shrink-0" />
              <span className="text-[11px] shrink-0">Ngân hàng:</span>
              <span className="font-semibold text-gray-900 dark:text-white truncate">
                {bankInfo?.shortName || supplier.bankName || bankCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(bankInfo?.shortName || supplier.bankName || bankCode, 'Tên ngân hàng')
              }
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              title="Sao chép tên ngân hàng"
            >
              {copiedField === 'Tên ngân hàng' ? (
                <Check size={12} className="text-emerald-500" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>

          {/* Số tài khoản */}
          <div className="flex items-center justify-between p-1.5 rounded bg-gray-50/60 dark:bg-[#1a1e27] border border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 min-w-0">
              <CreditCard size={12} className="text-indigo-500 shrink-0" />
              <span className="text-[11px] shrink-0">Số tài khoản:</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white truncate select-all">
                {supplier.bankAccount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(supplier.bankAccount || '', 'Số tài khoản')}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              title="Sao chép số tài khoản"
            >
              {copiedField === 'Số tài khoản' ? (
                <Check size={12} className="text-emerald-500" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>

          {/* Chủ tài khoản */}
          {supplier.bankBeneficiary && (
            <div className="flex items-center justify-between p-1.5 rounded bg-gray-50/60 dark:bg-[#1a1e27] border border-gray-100 dark:border-gray-800/80">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 min-w-0">
                <User size={12} className="text-blue-500 shrink-0" />
                <span className="text-[11px] shrink-0">Chủ tài khoản:</span>
                <span className="font-semibold text-gray-900 dark:text-white uppercase truncate">
                  {supplier.bankBeneficiary}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(supplier.bankBeneficiary || '', 'Tên chủ tài khoản')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                title="Sao chép tên chủ tài khoản"
              >
                {copiedField === 'Tên chủ tài khoản' ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          )}

          {/* Số tiền thanh toán */}
          {amount > 0 && (
            <div className="flex items-center justify-between p-1.5 rounded bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 min-w-0">
                <DollarSign size={12} className="text-emerald-500 shrink-0" />
                <span className="text-[11px] shrink-0">Số tiền:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {formatCurrency(amount)} đ
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(String(Math.round(amount)), 'Số tiền')}
                className="p-1 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 cursor-pointer"
                title="Sao chép số tiền"
              >
                {copiedField === 'Số tiền' ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          )}

          {/* Nội dung chuyển khoản */}
          {description && (
            <div className="flex items-center justify-between p-1.5 rounded bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 min-w-0">
                <FileText size={12} className="text-[#5865f2] shrink-0" />
                <span className="text-[11px] shrink-0">Nội dung:</span>
                <span className="font-mono text-[11px] text-gray-800 dark:text-gray-200 truncate">
                  {description}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(description, 'Nội dung chuyển khoản')}
                className="p-1 text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
                title="Sao chép nội dung chuyển khoản"
              >
                {copiedField === 'Nội dung chuyển khoản' ? (
                  <Check size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Zoom QR */}
      {isZoomOpen && qrUrl && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="relative bg-white dark:bg-[#161a22] rounded-xl p-4 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  Mã QR Chuyển khoản VietQR
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">{supplier.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded bg-white">
              <img
                src={qrUrl}
                alt="VietQR Phóng to"
                className="w-full h-auto object-contain rounded"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Số tiền:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {amount > 0 ? `${formatCurrency(amount)} đ` : 'Tùy nhập'}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Nội dung:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200 text-right truncate max-w-[200px]">
                  {description || `Thanh toan NCC ${supplier.code}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="w-full py-2 px-3 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Download size={14} />
              <span>Tải ảnh mã QR về máy</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
